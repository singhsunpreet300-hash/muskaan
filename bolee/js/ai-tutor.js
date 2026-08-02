/* ══════════════════════════════════════════════════
   Bolee — AI Tutor  →  window.AiTutor
   ──────────────────────────────────────────────────
   Two ways to reach Claude, resolved at runtime:

     1. the deployment's own proxy (Netlify function),
        which holds the key server-side so every visitor
        gets the tutor without supplying anything
     2. a key the user pasted in Settings, sent direct
        from the browser

   The proxy is tried first and its availability is
   probed once and cached. On a host without functions
   (GitHub Pages) the probe fails and we fall back to
   the user key path — so the same build works on both.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var PROXY_ENDPOINT = '/.netlify/functions/tutor';
  var DIRECT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';
  var DEFAULT_MODEL = 'claude-sonnet-5';
  var MAX_TOKENS = 1024;

  var NO_PROVIDERS = { chat: false, translate: false, tts: false };

  /* How long a probe result is trusted. Short enough that turning the env
     vars on in Netlify shows up quickly, long enough that a host without
     functions isn't re-probed on every page load — each miss is a visible
     404 in the console, and users read that as the app being broken. */
  var PROBE_TTL_MS = 10 * 60 * 1000;

  var proxyProbe = null;   // in-flight / resolved promise for this page load

  function probeProxy() {
    if (proxyProbe) return proxyProbe;

    proxyProbe = global.Store.getSettings().then(function (settings) {
      var cached = settings.providerCaps;
      var age = Date.now() - (settings.providerCapsAt || 0);
      if (cached && age < PROBE_TTL_MS) return cached;

      return fetch(PROXY_ENDPOINT + '?task=status', { method: 'GET' })
        .then(function (res) { return res.ok ? res.json() : NO_PROVIDERS; })
        .catch(function () { return NO_PROVIDERS; })
        .then(function (caps) {
          var value = {
            chat: !!caps.chat,
            translate: !!caps.translate,
            tts: !!caps.tts
          };
          // Remember it so the next page load doesn't repeat the request.
          return global.Store.setSettings({
            providerCaps: value,
            providerCapsAt: Date.now()
          }).then(function () { return value; })
            .catch(function () { return value; });
        });
    }).catch(function () {
      // Storage unavailable (private browsing) — probing still works, just
      // once per page load rather than once per TTL.
      return NO_PROVIDERS;
    });

    return proxyProbe;
  }

  /** Force the next probe to hit the network — used after a settings change. */
  function resetProbe() {
    proxyProbe = null;
    return global.Store.setSettings({ providerCapsAt: 0 }).catch(function () {});
  }

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

    probeProxy: probeProxy,
    resetProbe: resetProbe,

    /** True when the tutor can run at all — via the proxy or a user key. */
    isConfigured: function () {
      return Promise.all([probeProxy(), global.Store.getSettings()])
        .then(function (parts) {
          return !!parts[0].chat || !!(parts[1].apiKey && parts[1].apiKey.trim());
        });
    },

    /** Which route is in play — the Settings UI explains the difference. */
    provider: function () {
      return Promise.all([probeProxy(), global.Store.getSettings()])
        .then(function (parts) {
          if (parts[0].chat) return 'proxy';
          if (parts[1].apiKey && parts[1].apiKey.trim()) return 'user-key';
          return 'none';
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

      return Promise.all([probeProxy(), global.Store.getSettings()])
        .then(function (parts) {
          var caps = parts[0];
          var settings = parts[1];
          var key = (settings.apiKey || '').trim();

          var body = {
            model: settings.model || DEFAULT_MODEL,
            max_tokens: opts.maxTokens || MAX_TOKENS,
            system: systemPrompt(opts.mode || settings.mode, opts.contextWords),
            messages: messages.map(function (m) {
              return { role: m.role, content: String(m.content) };
            }),
            stream: true
          };

          // Preferred: this deployment's proxy, so the visitor needs nothing.
          if (caps.chat) {
            return fetch(PROXY_ENDPOINT + '?task=chat', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
              signal: opts.signal
            });
          }

          if (!key) {
            throw codedError('no-key',
              'The tutor is not set up on this deployment. Add your own Anthropic API key in Settings to use it.');
          }

          return fetch(DIRECT_ENDPOINT, {
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
            throw codedError(httpCode(res.status, text), friendlyError(res.status, text));
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

    /**
     * Translate between English and Punjabi.
     * @param {string} text
     * @param {object} [opts] { direction: 'en-pa' | 'pa-en', signal }
     * @returns {Promise<{gurmukhi, latin, english, note}>}
     */
    translate: function (text, opts) {
      opts = opts || {};
      var value = String(text || '').trim();
      if (!value) return Promise.reject(codedError('empty', 'Nothing to translate.'));

      return probeProxy().then(function (caps) {
        if (caps.translate) {
          return fetch(PROXY_ENDPOINT + '?task=translate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: value, direction: opts.direction || 'en-pa' }),
            signal: opts.signal
          }).then(function (res) {
            if (!res.ok) {
              return res.json().catch(function () { return {}; }).then(function (body) {
                throw codedError(body.code || 'error', body.error || 'Translation failed.');
              });
            }
            return res.json();
          });
        }

        /* No proxy — do it over the chat path with a user key, asking for the
           same JSON shape so the caller gets one consistent result either way. */
        var toPunjabi = opts.direction !== 'pa-en';
        var prompt = (toPunjabi
          ? 'Translate this English into theth (rural) Punjabi. '
          : 'Translate this Punjabi into English. ') +
          'Reply with ONLY a JSON object, no prose and no code fence: ' +
          '{"gurmukhi":"…","latin":"…","english":"…","note":"…"} ' +
          'Prefer authentic rural vocabulary over Hindi-Urdu borrowings. ' +
          '"note" is one short usage or dialect remark, or "".\n\n' + value;

        return AiTutor.chat([{ role: 'user', content: prompt }], { signal: opts.signal })
          .then(function (reply) {
            var parsed = parseJsonReply(reply);
            if (!parsed || !parsed.gurmukhi) {
              throw codedError('unparseable', 'Could not read the translation.');
            }
            return parsed;
          });
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

  /* The model is instructed to return bare JSON; tolerate a code fence or
     surrounding prose anyway rather than failing the whole translation. */
  function parseJsonReply(text) {
    var cleaned = String(text || '')
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      var match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try { return JSON.parse(match[0]); } catch (e2) { return null; }
    }
  }

  function httpCode(status, text) {
    // The proxy sends its own code; prefer it over guessing from the status.
    var body = safeJson(text);
    if (body && body.code) return body.code;
    if (status === 401 || status === 403) return 'bad-key';
    if (status === 429) return 'rate-limit';
    if (status >= 500) return 'server';
    return 'error';
  }

  function friendlyError(status, text) {
    var body = safeJson(text);

    // The proxy's message is already written for a human — use it as-is.
    if (body && typeof body.error === 'string') return body.error;
    // Anthropic's own errors nest the message one level deeper.
    if (body && body.error && body.error.message) return body.error.message;

    if (status === 401 || status === 403) {
      return 'That API key was rejected. Check it in Settings.';
    }
    if (status === 429) {
      return 'The tutor is busy right now — wait a moment and try again.';
    }
    if (status >= 500) {
      return 'The tutor is having trouble right now. Try again shortly.';
    }
    return 'Request failed (' + status + ').';
  }

  function safeJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  global.AiTutor = AiTutor;

})(window);
