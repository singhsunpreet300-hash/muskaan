/* ══════════════════════════════════════════════════
   Bolee — Practice  →  window.Practice
   ──────────────────────────────────────────────────
   SM-2-lite spaced repetition plus a session builder.

   The kids/adult split lives here, not just in CSS:
   kids sessions only ever produce tap-to-answer
   questions, so a child is never shown a text input.

   Only `verified` words are ever taught — a pending
   submission must clear the review queue first.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var DAY = 24 * 60 * 60 * 1000;

  var SRS = {
    MIN_EASE: 1.3,
    MAX_EASE: 2.8,         // uncapped ease compounds into absurd intervals
    START_EASE: 2.5,
    FIRST_INTERVAL: 1,     // days, after a correct first answer
    SECOND_INTERVAL: 3,
    LAPSE_INTERVAL: 1,     // wrong answer sends it back to tomorrow
    MAX_INTERVAL: 365,     // a word must resurface at least once a year
    EASE_UP: 0.1,
    EASE_DOWN: 0.2
  };

  /* Kids never see these; adults get all of them. */
  var QUESTION_TYPES = {
    kids: ['audio-to-emoji', 'meaning-to-gurmukhi', 'gurmukhi-to-emoji'],
    adult: ['meaning-to-typed', 'gurmukhi-to-meaning', 'example-blank', 'say-it', 'meaning-to-gurmukhi']
  };

  function newCard() {
    return {
      reps: 0,
      lapses: 0,
      ease: SRS.START_EASE,
      interval: 0,
      dueAt: null,
      lastSeenAt: null
    };
  }

  /* ══════════════════════════════════════════════════
     Grading — pure, so tests can hammer it without a DOM
     ══════════════════════════════════════════════════ */

  /**
   * @param {object|null} card  existing SRS state (null = brand new)
   * @param {boolean} correct
   * @param {number} [now]      epoch ms, injectable for tests
   * @returns {object} the next SRS state
   */
  function grade(card, correct, now) {
    now = typeof now === 'number' ? now : Date.now();
    var next = card ? JSON.parse(JSON.stringify(card)) : newCard();

    if (correct) {
      next.reps += 1;
      if (next.reps === 1)       next.interval = SRS.FIRST_INTERVAL;
      else if (next.reps === 2)  next.interval = SRS.SECOND_INTERVAL;
      else                       next.interval = Math.round(next.interval * next.ease);
      // Both caps matter: without them eight correct answers schedule a word
      // 1900+ days out, which deletes it from the learner's life.
      next.interval = Math.min(next.interval, SRS.MAX_INTERVAL);
      next.ease = Math.min(SRS.MAX_EASE, Math.round((next.ease + SRS.EASE_UP) * 100) / 100);
    } else {
      next.lapses += 1;
      next.reps = 0;
      next.interval = SRS.LAPSE_INTERVAL;
      next.ease = Math.max(SRS.MIN_EASE, Math.round((next.ease - SRS.EASE_DOWN) * 100) / 100);
    }

    next.lastSeenAt = new Date(now).toISOString();
    next.dueAt = new Date(now + next.interval * DAY).toISOString();
    return next;
  }

  function isDue(card, now) {
    if (!card || !card.dueAt) return true;          // never seen → always due
    now = typeof now === 'number' ? now : Date.now();
    return new Date(card.dueAt).getTime() <= now;
  }

  /* ══════════════════════════════════════════════════
     Session building
     ══════════════════════════════════════════════════ */

  function shuffle(arr, rand) {
    rand = rand || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Pick `n` distractors from the same category when possible — a quiz where
      the wrong answers come from another category is trivially guessable.

      When the choices are rendered as emoji, a distractor sharing the target's
      emoji makes the question unanswerable: the child sees two identical tiles
      and no correct answer. The seed data is now collision-free per category,
      but contributors will inevitably reuse emoji, so guard here too. */
  function pickDistractors(word, pool, n, opts) {
    opts = opts || {};
    var eligible = pool.filter(function (w) {
      if (w.id === word.id) return false;
      if (opts.distinctEmoji && w.emoji === word.emoji) return false;
      return true;
    });

    var sameCategory = eligible.filter(function (w) { return w.category === word.category; });
    var others = eligible.filter(function (w) { return w.category !== word.category; });

    var picks = shuffle(sameCategory).slice(0, n);
    if (picks.length < n) picks = picks.concat(shuffle(others).slice(0, n - picks.length));

    // Emoji must also be distinct among the distractors themselves.
    if (opts.distinctEmoji) {
      var seen = {};
      seen[word.emoji] = true;
      picks = picks.filter(function (w) {
        if (seen[w.emoji]) return false;
        seen[w.emoji] = true;
        return true;
      });
    }
    return picks;
  }

  function buildQuestion(word, pool, type) {
    var q = { wordId: word.id, word: word, type: type };

    switch (type) {
      case 'audio-to-emoji':
        q.prompt = { kind: 'audio', text: word.gurmukhi };
        q.choices = shuffle(pickDistractors(word, pool, 3, { distinctEmoji: true }).concat([word]))
          .map(function (w) {
            return { id: w.id, emoji: w.emoji, label: w.meaning, correct: w.id === word.id };
          });
        break;

      case 'gurmukhi-to-emoji':
        q.prompt = { kind: 'gurmukhi', text: word.gurmukhi };
        q.choices = shuffle(pickDistractors(word, pool, 3, { distinctEmoji: true }).concat([word]))
          .map(function (w) {
            return { id: w.id, emoji: w.emoji, label: w.meaning, correct: w.id === word.id };
          });
        break;

      case 'meaning-to-gurmukhi':
        q.prompt = { kind: 'text', text: word.meaning };
        q.choices = shuffle(pickDistractors(word, pool, 3).concat([word]))
          .map(function (w) {
            return { id: w.id, gurmukhi: w.gurmukhi, latin: w.latin, correct: w.id === word.id };
          });
        break;

      case 'gurmukhi-to-meaning':
        q.prompt = { kind: 'gurmukhi', text: word.gurmukhi, latin: word.latin };
        q.choices = shuffle(pickDistractors(word, pool, 3).concat([word]))
          .map(function (w) {
            return { id: w.id, label: w.meaning, correct: w.id === word.id };
          });
        break;

      case 'meaning-to-typed':
        q.prompt = { kind: 'text', text: word.meaning, hint: word.pos };
        q.answer = word.gurmukhi;
        q.acceptLatin = word.latin;
        break;

      case 'example-blank':
        q.prompt = {
          kind: 'blank',
          text: blankOut(word.example.gurmukhi, word.gurmukhi),
          latin: word.example.latin,
          meaning: word.meaning
        };
        q.answer = word.gurmukhi;
        q.acceptLatin = word.latin;
        break;

      case 'say-it':
        q.prompt = { kind: 'say', text: word.gurmukhi, latin: word.latin, meaning: word.meaning };
        q.answer = word.gurmukhi;
        q.acceptLatin = word.latin;
        break;
    }

    return q;
  }

  /** Replace the target word in its example sentence with a blank. Falls back to
      appending a blank if the sentence inflects the word (very common in Punjabi). */
  function blankOut(sentence, word) {
    if (!sentence) return '____';
    if (sentence.indexOf(word) !== -1) return sentence.split(word).join('____');
    // Inflected form — blank the closest-matching token by shared prefix.
    var tokens = sentence.split(/\s+/);
    var bestIdx = -1, bestScore = 0;
    tokens.forEach(function (tok, i) {
      var score = commonPrefix(tok, word);
      if (score > bestScore && score >= 2) { bestScore = score; bestIdx = i; }
    });
    if (bestIdx >= 0) {
      tokens[bestIdx] = '____';
      return tokens.join(' ');
    }
    return sentence;
  }

  function commonPrefix(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a[i] === b[i]) i++;
    return i;
  }

  var Practice = {

    SRS: SRS,
    QUESTION_TYPES: QUESTION_TYPES,

    newCard: newCard,
    grade: grade,
    isDue: isDue,
    blankOut: blankOut,
    _shuffle: shuffle,

    /**
     * Build a practice session.
     * @param {object} opts
     *   mode      'kids' | 'adult'
     *   category  category id or 'all'
     *   tier      1|2|3 or 'all'   (kids mode is capped at tier 2 regardless)
     *   size      number of questions (default 10)
     *   dialect   dialect id or 'all'
     * @returns {Promise<{questions: Array, pool: Array, stats: object}>}
     */
    buildSession: function (opts) {
      opts = opts || {};
      var mode = opts.mode === 'kids' ? 'kids' : 'adult';
      var size = opts.size || 10;
      var now = Date.now();

      var filter = {
        status: 'verified',
        category: opts.category || 'all',
        tier: opts.tier || 'all',
        dialect: opts.dialect || 'all'
      };
      // A six-year-old shouldn't be quizzed on ਹੇਰਵਾ.
      if (mode === 'kids') filter.maxTier = 2;

      return Promise.all([
        global.Store.getWords(filter),
        global.Store.getProgress()
      ]).then(function (parts) {
        var pool = parts[0];
        var progress = parts[1] || {};

        if (pool.length < 4) {
          return { questions: [], pool: pool, stats: { due: 0, fresh: 0, tooFew: true } };
        }

        // Due cards first — that's the whole point of spaced repetition —
        // then unseen words, then anything else to fill the session.
        var due = [], fresh = [], rest = [];
        pool.forEach(function (w) {
          var card = progress[w.id];
          if (!card) fresh.push(w);
          else if (isDue(card, now)) due.push(w);
          else rest.push(w);
        });

        due.sort(function (a, b) {
          return new Date(progress[a.id].dueAt) - new Date(progress[b.id].dueAt);
        });

        var selected = due.concat(shuffle(fresh)).slice(0, size);
        if (selected.length < size) {
          selected = selected.concat(shuffle(rest).slice(0, size - selected.length));
        }

        var types = QUESTION_TYPES[mode];
        // Drop say-it when the browser can't listen, rather than dead-ending a card.
        if (mode === 'adult' && !(global.SpeechEngine && global.SpeechEngine.canListen)) {
          types = types.filter(function (t) { return t !== 'say-it'; });
        }
        // ...and drop audio prompts when there's no speech synthesis at all.
        if (mode === 'kids' && !(global.SpeechEngine && global.SpeechEngine.canSpeak)) {
          types = types.filter(function (t) { return t !== 'audio-to-emoji'; });
        }

        var questions = shuffle(selected).map(function (word, i) {
          return buildQuestion(word, pool, types[i % types.length]);
        });

        return {
          questions: questions,
          pool: pool,
          stats: { due: due.length, fresh: fresh.length, total: pool.length }
        };
      });
    },

    /**
     * Check a free-text answer. Accepts the Gurmukhi form or the romanisation,
     * because adults practising on a phone often can't type Gurmukhi.
     */
    checkAnswer: function (question, given) {
      var value = String(given || '').trim();
      if (!value) return { correct: false, reason: 'empty' };

      var expected = String(question.answer || '').trim();
      if (value === expected) return { correct: true, matched: 'gurmukhi' };

      var normGiven = normalise(value);
      if (normGiven === normalise(expected)) return { correct: true, matched: 'gurmukhi-loose' };

      if (question.acceptLatin) {
        var latin = String(question.acceptLatin).toLowerCase().replace(/[^a-z]/g, '');
        var givenLatin = value.toLowerCase().replace(/[^a-z]/g, '');
        if (givenLatin && givenLatin === latin) return { correct: true, matched: 'latin' };

        /* Romanisation is genuinely unstandardised, so one edit is forgiven —
           but only on longer words, and only when the first letter matches.
           An unconditional edit distance of 1 accepted "char" for "ghar", and
           ਚਾਰ chaar is a real word: the app was confirming a wrong answer. */
        if (givenLatin && latin.length >= 5 &&
            givenLatin.charAt(0) === latin.charAt(0) &&
            levenshtein(givenLatin, latin) <= 1) {
          return { correct: true, matched: 'latin-close' };
        }
      }

      return { correct: false, reason: 'mismatch' };
    },

    /** Persist the result of one answered question. */
    record: function (wordId, correct) {
      return global.Store.getProgress(wordId).then(function (card) {
        var next = grade(card, correct);
        return global.Store.setProgress(wordId, next).then(function () { return next; });
      });
    },

    /** Counts for the progress view. */
    summary: function () {
      var now = Date.now();
      return Promise.all([
        global.Store.getWords({ status: 'verified' }),
        global.Store.getProgress()
      ]).then(function (parts) {
        var pool = parts[0], progress = parts[1] || {};
        var seen = 0, dueNow = 0, learned = 0;
        pool.forEach(function (w) {
          var card = progress[w.id];
          if (!card) return;
          seen++;
          if (isDue(card, now)) dueNow++;
          // "Learned" = survived to a week-plus interval.
          if (card.interval >= 7) learned++;
        });
        return {
          total: pool.length,
          seen: seen,
          due: dueNow,
          learned: learned,
          unseen: pool.length - seen
        };
      });
    }
  };

  /* ── text helpers ───────────────────────────────── */

  /* Strip Gurmukhi diacritics so a missing sihari/bindi doesn't fail an
     otherwise-correct answer. Same normalisation contribute.js uses for dedupe. */
  function normalise(s) {
    return String(s)
      .replace(/[਼੍ੰੱੵ]/g, '')  // nukta, virama, tippi, addak, wawa
      .replace(/[ਾ-ੌ]/g, '')                    // vowel signs
      .replace(/[ਁਂਃ]/g, '')               // adak bindi, bindi, visarga
      .replace(/\s+/g, '')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur.slice();
    }
    return prev[b.length];
  }

  Practice._normalise = normalise;
  Practice._levenshtein = levenshtein;
  Practice._pickDistractors = pickDistractors;

  global.Practice = Practice;

})(window);
