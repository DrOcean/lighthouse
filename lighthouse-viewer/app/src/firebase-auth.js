/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* global firebase, idbKeyval */

// TODO(bckenny): Object => firebase externs?

/**
 * Wrapper for Firebase authentication.
 */
class FirebaseAuth {
  constructor() {
    /** @private {?string} */
    this._accessToken = null;
    /** @private {Object} */
    this._firebaseUser = null;

    /** @private {!Object} */
    this._provider = new firebase.auth.GithubAuthProvider();
    this._provider.addScope('gist');

    firebase.initializeApp({
      apiKey: 'AIzaSyApMz8FHTyJNqqUtA51tik5Mro8j-2qMcM',
      authDomain: 'lighthouse-viewer.firebaseapp.com',
      databaseURL: 'https://lighthouse-viewer.firebaseio.com',
      storageBucket: 'lighthouse-viewer.appspot.com',
      messagingSenderId: '962507201498'
    });

    /**
     * Promise which resolves after the first check of auth state. After this,
     * _accessToken will be set if user logged in and has access token.
     * @private {!Promise<undefined>}
     */
    this._ready = Promise.all([
      new Promise(resolve => firebase.auth().onAuthStateChanged(resolve)),
      idbKeyval.get('accessToken')
    ]).then(([user, token]) => {
      if (user && token) {
        this._accessToken = token;
        this._firebaseUser = user;
      }
    });
  }

  /**
   * Returns the GitHub access token if already logged in. If not logged in,
   * returns null (and will not trigger sign in).
   * @return {!Promise<?string>}
   */
  getAccessTokenIfLoggedIn() {
    return this._ready.then(_ => this._accessToken);
  }

  /**
   * Returns the GitHub access token, triggering sign in if needed.
   * @return {!Promise<string>}
   */
  getAccessToken() {
    return this._ready.then(_ => this._accessToken ? this._accessToken : this.signIn());
  }

  /**
   * Signs in the user to GitHub using the Firebase API.
   * @return {!Promise<string>} The logged in user.
   */
  signIn() {
    return firebase.auth().signInWithPopup(this._provider).then(result => {
      this._accessToken = result.credential.accessToken;
      this._firebaseUser = result.user;
      // A limitation of firebase auth is that it doesn't return an oauth token
      // after a page refresh. We'll get a firebase token, but not an oauth token
      // for GitHub. Since GitHub's tokens never expire, stash the access token in IDB.
      return idbKeyval.set('accessToken', this._accessToken).then(_ => {
        return this._accessToken;
      });
    });
  }

  /**
   * Signs the user out.
   * @return {!Promise<undefined>}
   */
  signOut() {
    return firebase.auth().signOut().then(_ => {
      this._accessToken = null;
      return idbKeyval.delete('accessToken');
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseAuth;
}
