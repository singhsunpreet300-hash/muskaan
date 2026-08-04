/* ══════════════════════════════════════════════════
   Bolee — Bhashini  →  window.Bhashini
   ──────────────────────────────────────────────────
   Real Punjabi text-to-speech.

   Browsers essentially never ship a pa-IN voice, so
   speech.js otherwise falls back to a Hindi voice
   reading Gurmukhi — wrong phonology on exactly the
   theth words this app exists to preserve.

   Bhashini is India's government language platform
   (MeitY / ULCA) and has genuine Punjabi TTS and ASR.
   Credentials live server-side in the Netlify function,
   so this module only ever talks to our own proxy.

   Everything here fails soft: if the provider is not
   configured or a call fails, callers fall back to
   browser speech. A missing provider must never
   surface an error to a learner.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var PROXY = '/.netlify/functions/tutor';
  var MAX_CACHE = 60;          // clips held in memory per session
  var MAX_TEXT = 500;

  /* Synthesis is slow and words repeat constantly during practice, so cache
     per session. Bounded, oldest-out — an unbounded blob cache would grow
     without limit across a long session. */
  var cache = {};
  var cacheOrder = [];

  function cacheGet(key) {
    return cache[key] || null;
  }

  function cachePut(key, blob) {
    if (cache[key]) return;
    cache[key] = blob;
    cacheOrder.push(key);
    while (cacheOrder.length > MAX_CACHE) {
      delete cache[cacheOrder.shift()];
    }
  }

  /* base64 → Blob. The proxy returns audio as base64 because JSON can't
     carry binary, and atob gives us a byte string to rebuild from. */
  function base64ToBlob(b64, mime) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'audio/wav' });
  }

  var available = null;   // null = not yet probed

  var Bhashini = {

    /**
     * Is Punjabi TTS configured on this deployment?
     * Probed once via AiTutor's cached status call, so we don't issue a
     * second request. Never rejects — resolves false when unavailable.
     */
    isAvailable: function () {
      if (available !== null) return Promise.resolve(available);

      var probe = (global.AiTutor && global.AiTutor.probeProxy)
        ? global.AiTutor.probeProxy()
        : Promise.resolve({ tts: false });

      return probe.then(function (caps) {
        available = !!(caps && caps.tts);
        return available;
      }).catch(function () {
        available = false;
        return false;
      });
    },

    /**
     * Synthesise Punjabi speech.
     * @param {string} text
     * @returns {Promise<Blob|null>} null whenever it can't be done — callers
     *          treat null as "fall through to the next source", not an error.
     */
    synthesise: function (text, opts) {
      opts = opts || {};
      var value = String(text || '').trim().slice(0, MAX_TEXT);
      if (!value) return Promise.resolve(null);

      var key = (opts.gender || 'female') + '|' + value;
      var hit = cacheGet(key);
      if (hit) return Promise.resolve(hit);

      return this.isAvailable().then(function (ok) {
        if (!ok) return null;

        return fetch(PROXY + '?task=tts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: value, gender: opts.gender || 'female' }),
          signal: opts.signal
        }).then(function (res) {
          if (!res.ok) {
            // A 503 means "not configured" — remember it so we stop asking.
            if (res.status === 503) available = false;
            return null;
          }
          return res.json();
        }).then(function (data) {
          if (!data || !data.audioContent) return null;
          var blob = base64ToBlob(data.audioContent, 'audio/' + (data.format || 'wav'));
          cachePut(key, blob);
          return blob;
        }).catch(function () {
          // Network failure, abort, malformed base64 — all mean "fall through".
          return null;
        });
      });
    },

    /** Drop the session cache — used by the settings reset. */
    clearCache: function () {
      cache = {};
      cacheOrder = [];
    },

    /** Exposed for tests, to force the probe result. */
    _setAvailable: function (v) { available = v; }
  };

  global.Bhashini = Bhashini;

})(window);
