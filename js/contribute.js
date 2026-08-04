/* ══════════════════════════════════════════════════
   Bolee — Contribution  →  window.Contribute
   ──────────────────────────────────────────────────
   Turning a native speaker's knowledge into a record.

   Design bias: never block a submission on a field the
   contributor can't be bothered with. Romanisation is
   auto-generated, dedupe warns instead of refusing, and
   only gurmukhi + meaning are genuinely required.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var GURMUKHI_RANGE = /[਀-੿]/;
  var NON_GURMUKHI_LETTER = /[a-zA-Zऀ-ॿ؀-ۿ]/;

  /* ── Gurmukhi → Latin transliteration ───────────────
     Longest-match-first over a character map. Not strict ISO —
     the goal is a readable romanisation the contributor can
     correct in one edit, not scholarly precision.          */

  var CONSONANTS = {
    'ਕ': 'k',  'ਖ': 'kh', 'ਗ': 'g',  'ਘ': 'gh', 'ਙ': 'ng',
    'ਚ': 'ch', 'ਛ': 'chh','ਜ': 'j',  'ਝ': 'jh', 'ਞ': 'nj',
    'ਟ': 't',  'ਠ': 'th', 'ਡ': 'd',  'ਢ': 'dh', 'ਣ': 'n',
    'ਤ': 't',  'ਥ': 'th', 'ਦ': 'd',  'ਧ': 'dh', 'ਨ': 'n',
    'ਪ': 'p',  'ਫ': 'ph', 'ਬ': 'b',  'ਭ': 'bh', 'ਮ': 'm',
    'ਯ': 'y',  'ਰ': 'r',  'ਲ': 'l',  'ਵ': 'v',  'ੜ': 'rh',
    'ਸ': 's',  'ਹ': 'h',  'ਲ਼': 'l',  'ਸ਼': 'sh',
    'ਖ਼': 'kh', 'ਗ਼': 'gh', 'ਜ਼': 'z',  'ਫ਼': 'f',
    'ਅ': 'a',  'ਆ': 'aa', 'ਇ': 'i',  'ਈ': 'ee', 'ਉ': 'u',
    'ਊ': 'oo', 'ਏ': 'e',  'ਐ': 'ai', 'ਓ': 'o',  'ਔ': 'au',
    'ੲ': '',   'ੳ': '',   'ੴ': 'ik oankaar'
  };

  /* Independent vowels already carry their own vowel — they must not also
     pick up the inherent 'a', or ਅੱਜ comes out "aajj" instead of "ajj". */
  var INDEPENDENT_VOWELS = {
    'ਅ': 1, 'ਆ': 1, 'ਇ': 1, 'ਈ': 1, 'ਉ': 1,
    'ਊ': 1, 'ਏ': 1, 'ਐ': 1, 'ਓ': 1, 'ਔ': 1,
    'ੲ': 1, 'ੳ': 1, 'ੴ': 1
  };

  var VOWEL_SIGNS = {
    'ਾ': 'aa', 'ਿ': 'i',  'ੀ': 'ee', 'ੁ': 'u',
    'ੂ': 'oo', 'ੇ': 'e',  'ੈ': 'ai', 'ੋ': 'o', 'ੌ': 'au'
  };

  var DIGITS = { '੦':'0','੧':'1','੨':'2','੩':'3','੪':'4','੫':'5','੬':'6','੭':'7','੮':'8','੯':'9' };

  /**
   * Rough Gurmukhi → Latin. Handles addak (gemination), tippi/bindi
   * (nasalisation) and the implicit short 'a' after a bare consonant.
   */
  function transliterate(text) {
    if (!text) return '';
    var out = '';
    var chars = Array.from(String(text));
    var pendingGeminate = false;

    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      var next = chars[i + 1];

      if (c === 'ੱ') { pendingGeminate = true; continue; }          // addak
      if (c === 'ੰ' || c === 'ਂ') { out += 'n'; continue; }          // tippi / bindi
      if (c === '੍') { continue; }                                   // virama — cluster, drop the vowel
      if (c === '਼') { continue; }                                   // bare nukta

      if (DIGITS[c]) { out += DIGITS[c]; continue; }

      if (VOWEL_SIGNS[c]) { out += VOWEL_SIGNS[c]; continue; }

      // Consonant + nukta forms a distinct letter (ਜ਼, ਖ਼ …) — look ahead.
      var combined = next === '਼' ? c + next : null;
      if (combined && CONSONANTS[combined]) {
        out += applyGeminate(CONSONANTS[combined], pendingGeminate);
        pendingGeminate = false;
        i++;
        out += implicitA(chars, i);
        continue;
      }

      if (CONSONANTS[c]) {
        out += applyGeminate(CONSONANTS[c], pendingGeminate);
        pendingGeminate = false;
        if (!INDEPENDENT_VOWELS[c]) out += implicitA(chars, i);
        continue;
      }

      if (/\s/.test(c)) { out += ' '; continue; }
      if (c === '।' || c === '॥') { out += '.'; continue; }
      // Anything else (Latin already typed, punctuation) passes through.
      if (!GURMUKHI_RANGE.test(c)) out += c;
    }

    return out.replace(/\s+/g, ' ').trim();
  }

  /* The addak doubles the consonant that FOLLOWS it. Repeating the leading
     stop gives the conventional romanisation for aspirates too:
     j → jj (ਮੱਝ majjh), kh → kkh (ਮੱਖਣ makkhan), dh → ddh (ਦੁੱਧ duddh). */
  function applyGeminate(sound, geminate) {
    if (!geminate || !sound) return sound;
    return sound.charAt(0) + sound;
  }

  /* A bare consonant carries an inherent short 'a' unless a vowel sign or
     virama follows. Word-final consonants usually drop it.

     An addak is NOT such a case: in ਮੱਝ the ਮ still carries its 'a' and the
     addak doubles the following ਝ — majjh, not mjjh. */
  function implicitA(chars, idx) {
    var next = chars[idx + 1];
    if (next === undefined) return '';                    // word-final: silent
    if (VOWEL_SIGNS[next]) return '';
    if (next === '੍') return '';                          // virama: consonant cluster
    if (next === 'ੰ' || next === 'ਂ') return '';          // nasal carries its own vowel
    if (/\s/.test(next)) return '';                       // syllable-final
    return 'a';
  }

  /* ── Normalisation for duplicate detection ──────────
     Strip everything optional so ਚੁੱਲ੍ਹਾ and ਚੁਲ੍ਹਾ collide.  */

  function normalise(s) {
    return String(s || '')
      .replace(/[਼੍ੰੱੵਁਂਃ]/g, '')
      .replace(/[ਾ-ੌ]/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  /* ══════════════════════════════════════════════════
     Validation
     ══════════════════════════════════════════════════ */

  var POS_VALUES = ['noun', 'verb', 'adj', 'adv', 'pron', 'interj'];

  function validate(draft) {
    var errors = {};

    var gurmukhi = String(draft.gurmukhi || '').trim();
    if (!gurmukhi) {
      errors.gurmukhi = 'Please write the word in Gurmukhi.';
    } else if (!GURMUKHI_RANGE.test(gurmukhi)) {
      errors.gurmukhi = 'This does not look like Gurmukhi script.';
    } else if (NON_GURMUKHI_LETTER.test(gurmukhi)) {
      // Catches Devanagari or Latin pasted into the Gurmukhi field.
      errors.gurmukhi = 'Please use only Gurmukhi letters here.';
    } else if (gurmukhi.length > 40) {
      errors.gurmukhi = 'That is too long for a single entry.';
    }

    var meaning = String(draft.meaning || '').trim();
    if (!meaning) errors.meaning = 'Please give the English meaning.';
    else if (meaning.length > 120) errors.meaning = 'Keep the meaning short — under 120 characters.';

    if (draft.pos && POS_VALUES.indexOf(draft.pos) === -1) {
      errors.pos = 'Unknown part of speech.';
    }

    if (draft.category && !categoryExists(draft.category)) {
      errors.category = 'Pick one of the listed categories.';
    }

    var exGurmukhi = String((draft.example && draft.example.gurmukhi) || '').trim();
    if (exGurmukhi && !GURMUKHI_RANGE.test(exGurmukhi)) {
      errors.example = 'The example sentence should be in Gurmukhi.';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function categoryExists(id) {
    var cats = global.VOCAB_CATEGORIES || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return true;
    return false;
  }

  /* ══════════════════════════════════════════════════
     Contribute
     ══════════════════════════════════════════════════ */

  var Contribute = {

    POS_VALUES: POS_VALUES,
    transliterate: transliterate,
    normalise: normalise,
    validate: validate,

    /** Blank draft for the form. */
    blank: function () {
      return {
        gurmukhi: '',
        latin: '',
        pos: 'noun',
        meaning: '',
        category: 'home',
        tier: 2,
        dialect: 'common',
        emoji: '',
        example: { gurmukhi: '', latin: '' },
        notes: ''
      };
    },

    /**
     * Look for words that may already cover this entry.
     * Returns matches ranked exact-first — the UI warns, never blocks,
     * because dialect variants are legitimately near-identical.
     */
    findDuplicates: function (gurmukhi, opts) {
      opts = opts || {};
      var target = normalise(gurmukhi);
      if (!target) return Promise.resolve([]);

      return global.Store.getWords().then(function (words) {
        var hits = [];
        words.forEach(function (w) {
          if (opts.excludeId && w.id === opts.excludeId) return;
          if (w.gurmukhi === gurmukhi) {
            hits.push({ word: w, kind: 'exact', score: 1 });
            return;
          }
          var n = normalise(w.gurmukhi);
          if (n && n === target) {
            hits.push({ word: w, kind: 'near', score: 0.9 });
          }
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        return hits;
      });
    },

    /**
     * Submit a word for community review.
     * @param {object} draft
     * @param {Blob} [audioBlob] optional pronunciation recording
     * @returns {Promise<{ok, word}|{ok:false, errors}>}
     */
    submit: function (draft, audioBlob) {
      var check = validate(draft);
      if (!check.valid) return Promise.resolve({ ok: false, errors: check.errors });

      return global.Store.getProfile().then(function (profile) {
        var gurmukhi = String(draft.gurmukhi).trim();
        var word = {
          id: global.Store._uid('w'),
          gurmukhi: gurmukhi,
          latin: String(draft.latin || '').trim() || transliterate(gurmukhi),
          pos: draft.pos || 'noun',
          meaning: String(draft.meaning).trim(),
          category: draft.category || 'home',
          tier: Number(draft.tier) || 2,
          dialect: draft.dialect || 'common',
          emoji: String(draft.emoji || '').trim() || categoryEmoji(draft.category),
          example: {
            gurmukhi: String((draft.example && draft.example.gurmukhi) || '').trim(),
            latin: String((draft.example && draft.example.latin) || '').trim() ||
                   transliterate((draft.example && draft.example.gurmukhi) || '')
          },
          notes: String(draft.notes || '').trim(),
          status: 'pending',
          source: 'community',
          contributorId: profile.id,
          contributorName: profile.name || 'Anonymous',
          hasAudio: false,
          createdAt: new Date().toISOString()
        };

        return global.Store.addWord(word).then(function (saved) {
          if (!audioBlob) return saved;
          return global.Store.audio.put(saved.id, audioBlob)
            .then(function () {
              return global.Store.updateWord(saved.id, { hasAudio: true });
            })
            .catch(function (err) {
              // A failed recording must not lose the word itself.
              console.warn('[Contribute] audio not saved', err);
              return saved;
            });
        });
      }).then(function (saved) {
        return global.Store.creditLedger(saved.contributorId, { submitted: 1 })
          .then(function () {
            return { ok: true, word: saved };
          });
      });
    },

    /** Words this user has submitted, newest first. */
    mySubmissions: function () {
      return global.Store.getProfile().then(function (profile) {
        return global.Store.getWords({ contributorId: profile.id });
      }).then(function (words) {
        return words.sort(function (a, b) {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      });
    }
  };

  function categoryEmoji(categoryId) {
    var cats = global.VOCAB_CATEGORIES || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === categoryId) return cats[i].emoji;
    return '📝';
  }

  global.Contribute = Contribute;

})(window);
