/* ══════════════════════════════════════════════════
   Bolee — Speech  →  window.SpeechEngine
   ──────────────────────────────────────────────────
   Three separate browser APIs, each missing somewhere:
     speechSynthesis     — broad, but Punjabi voices are rare
     SpeechRecognition   — Chrome/Edge only
     MediaRecorder       — everywhere modern, needs permission

   Every capability is behind a feature-detect getter so
   the UI can hide a button instead of throwing on click.
   ══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var synth = global.speechSynthesis || null;
  var Recognition = global.SpeechRecognition || global.webkitSpeechRecognition || null;

  /* ── Voices ─────────────────────────────────────────
     getVoices() is empty on first call in Chrome — the list
     arrives later via voiceschanged. Cache it and resolve a
     promise so callers can await readiness once.          */

  var voices = [];
  var voicesResolved = false;
  var voicesPromise = null;

  function loadVoices() {
    if (voicesPromise) return voicesPromise;
    voicesPromise = new Promise(function (resolve) {
      if (!synth) return resolve([]);

      function pick() {
        var list = synth.getVoices() || [];
        if (list.length) {
          voices = list;
          voicesResolved = true;
          resolve(voices);
          return true;
        }
        return false;
      }

      if (pick()) return;

      var done = false;
      var onChange = function () {
        if (done) return;
        if (pick()) { done = true; synth.removeEventListener('voiceschanged', onChange); }
      };
      synth.addEventListener('voiceschanged', onChange);

      // Some browsers never fire the event — don't hang the UI on it.
      setTimeout(function () {
        if (done) return;
        done = true;
        if (synth) synth.removeEventListener('voiceschanged', onChange);
        voices = synth.getVoices() || [];
        voicesResolved = true;
        resolve(voices);
      }, 1500);
    });
    return voicesPromise;
  }

  /* Punjabi voices are uncommon. Hindi is a far closer fallback for
     Gurmukhi than any English voice — the vowel inventory mostly lines
     up, so the word stays recognisable. English last, as a last resort. */
  var LANG_PREFERENCE = ['pa-IN', 'pa', 'pa-Guru', 'hi-IN', 'hi'];

  function pickVoice(preferredURI) {
    if (!voices.length) return null;

    if (preferredURI) {
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].voiceURI === preferredURI) return voices[i];
      }
    }

    for (var p = 0; p < LANG_PREFERENCE.length; p++) {
      var want = LANG_PREFERENCE[p].toLowerCase();
      for (var j = 0; j < voices.length; j++) {
        var lang = (voices[j].lang || '').toLowerCase().replace('_', '-');
        if (lang === want || lang.indexOf(want + '-') === 0) return voices[j];
      }
    }
    return null;
  }

  /* ── Recording state ────────────────────────────── */

  var mediaRecorder = null;
  var recordedChunks = [];
  var activeStream = null;

  var SpeechEngine = {

    /* ── capability flags — check these before showing UI ── */

    get canSpeak()     { return !!synth; },
    get canListen()    { return !!Recognition && isSecure(); },
    get canRecord()    {
      return !!(global.navigator && navigator.mediaDevices &&
                navigator.mediaDevices.getUserMedia && global.MediaRecorder && isSecure());
    },
    get isRecording()  { return !!mediaRecorder && mediaRecorder.state === 'recording'; },

    /* ── Voices ───────────────────────────────────── */

    loadVoices: loadVoices,

    getVoices: function () { return voices.slice(); },

    /** Best available voice, or null if the browser ships none we like. */
    getPreferredVoice: function (preferredURI) { return pickVoice(preferredURI); },

    /** True when we found an actual Punjabi voice (not a Hindi stand-in). */
    hasPunjabiVoice: function () {
      for (var i = 0; i < voices.length; i++) {
        if ((voices[i].lang || '').toLowerCase().indexOf('pa') === 0) return true;
      }
      return false;
    },

    /* ── Speak ────────────────────────────────────── */

    /**
     * Speak text aloud. Resolves when the utterance finishes.
     * Never rejects on an unsupported browser — it resolves false,
     * so a caller can chain UI without a try/catch everywhere.
     */
    speak: function (text, opts) {
      opts = opts || {};
      if (!synth || !text) return Promise.resolve(false);

      return loadVoices().then(function () {
        return new Promise(function (resolve) {
          try { synth.cancel(); } catch (e) { /* Firefox occasionally throws here */ }

          var u = new SpeechSynthesisUtterance(String(text));
          var voice = pickVoice(opts.voiceURI);
          if (voice) {
            u.voice = voice;
            u.lang = voice.lang;
          } else {
            u.lang = 'pa-IN';
          }
          // Theth words are unfamiliar even to learners who read Gurmukhi —
          // default slower than normal speech.
          u.rate = typeof opts.rate === 'number' ? opts.rate : 0.85;
          u.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1;

          var settled = false;
          function finish(ok) {
            if (settled) return;
            settled = true;
            resolve(ok);
          }

          u.onend = function () { finish(true); };
          u.onerror = function () { finish(false); };

          // Chrome silently drops long utterances; guard so we always resolve.
          var guard = setTimeout(function () { finish(false); }, 15000);
          var origFinish = finish;
          finish = function (ok) { clearTimeout(guard); origFinish(ok); };

          synth.speak(u);
        });
      });
    },

    stopSpeaking: function () {
      if (synth) { try { synth.cancel(); } catch (e) {} }
    },

    /* ── Listen (speech recognition) ───────────────── */

    /**
     * Listen once and resolve the transcript.
     * Rejects with a coded Error so the UI can distinguish
     * "denied permission" from "heard nothing".
     */
    listen: function (opts) {
      opts = opts || {};
      if (!Recognition) {
        return Promise.reject(codedError('unsupported', 'Speech recognition is not available in this browser.'));
      }

      return new Promise(function (resolve, reject) {
        var rec = new Recognition();
        rec.lang = opts.lang || 'pa-IN';
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        rec.continuous = false;

        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          try { rec.stop(); } catch (e) {}
        }, opts.timeout || 8000);

        rec.onresult = function (event) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          var result = event.results[0];
          var alternatives = [];
          for (var i = 0; i < result.length; i++) {
            alternatives.push({ transcript: result[i].transcript, confidence: result[i].confidence });
          }
          resolve({
            transcript: result[0].transcript,
            confidence: result[0].confidence,
            alternatives: alternatives
          });
        };

        rec.onerror = function (event) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          var code = event.error === 'not-allowed' ? 'denied'
                   : event.error === 'no-speech'   ? 'no-speech'
                   : 'error';
          reject(codedError(code, 'Could not hear you (' + event.error + ').'));
        };

        rec.onend = function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(codedError('no-speech', 'Did not catch that — try again.'));
        };

        try {
          rec.start();
        } catch (e) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(codedError('error', e.message));
        }
      });
    },

    /* ── Record (contributor pronunciation) ────────── */

    /** Ask for the mic and start capturing. Resolves once recording begins. */
    record: function () {
      var self = this;
      if (!this.canRecord) {
        return Promise.reject(codedError('unsupported', 'Recording is not available in this browser.'));
      }
      if (this.isRecording) return Promise.resolve(true);

      return navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          activeStream = stream;
          recordedChunks = [];

          var options = {};
          // Safari has no webm; let the browser choose when opus isn't supported.
          if (global.MediaRecorder.isTypeSupported &&
              MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus';
          }

          mediaRecorder = new MediaRecorder(stream, options);
          mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) recordedChunks.push(e.data);
          };
          mediaRecorder.start();
          return true;
        })
        .catch(function (err) {
          releaseStream();
          throw codedError(err && err.name === 'NotAllowedError' ? 'denied' : 'error',
                           'Microphone unavailable: ' + (err && err.message ? err.message : err));
        });
    },

    /** Stop and resolve the recorded Blob (null if nothing captured). */
    stopRecording: function () {
      if (!mediaRecorder) return Promise.resolve(null);

      return new Promise(function (resolve) {
        var recorder = mediaRecorder;
        var type = recorder.mimeType || 'audio/webm';

        recorder.onstop = function () {
          var blob = recordedChunks.length ? new Blob(recordedChunks, { type: type }) : null;
          recordedChunks = [];
          mediaRecorder = null;
          releaseStream();
          resolve(blob);
        };

        try {
          if (recorder.state !== 'inactive') recorder.stop();
          else { mediaRecorder = null; releaseStream(); resolve(null); }
        } catch (e) {
          mediaRecorder = null;
          releaseStream();
          resolve(null);
        }
      });
    },

    cancelRecording: function () {
      if (mediaRecorder) {
        try { if (mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch (e) {}
      }
      mediaRecorder = null;
      recordedChunks = [];
      releaseStream();
    },

    /* ── Playback of a recorded blob ───────────────── */

    playBlob: function (blob) {
      if (!blob) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(blob);
        var audio = new Audio(url);
        function cleanup(ok) {
          URL.revokeObjectURL(url);
          resolve(ok);
        }
        audio.onended = function () { cleanup(true); };
        audio.onerror = function () { cleanup(false); };
        audio.play().catch(function () { cleanup(false); });
      });
    }
  };

  /* ── internals ──────────────────────────────────── */

  function releaseStream() {
    if (activeStream) {
      activeStream.getTracks().forEach(function (t) {
        try { t.stop(); } catch (e) {}
      });
      activeStream = null;
    }
  }

  function codedError(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  /* getUserMedia and SpeechRecognition both require a secure context.
     file:// counts as insecure in Chrome — worth surfacing, since that's
     exactly how someone will first open this app. */
  function isSecure() {
    if (typeof global.isSecureContext === 'boolean') return global.isSecureContext;
    var host = global.location && global.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' ||
           (global.location && global.location.protocol === 'https:');
  }

  SpeechEngine.isSecureContext = isSecure;

  // Warm the voice list early so the first tap on 🔊 isn't silent.
  if (synth) loadVoices();

  global.SpeechEngine = SpeechEngine;

})(window);
