/*
  Wren & Oak Realty — demo account system
  ----------------------------------------
  This is a client-side ONLY demo. Accounts are stored in the browser's
  localStorage on this device — there is no real server, database or
  encryption behind it. It's meant to show the account/login FLOW
  (sign up, sign in, session, sign out) working end to end, not to be
  production authentication. Don't store real passwords in here.
*/
(function (global) {
  "use strict";

  var ACCOUNTS_KEY = 'wo_demo_accounts';
  var SESSION_KEY = 'wo_demo_session';

  function readAccounts() {
    try {
      var raw = localStorage.getItem(ACCOUNTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  var WOAuth = {
    // Creates a new demo account. Returns {ok:true} or {ok:false, reason:'exists'}
    signUp: function (name, email, password) {
      var accounts = readAccounts();
      var key = normalizeEmail(email);
      if (accounts[key]) {
        return { ok: false, reason: 'exists' };
      }
      accounts[key] = {
        name: name,
        email: key,
        password: password, // demo only — never do this in a real app
        createdAt: new Date().toISOString(),
        savedHomes: ['214 Alder Park Ln', '88 Cobble Quarter Row'],
        showings: [
          { address: '48 Union Hill Ct', when: 'Sat, 10:00 AM' }
        ]
      };
      writeAccounts(accounts);
      this.setSession(key);
      return { ok: true };
    },

    // Checks credentials. Returns {ok:true} or {ok:false, reason:'not_found'|'bad_password'}
    signIn: function (email, password) {
      var accounts = readAccounts();
      var key = normalizeEmail(email);
      var account = accounts[key];
      if (!account) {
        return { ok: false, reason: 'not_found' };
      }
      if (account.password !== password) {
        return { ok: false, reason: 'bad_password' };
      }
      this.setSession(key);
      return { ok: true };
    },

    setSession: function (email) {
      localStorage.setItem(SESSION_KEY, normalizeEmail(email));
    },

    signOut: function () {
      localStorage.removeItem(SESSION_KEY);
    },

    // Returns the logged-in account object, or null
    currentAccount: function () {
      var key = localStorage.getItem(SESSION_KEY);
      if (!key) return null;
      var accounts = readAccounts();
      return accounts[key] || null;
    },

    isLoggedIn: function () {
      return !!this.currentAccount();
    }
  };

  global.WOAuth = WOAuth;
})(window);
