/* ══════════════════════════════════════════════════
   Bolee — AI Tutor  →  window.AiTutor
   ──────────────────────────────────────────────────
   A static site has nowhere to hide a key, so this is
   explicitly bring-your-own-key: the user pastes their
   own Anthropic key in Settings, it stays in their
   browser, and requests go direct from the page.

   That is a real trade-off, not an oversight — the
   Settings UI says so plainly. Anyone deploying this
   for a wider audience should put a proxy in front and
   swap `endpoint` below.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';
  var DEFAULT_MODEL = 'claude-sonnet-5';
  var MAX_TOKENS = 1024;

  function systemPrompt(mode, contextWords) {
    var base = [
      'You are a warm, patient tutor of theth (ਠੇਠ) Punjabi — the rural, unmixed register',
      'of the language, written in Gurmukhi. You help learners in the Bolee app.',
      '',
      'Rules for every reply:',
      '• Write Punjabi in Gurmukhi script, and put a simple romanisation in (brackets)',
      '  immediately after, then the English meaning.',
      '• Prefer theth words over Hindi-Urdu borrowings. If a learner uses a borrowed word,',
      '  gently offer the theth equivalent — e.g. ਪਾਣੀ over "water", ਚੁੱਲ੍ਹਾ over "stove".',
      '• Never invent a word. If you are unsure a word is real Punjabi, say so plainly and',
      '  suggest they add it to the app for community verification.',
      '• Keep replies short. Two or three sentences unless asked for more.'
    ];

    if (mode === 'kids') {
      base.push(
        '',
        'You are talking to a CHILD. Use very simple words and very short sentences.',
        'Be playful and encouraging. Use an emoji or two. Never more than 3 sentences.',
        'Never discuss anything frightening, adult, or upsetting — steer back to words,',
        'animals, food, family and games.'
      );
    } else {
      base.push(
        '',
        'You are talking to an adult learner, often a diaspora Punjabi reconnecting with',
        'the language their grandparents spoke. Where it helps, mention dialect (Majhi,',
        'Malwai, Doabi, Puadhi) and rural usage or idiom.'
      );
    }

    if (contextWords && contextWords.length) {
      base.push('', 'Words the learner is currently studying:');
      contextWords.slice(0, 20).forEach(function (w) {
        base.push('• ' + w.gurmukhi + ' (' + w.latin + ') — ' + w.meaning);
      });
    }

    return base.join('\n');
  }

  /* ── SSE parsing ────────────────────────────────────
     The stream arrives as `event:`/`data:` line pairs split
     arbitrarily across network chunks, so we buffer and only
     consume complete lines.                                */

  function makeStreamParser(onDelta) {
    var buffer = '';
    return function (chunk) {
      buffer += chunk;
      var lines = buffer.split('\n');
      buffer = lines.pop();            // last element may be a partial line

      lines.forEach(function (line) {
        line = line.trim();
        if (!line || line.indexOf('data:') !== 0) return;
        var payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          var event = JSON.parse(payload);
          if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
            onDelta(event.delta.text);
          }
        } catch (e) {
          // A malformed frame shouldn't kill the whole stream.
        }
      });
    };
  }

  var AiTutor = {

    DEFAULT_MODEL: DEFAULT_MODEL,

    /** Is a key configured? The UI uses this to show a setup pointer instead of failing. */
    isConfigured: function () {
      return global.Store.getSettings().then(function (s) {
        return !!(s.apiKey && s.apiKey.trim());
      });
    },

    /**
     * Send a conversation and stream the reply.
     * @param {Array} messages  [{role:'user'|'assistant', content:string}]
     * @param {object} opts     { onToken, mode, contextWords, signal }
     * @returns {Promise<string>} the full reply text
     */
    chat: function (messages, opts) {
      opts = opts || {};

      return global.Store.getSettings().then(function (settings) {
        var key = (settings.apiKey || '').trim();
        if (!key) {
          throw codedError('no-key', 'Add your Anthropic API key in Settings to use the tutor.');
        }

        var body = {
          model: settings.model || DEFAULT_MODEL,
          max_tokens: opts.maxTokens || MAX_TOKENS,
          system: systemPrompt(opts.mode || settings.mode, opts.contextWords),
          messages: messages.map(function (m) {
            return { role: m.role, content: String(m.content) };
          }),
          stream: true
        };

        return fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify(body),
          signal: opts.signal
        });
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (text) {
            throw codedError(httpCode(res.status), friendlyError(res.status, text));
          });
        }

        if (!res.body || !res.body.getReader) {
          // No streaming support — fall back to reading the whole body.
          return res.text().then(function (text) {
            var full = '';
            makeStreamParser(function (t) { full += t; })(text);
            if (opts.onToken && full) opts.onToken(full);
            return full;
          });
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var full = '';
        var feed = makeStreamParser(function (text) {
          full += text;
          if (opts.onToken) opts.onToken(text);
        });

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) return full;
            feed(decoder.decode(result.value, { stream: true }));
            return pump();
          });
        }

        return pump();
      });
    },

    /** "Tell me about this word" from the word detail modal. */
    explainWord: function (word, opts) {
      opts = opts || {};
      var q = 'Tell me about the Punjabi word ' + word.gurmukhi + ' (' + word.latin + '), ' +
              'which means "' + word.meaning + '". Where and how is it used in village Punjabi? ' +
              'Give me one more natural example sentence.';
      return this.chat([{ role: 'user', content: q }], {
        onToken: opts.onToken,
        mode: opts.mode,
        contextWords: [word],
        signal: opts.signal
      });
    },

    /** Check a sentence the learner wrote. */
    checkSentence: function (text, opts) {
      opts = opts || {};
      var q = 'Here is my attempt at a Punjabi sentence:\n\n' + text + '\n\n' +
              'Is it correct? If not, give the corrected version in Gurmukhi with a ' +
              'romanisation, and explain briefly what I got wrong.';
      return this.chat([{ role: 'user', content: q }], {
        onToken: opts.onToken,
        mode: opts.mode,
        signal: opts.signal
      });
    },

    /** Ask about a word a contributor is unsure of, before they submit it. */
    askAboutDraft: function (draft, opts) {
      opts = opts || {};
      var q = 'A contributor wants to add this word to a theth Punjabi dictionary:\n' +
              'Word: ' + draft.gurmukhi + '\n' +
              'Claimed meaning: ' + draft.meaning + '\n\n' +
              'Does this look like a real Punjabi word with that meaning? ' +
              'Mention any spelling issue or dialect note. Be brief and say if you are unsure.';
      return this.chat([{ role: 'user', content: q }], {
        onToken: opts.onToken,
        mode: 'adult',
        signal: opts.signal
      });
    },

    /** Conversation starters shown as chips in the tutor view. */
    suggestions: function (mode) {
      if (mode === 'kids') {
        return [
          'Teach me a fun Punjabi word! 🌟',
          'How do I say "I am hungry"?',
          'What do we call a buffalo in Punjabi?',
          'Give me an easy Punjabi riddle'
        ];
      }
      return [
        'What is the difference between ਦੁੱਖ and ਹੇਰਵਾ?',
        'Teach me three theth words city Punjabis have forgotten',
        'How would my Malwai grandmother say "come inside"?',
        'Give me a Punjabi proverb about farming and explain it'
      ];
    }
  };

  function codedError(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function httpCode(status) {
    if (status === 401 || status === 403) return 'bad-key';
    if (status === 429) return 'rate-limit';
    if (status >= 500) return 'server';
    return 'error';
  }

  function friendlyError(status, text) {
    if (status === 401 || status === 403) {
      return 'That API key was rejected. Check it in Settings.';
    }
    if (status === 429) {
      return 'Rate limited by the API — wait a moment and try again.';
    }
    if (status >= 500) {
      return 'The API is having trouble right now. Try again shortly.';
    }
    // Surface the API's own message when there is one — it's usually the useful part.
    try {
      var parsed = JSON.parse(text);
      if (parsed.error && parsed.error.message) return parsed.error.message;
    } catch (e) {}
    return 'Request failed (' + status + ').';
  }

  global.AiTutor = AiTutor;

})(window);
