/* ══════════════════════════════════════════════════
   Bolee — Translation  →  window.Translate
   ──────────────────────────────────────────────────
   A source ladder, mirroring the one in speech.js:

     1. local  — the shipped dictionary and phrasebook
     2. Bhashini IndicTrans2 — free, purpose-built for
        Indic languages, better at Punjabi than a
        general LLM
     3. Claude — handles anything novel
     4. a handled message

   The local rung carries more weight than it sounds.
   Single words and common phrases are most of what a
   learner types, and those answers already ship with
   the app: instant, free, offline, and correct because
   a human wrote them.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var PROXY = '/.netlify/functions/tutor';

  /* Same normalisation the contribution dedupe uses, so "ਚੁੱਲ੍ਹਾ" typed
     without its addak still finds the entry. */
  function normalise(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[਼੍ੰੱੵਁਂਃ]/g, '')
      .replace(/[ਾ-ੌ]/g, '')
      .replace(/[^਀-੿a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isGurmukhi(text) {
    return /[਀-੿]/.test(text);
  }

  /* ── rung 1: what we already ship ─────────────── */

  function localLookup(text, direction) {
    var query = normalise(text);
    if (!query) return null;

    var toPunjabi = direction !== 'pa-en';
    var words = global.VOCAB || [];
    var phrases = global.BOLEE_PHRASES || [];

    // Phrases first — a whole phrase match beats a word match.
    for (var i = 0; i < phrases.length; i++) {
      var p = phrases[i];
      if (normalise(p.gurmukhi) === query ||
          normalise(p.english) === query ||
          normalise(p.latin) === query) {
        return {
          gurmukhi: p.gurmukhi,
          latin: p.latin,
          english: p.english,
          note: p.note || '',
          source: 'phrasebook'
        };
      }
    }

    for (var j = 0; j < words.length; j++) {
      var w = words[j];
      var hit = toPunjabi
        ? normalise(w.meaning) === query ||
          normalise(w.meaning.split(',')[0]) === query
        : normalise(w.gurmukhi) === query || normalise(w.latin) === query;

      // Match either direction regardless — a learner may type either.
      if (!hit) {
        hit = normalise(w.gurmukhi) === query ||
              normalise(w.latin) === query ||
              normalise(w.meaning) === query ||
              normalise(w.meaning.split(',')[0]) === query;
      }

      if (hit) {
        return {
          gurmukhi: w.gurmukhi,
          latin: w.latin,
          english: w.meaning,
          note: 'In the dictionary — ' + w.pos + ', ' + w.category + '.',
          example: w.example,
          wordId: w.id,
          source: 'dictionary'
        };
      }
    }

    return null;
  }

  /* ── rung 2: Bhashini IndicTrans2 ─────────────── */

  function bhashiniTranslate(text, direction, signal) {
    return global.AiTutor.probeProxy().then(function (caps) {
      if (!caps.nmt) return null;

      return fetch(PROXY + '?task=translate-nmt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: text, direction: direction || 'en-pa' }),
        signal: signal
      }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
      }).then(function (data) {
        if (!data || !data.translated) return null;

        var toPunjabi = direction !== 'pa-en';
        var gurmukhi = toPunjabi ? data.translated : text;
        var english = toPunjabi ? text : data.translated;

        return {
          gurmukhi: gurmukhi,
          latin: global.Contribute ? global.Contribute.transliterate(gurmukhi) : '',
          english: english,
          note: '',
          source: 'bhashini'
        };
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  }

  var Translate = {

    _normalise: normalise,
    _localLookup: localLookup,

    /**
     * Translate, walking the ladder until something answers.
     *
     * @param {string} text
     * @param {object} [opts] { direction: 'en-pa'|'pa-en', signal, localOnly }
     * @returns {Promise<{gurmukhi, latin, english, note, source}>}
     */
    run: function (text, opts) {
      opts = opts || {};
      var value = String(text || '').trim();
      if (!value) return Promise.reject(coded('empty', 'Type something to translate.'));

      // Infer direction from the script when the caller has not decided.
      var direction = opts.direction || (isGurmukhi(value) ? 'pa-en' : 'en-pa');

      // 1. Local — no network at all.
      var local = localLookup(value, direction);
      if (local) return Promise.resolve(local);

      if (opts.localOnly) {
        return Promise.reject(coded('not-local', 'That is not in the offline dictionary yet.'));
      }

      // 2. Bhashini, then 3. Claude.
      return bhashiniTranslate(value, direction, opts.signal).then(function (result) {
        if (result) return result;

        if (!global.AiTutor) {
          throw coded('unavailable', 'Translation is not available offline for that phrase.');
        }

        return global.AiTutor.translate(value, {
          direction: direction,
          signal: opts.signal
        }).then(function (r) {
          r.source = 'claude';
          return r;
        }).catch(function (err) {
          // 4. Nothing answered — say so plainly rather than throwing a stack.
          if (err.code === 'no-key') {
            throw coded('unavailable',
              'That phrase is not in the offline dictionary, and no translation provider is set up on this deployment.');
          }
          throw err;
        });
      });
    },

    /** Can we answer this without any network? Used to show an offline badge. */
    hasLocal: function (text, direction) {
      return !!localLookup(text, direction);
    }
  };

  function coded(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  global.Translate = Translate;

})(window);
