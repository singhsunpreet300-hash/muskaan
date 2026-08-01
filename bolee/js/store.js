/* ══════════════════════════════════════════════════
   Bolee — Storage Adapter  →  window.Store
   ──────────────────────────────────────────────────
   Local-first, but deliberately shaped like a network
   client: EVERY method returns a Promise even though
   localStorage is synchronous. Nothing above this file
   may touch localStorage directly.

   To move to a real backend later, write a second
   object with the same method signatures and swap
   `backend` — the rest of the app doesn't change.

   Audio recordings go to IndexedDB, not localStorage:
   a handful of blobs would blow the ~5MB quota and
   take every contribution down with it.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var NS = 'bolee.v1.';
  var SCHEMA_VERSION = 1;

  var KEYS = {
    version:  NS + 'version',
    words:    NS + 'words',     // contributed words only; seed lives in vocabulary.js
    votes:    NS + 'votes',     // { wordId: [vote, ...] }
    profile:  NS + 'profile',
    progress: NS + 'progress',  // { wordId: srs }
    settings: NS + 'settings'
  };

  var DEFAULT_SETTINGS = {
    mode: 'adult',          // 'adult' | 'kids'
    theme: 'auto',          // 'auto' | 'light' | 'dark'
    dialect: 'all',
    voiceRate: 0.85,
    voiceURI: '',
    showLatin: true,
    apiKey: '',
    model: 'claude-sonnet-5'
  };

  /* ── tiny helpers ───────────────────────────────── */

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function clone(v) {
    return v === undefined ? v : JSON.parse(JSON.stringify(v));
  }

  /* ══════════════════════════════════════════════════
     LocalStorageBackend
     ══════════════════════════════════════════════════ */

  var backend = {

    available: (function () {
      try {
        var k = NS + '__probe';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    })(),

    // In-memory fallback so private-browsing Safari degrades instead of throwing.
    _mem: {},

    read: function (key, fallback) {
      try {
        var raw = this.available ? localStorage.getItem(key) : this._mem[key];
        if (raw == null) return clone(fallback);
        return JSON.parse(raw);
      } catch (e) {
        console.warn('[Store] unreadable key', key, e);
        return clone(fallback);
      }
    },

    write: function (key, value) {
      var raw = JSON.stringify(value);
      try {
        if (this.available) localStorage.setItem(key, raw);
        else this._mem[key] = raw;
        return true;
      } catch (e) {
        // Almost always QuotaExceededError.
        console.error('[Store] write failed for', key, e);
        throw new Error('Storage is full. Export your data and clear some space.');
      }
    },

    remove: function (key) {
      if (this.available) localStorage.removeItem(key);
      else delete this._mem[key];
    }
  };

  /* ══════════════════════════════════════════════════
     AudioStore — IndexedDB, blobs keyed by word id
     ══════════════════════════════════════════════════ */

  var AudioStore = (function () {
    var DB_NAME = 'bolee-audio';
    var STORE = 'clips';
    var dbPromise = null;

    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve, reject) {
        if (!global.indexedDB) return reject(new Error('IndexedDB unavailable'));
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      }).catch(function (err) {
        dbPromise = null;   // let a later call retry
        throw err;
      });
      return dbPromise;
    }

    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(STORE, mode);
          var req = fn(t.objectStore(STORE));
          t.oncomplete = function () { resolve(req && req.result); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        });
      });
    }

    return {
      supported: !!global.indexedDB,
      put: function (wordId, blob) {
        return tx('readwrite', function (s) { return s.put(blob, wordId); });
      },
      get: function (wordId) {
        return tx('readonly', function (s) { return s.get(wordId); })
          .catch(function () { return null; });
      },
      remove: function (wordId) {
        return tx('readwrite', function (s) { return s.delete(wordId); })
          .catch(function () { return null; });
      },
      keys: function () {
        return tx('readonly', function (s) { return s.getAllKeys(); })
          .catch(function () { return []; });
      },
      clear: function () {
        return tx('readwrite', function (s) { return s.clear(); })
          .catch(function () { return null; });
      }
    };
  })();

  /* ══════════════════════════════════════════════════
     Migrations — keyed by the version being upgraded FROM
     ══════════════════════════════════════════════════ */

  var MIGRATIONS = {
    // 0: function (b) { ... }   ← add here when the shape changes
  };

  function migrate() {
    var current = backend.read(KEYS.version, 0);
    if (current === SCHEMA_VERSION) return;
    while (current < SCHEMA_VERSION) {
      var step = MIGRATIONS[current];
      if (step) {
        try {
          step(backend);
        } catch (e) {
          console.error('[Store] migration ' + current + ' failed', e);
          break;
        }
      }
      current++;
    }
    backend.write(KEYS.version, SCHEMA_VERSION);
  }

  /* ══════════════════════════════════════════════════
     Store — the public, always-async surface
     ══════════════════════════════════════════════════ */

  var ready = false;

  var Store = {

    audio: AudioStore,

    init: function () {
      return Promise.resolve().then(function () {
        migrate();
        // Seed a profile on first run so every action has an author.
        var profile = backend.read(KEYS.profile, null);
        if (!profile) {
          backend.write(KEYS.profile, {
            id: uid('user'),
            name: '',
            dialect: 'common',
            reputation: 0,
            role: 'contributor',
            joinedAt: new Date().toISOString(),
            submitted: 0,
            verifiedCount: 0,
            votesCast: 0
          });
        }
        ready = true;
        return true;
      });
    },

    isReady: function () { return ready; },
    storageAvailable: function () { return backend.available; },

    /* ── Words ──────────────────────────────────────
       Seed words come from window.VOCAB and are read-only.
       Contributed words live in localStorage and shadow a
       seed entry if they share an id (never happens today,
       but keeps updateWord total).                       */

    getWords: function (filter) {
      filter = filter || {};
      return Promise.resolve().then(function () {
        var contributed = backend.read(KEYS.words, []);
        var seed = (global.VOCAB || []);
        var overridden = {};
        contributed.forEach(function (w) { overridden[w.id] = true; });

        var all = seed.filter(function (w) { return !overridden[w.id]; })
                      .concat(contributed);

        return all.filter(function (w) {
          if (filter.status && w.status !== filter.status) return false;
          if (filter.category && filter.category !== 'all' && w.category !== filter.category) return false;
          if (filter.tier && String(filter.tier) !== 'all' && w.tier !== Number(filter.tier)) return false;
          if (filter.dialect && filter.dialect !== 'all' && w.dialect !== filter.dialect) return false;
          if (filter.maxTier && w.tier > filter.maxTier) return false;
          if (filter.source && w.source !== filter.source) return false;
          if (filter.contributorId && w.contributorId !== filter.contributorId) return false;
          return true;
        }).map(clone);
      });
    },

    getWord: function (id) {
      return this.getWords().then(function (words) {
        for (var i = 0; i < words.length; i++) if (words[i].id === id) return words[i];
        return null;
      });
    },

    addWord: function (word) {
      return Promise.resolve().then(function () {
        var contributed = backend.read(KEYS.words, []);
        var record = clone(word);
        if (!record.id) record.id = uid('w');
        record.createdAt = record.createdAt || new Date().toISOString();
        contributed.push(record);
        backend.write(KEYS.words, contributed);
        return record;
      });
    },

    updateWord: function (id, patch) {
      return Promise.resolve().then(function () {
        var contributed = backend.read(KEYS.words, []);
        for (var i = 0; i < contributed.length; i++) {
          if (contributed[i].id === id) {
            Object.keys(patch).forEach(function (k) { contributed[i][k] = patch[k]; });
            contributed[i].updatedAt = new Date().toISOString();
            backend.write(KEYS.words, contributed);
            return clone(contributed[i]);
          }
        }
        // Patching a seed word: copy it into the contributed layer first.
        var seed = (global.VOCAB || []).filter(function (w) { return w.id === id; })[0];
        if (!seed) return null;
        var copy = clone(seed);
        Object.keys(patch).forEach(function (k) { copy[k] = patch[k]; });
        copy.updatedAt = new Date().toISOString();
        contributed.push(copy);
        backend.write(KEYS.words, contributed);
        return clone(copy);
      });
    },

    deleteWord: function (id) {
      return Promise.resolve().then(function () {
        var contributed = backend.read(KEYS.words, []).filter(function (w) { return w.id !== id; });
        backend.write(KEYS.words, contributed);
        return AudioStore.remove(id).catch(function () {});
      });
    },

    /* ── Votes ──────────────────────────────────────── */

    getVotes: function (wordId) {
      return Promise.resolve().then(function () {
        var all = backend.read(KEYS.votes, {});
        if (wordId == null) return clone(all);
        return clone(all[wordId] || []);
      });
    },

    addVote: function (wordId, vote) {
      return Promise.resolve().then(function () {
        var all = backend.read(KEYS.votes, {});
        if (!all[wordId]) all[wordId] = [];
        var record = clone(vote);
        record.id = record.id || uid('vote');
        record.createdAt = record.createdAt || new Date().toISOString();
        all[wordId].push(record);
        backend.write(KEYS.votes, all);
        return record;
      });
    },

    /* ── Profile ────────────────────────────────────── */

    getProfile: function () {
      return Promise.resolve(backend.read(KEYS.profile, null));
    },

    updateProfile: function (patch) {
      return Promise.resolve().then(function () {
        var profile = backend.read(KEYS.profile, {}) || {};
        Object.keys(patch).forEach(function (k) { profile[k] = patch[k]; });
        backend.write(KEYS.profile, profile);
        return clone(profile);
      });
    },

    /* ── Progress (spaced repetition state) ─────────── */

    getProgress: function (wordId) {
      return Promise.resolve().then(function () {
        var all = backend.read(KEYS.progress, {});
        if (wordId == null) return clone(all);
        return clone(all[wordId] || null);
      });
    },

    setProgress: function (wordId, srs) {
      return Promise.resolve().then(function () {
        var all = backend.read(KEYS.progress, {});
        all[wordId] = clone(srs);
        backend.write(KEYS.progress, all);
        return clone(srs);
      });
    },

    /* ── Settings ───────────────────────────────────── */

    getSettings: function () {
      return Promise.resolve().then(function () {
        var stored = backend.read(KEYS.settings, {});
        var merged = clone(DEFAULT_SETTINGS);
        Object.keys(stored || {}).forEach(function (k) { merged[k] = stored[k]; });
        return merged;
      });
    },

    setSettings: function (patch) {
      return this.getSettings().then(function (settings) {
        Object.keys(patch).forEach(function (k) { settings[k] = patch[k]; });
        backend.write(KEYS.settings, settings);
        return settings;
      });
    },

    /* ── Export / import ────────────────────────────
       Audio blobs are NOT inlined — the JSON would balloon
       and most of it would be base64. We record which words
       have a clip so an import can flag what's missing.   */

    exportJSON: function () {
      return Promise.all([
        this.getSettings(),
        this.getProfile(),
        AudioStore.keys()
      ]).then(function (parts) {
        var settings = clone(parts[0]);
        delete settings.apiKey;         // never leaves the device in a file
        return JSON.stringify({
          format: 'bolee-export',
          version: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          profile: parts[1],
          settings: settings,
          words: backend.read(KEYS.words, []),
          votes: backend.read(KEYS.votes, {}),
          progress: backend.read(KEYS.progress, {}),
          audioWordIds: parts[2] || []
        }, null, 2);
      });
    },

    importJSON: function (json, opts) {
      opts = opts || {};
      return Promise.resolve().then(function () {
        var data = typeof json === 'string' ? JSON.parse(json) : json;
        if (!data || data.format !== 'bolee-export') {
          throw new Error('Not a Bolee export file.');
        }

        var summary = { words: 0, votes: 0, progress: 0, merged: !!opts.merge };

        if (opts.merge) {
          // Union by id — an imported word never clobbers a local edit.
          var existing = backend.read(KEYS.words, []);
          var seen = {};
          existing.forEach(function (w) { seen[w.id] = true; });
          (data.words || []).forEach(function (w) {
            if (!seen[w.id]) { existing.push(w); summary.words++; }
          });
          backend.write(KEYS.words, existing);

          var votes = backend.read(KEYS.votes, {});
          Object.keys(data.votes || {}).forEach(function (wordId) {
            var have = votes[wordId] || [];
            var ids = {};
            have.forEach(function (v) { ids[v.id] = true; });
            (data.votes[wordId] || []).forEach(function (v) {
              if (!ids[v.id]) { have.push(v); summary.votes++; }
            });
            votes[wordId] = have;
          });
          backend.write(KEYS.votes, votes);

          var progress = backend.read(KEYS.progress, {});
          Object.keys(data.progress || {}).forEach(function (id) {
            if (!progress[id]) { progress[id] = data.progress[id]; summary.progress++; }
          });
          backend.write(KEYS.progress, progress);
        } else {
          backend.write(KEYS.words, data.words || []);
          backend.write(KEYS.votes, data.votes || {});
          backend.write(KEYS.progress, data.progress || {});
          summary.words = (data.words || []).length;
          summary.progress = Object.keys(data.progress || {}).length;
          summary.votes = Object.keys(data.votes || {}).length;
        }

        if (data.profile) backend.write(KEYS.profile, data.profile);
        if (data.settings) {
          // Keep the local API key — it was stripped from the export.
          var local = backend.read(KEYS.settings, {});
          var incoming = clone(data.settings);
          if (local && local.apiKey) incoming.apiKey = local.apiKey;
          backend.write(KEYS.settings, incoming);
        }

        return summary;
      });
    },

    /* ── Reset ─────────────────────────────────────── */

    reset: function (opts) {
      opts = opts || {};
      return Promise.resolve().then(function () {
        backend.remove(KEYS.words);
        backend.remove(KEYS.votes);
        backend.remove(KEYS.progress);
        if (!opts.keepProfile) backend.remove(KEYS.profile);
        if (!opts.keepSettings) backend.remove(KEYS.settings);
        return AudioStore.clear().catch(function () {});
      }).then(function () {
        return Store.init();
      });
    },

    /* exposed for tests */
    _keys: KEYS,
    _uid: uid,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };

  global.Store = Store;

})(window);
