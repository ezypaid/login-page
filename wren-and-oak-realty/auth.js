/*
  Wren & Oak Realty — client-side account system
  -----------------------------------------------
  Registration, login, session and logout, all running in the browser.
  Accounts live in this browser's localStorage — there is no server or
  database behind it, so it is a working DEMO of the flow, not production
  authentication. Passwords are salted and hashed (PBKDF2 / SHA-256) before
  being stored, but anyone with access to the browser can still read the
  stored data. For a real launch, move this to a backend.

  Public API (window.WOAuth):
    await WOAuth.signUp(name, email, password, remember)
        -> {ok:true} | {ok:false, reason:'exists'|'invalid'|'weak_password'|'unsupported'}
    await WOAuth.signIn(email, password, remember)
        -> {ok:true} | {ok:false, reason:'not_found'|'bad_password'|'locked'|'unsupported', retryIn?:seconds}
    WOAuth.signOut()
    WOAuth.currentAccount()  -> account object (no password data) or null
    WOAuth.isLoggedIn()      -> boolean
*/
(function (global) {
  "use strict";

  var ACCOUNTS_KEY = 'wo_demo_accounts';
  var SESSION_KEY  = 'wo_demo_session';
  var ATTEMPTS_KEY = 'wo_demo_attempts';

  var PBKDF2_ITERATIONS = 150000;
  var SESSION_DAYS_REMEMBER = 30;
  var SESSION_HOURS_DEFAULT = 8;
  var MAX_ATTEMPTS = 5;
  var LOCK_SECONDS = 60;
  var MIN_PASSWORD = 8;

  /* ---------- storage helpers ---------- */

  function readJSON(store, key, fallback) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function readAccounts() {
    var data = readJSON(localStorage, ACCOUNTS_KEY, {});
    return (data && typeof data === 'object') ? data : {};
  }

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ---------- password hashing ---------- */

  function hasCrypto() {
    return !!(global.crypto && global.crypto.subtle && global.TextEncoder);
  }

  function toHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function fromHex(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
  }

  function newSalt() {
    return toHex(global.crypto.getRandomValues(new Uint8Array(16)));
  }

  function hashPassword(password, saltHex) {
    var enc = new TextEncoder();
    return global.crypto.subtle
      .importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return global.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
          key,
          256
        );
      })
      .then(toHex);
  }

  // Compare two hex strings without bailing out at the first difference.
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  /* ---------- sessions ---------- */

  function setSession(email, remember) {
    var session = {
      email: normalizeEmail(email),
      expires: Date.now() + (remember
        ? SESSION_DAYS_REMEMBER * 24 * 3600 * 1000
        : SESSION_HOURS_DEFAULT * 3600 * 1000)
    };
    clearSession();
    // "Remember me" persists across browser restarts; otherwise it ends with the tab.
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function readSession() {
    var session = readJSON(sessionStorage, SESSION_KEY, null) || readJSON(localStorage, SESSION_KEY, null);
    if (!session || typeof session !== 'object' || !session.email) return null;
    if (!session.expires || session.expires < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  }

  /* ---------- brute-force throttle ---------- */

  function getAttempts() {
    return readJSON(localStorage, ATTEMPTS_KEY, {});
  }

  function lockRemaining(key) {
    var rec = getAttempts()[key];
    if (!rec || !rec.lockedUntil) return 0;
    var left = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
    return left > 0 ? left : 0;
  }

  function recordFailure(key) {
    var all = getAttempts();
    var rec = all[key] || { count: 0, lockedUntil: 0 };
    if (rec.lockedUntil && rec.lockedUntil < Date.now()) {
      rec = { count: 0, lockedUntil: 0 };
    }
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCK_SECONDS * 1000;
      rec.count = 0;
    }
    all[key] = rec;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  }

  function clearFailures(key) {
    var all = getAttempts();
    delete all[key];
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  }

  /* ---------- public API ---------- */

  var WOAuth = {
    signUp: function (name, email, password, remember) {
      var cleanName = (name || '').trim();
      var key = normalizeEmail(email);

      if (!cleanName || !isValidEmail(key)) {
        return Promise.resolve({ ok: false, reason: 'invalid' });
      }
      if (!password || password.length < MIN_PASSWORD) {
        return Promise.resolve({ ok: false, reason: 'weak_password' });
      }
      if (!hasCrypto()) {
        return Promise.resolve({ ok: false, reason: 'unsupported' });
      }
      if (readAccounts()[key]) {
        return Promise.resolve({ ok: false, reason: 'exists' });
      }

      var salt = newSalt();
      return hashPassword(password, salt).then(function (hash) {
        // Re-read in case another tab registered the same email meanwhile.
        var accounts = readAccounts();
        if (accounts[key]) return { ok: false, reason: 'exists' };

        accounts[key] = {
          name: cleanName,
          email: key,
          salt: salt,
          hash: hash,
          iterations: PBKDF2_ITERATIONS,
          createdAt: new Date().toISOString(),
          savedHomes: ['214 Alder Park Ln', '88 Cobble Quarter Row'],
          showings: [{ address: '48 Union Hill Ct', when: 'Sat, 10:00 AM' }]
        };
        writeAccounts(accounts);
        setSession(key, !!remember);
        return { ok: true };
      });
    },

    signIn: function (email, password, remember) {
      var key = normalizeEmail(email);

      var left = lockRemaining(key);
      if (left > 0) {
        return Promise.resolve({ ok: false, reason: 'locked', retryIn: left });
      }
      if (!hasCrypto()) {
        return Promise.resolve({ ok: false, reason: 'unsupported' });
      }

      var accounts = readAccounts();
      var account = accounts[key];
      if (!account) {
        recordFailure(key);
        return Promise.resolve({ ok: false, reason: 'not_found' });
      }

      // Accounts created by the earlier demo version stored the password in
      // plain text. Check it once, then upgrade the record to a salted hash.
      if (typeof account.password === 'string' && !account.hash) {
        if (account.password !== password) {
          recordFailure(key);
          return Promise.resolve({ ok: false, reason: 'bad_password' });
        }
        var newS = newSalt();
        return hashPassword(password, newS).then(function (h) {
          var fresh = readAccounts();
          if (fresh[key]) {
            fresh[key].salt = newS;
            fresh[key].hash = h;
            fresh[key].iterations = PBKDF2_ITERATIONS;
            delete fresh[key].password;
            writeAccounts(fresh);
          }
          clearFailures(key);
          setSession(key, !!remember);
          return { ok: true };
        });
      }

      return hashPassword(password, account.salt).then(function (hash) {
        if (!safeEqual(hash, account.hash)) {
          recordFailure(key);
          return { ok: false, reason: 'bad_password' };
        }
        clearFailures(key);
        setSession(key, !!remember);
        return { ok: true };
      });
    },

    signOut: function () {
      clearSession();
    },

    // Returns the logged-in account (without password data), or null.
    currentAccount: function () {
      var session = readSession();
      if (!session) return null;
      var account = readAccounts()[session.email];
      if (!account) {
        clearSession();
        return null;
      }
      return {
        name: account.name,
        email: account.email,
        createdAt: account.createdAt,
        savedHomes: account.savedHomes || [],
        showings: account.showings || []
      };
    },

    isLoggedIn: function () {
      return !!this.currentAccount();
    }
  };

  global.WOAuth = WOAuth;
})(window);
