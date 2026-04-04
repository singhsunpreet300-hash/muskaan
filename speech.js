// speech.js — SpeechEngine
// Handles TTS (Sarvam AI → Web Speech fallback) and STT (Sarvam AI → Web Speech fallback)
// Exposes: window.SpeechEngine

window.SpeechEngine = (function () {
  'use strict';

  // ── Internal state ────────────────────────────────
  let _audioCtx = null;
  let _currentSource = null;
  let _recognition = null;
  let _mediaRecorder = null;
  let _synth = window.speechSynthesis || null;
  let _punjabVoice = null;
  let _speaking = false;
  let _recording = false;

  let _settings = {
    rate: 0.85,
    recLang: 'pa-IN',
    useSarvam: true,
  };

  // ── Capability detection ──────────────────────────
  function detectCapabilities() {
    return {
      sarvam: _settings.useSarvam,
      synthesis: !!window.speechSynthesis,
      recognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      mediaRecorder: !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    };
  }

  // ── Voice loading (Web Speech API) ───────────────
  function loadVoices(callback) {
    if (!_synth) { callback(null); return; }

    const tryLoad = () => {
      const voices = _synth.getVoices();
      if (!voices.length) return false;
      _punjabVoice =
        voices.find(v => v.lang === 'pa-IN') ||
        voices.find(v => v.lang === 'pa-PK') ||
        voices.find(v => v.lang.startsWith('pa')) ||
        voices.find(v => v.lang === 'hi-IN') ||
        null;
      callback(_punjabVoice);
      return true;
    };

    if (!tryLoad()) {
      _synth.addEventListener('voiceschanged', function onChanged() {
        _synth.removeEventListener('voiceschanged', onChanged);
        tryLoad();
      });
    }
  }

  // ── TTS ───────────────────────────────────────────
  async function speak(text, opts = {}) {
    if (!text) return;
    stopSpeaking();

    // Try Sarvam TTS first
    if (_settings.useSarvam) {
      try {
        const res = await fetch('/.netlify/functions/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang: 'pa-IN' }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audio) {
            await _playSarvamAudio(data.audio, opts);
            return;
          }
        } else if (res.status === 503) {
          // Not configured — disable Sarvam silently
          _settings.useSarvam = false;
        }
      } catch (_e) {
        // Network error — fall through to Web Speech
      }
    }

    // Fallback: Web Speech API
    _speakWebSpeech(text, opts);
  }

  async function _playSarvamAudio(base64Audio, opts = {}) {
    try {
      if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_audioCtx.state === 'suspended') await _audioCtx.resume();

      // Decode base64 WAV
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const audioBuffer = await _audioCtx.decodeAudioData(bytes.buffer);

      _currentSource = _audioCtx.createBufferSource();
      _currentSource.buffer = audioBuffer;
      _currentSource.connect(_audioCtx.destination);
      _speaking = true;

      _currentSource.onended = () => {
        _speaking = false;
        _currentSource = null;
        opts.onend && opts.onend();
      };

      opts.onstart && opts.onstart();
      _currentSource.start(0);
    } catch (e) {
      _speaking = false;
      // Fall through to Web Speech
      _speakWebSpeech(opts._fallbackText || '', opts);
    }
  }

  function _speakWebSpeech(text, opts = {}) {
    if (!_synth) { opts.onerror && opts.onerror('no-synthesis'); return; }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = _settings.rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'pa-IN';
    if (_punjabVoice) utterance.voice = _punjabVoice;

    utterance.onstart = () => { _speaking = true; opts.onstart && opts.onstart(); };
    utterance.onend = () => { _speaking = false; opts.onend && opts.onend(); };
    utterance.onerror = (e) => { _speaking = false; opts.onerror && opts.onerror(e.error); };

    _synth.speak(utterance);
  }

  function stopSpeaking() {
    if (_currentSource) {
      try { _currentSource.stop(); } catch (_) {}
      _currentSource = null;
    }
    if (_synth) _synth.cancel();
    _speaking = false;
  }

  function isSpeaking() { return _speaking; }

  // ── STT ───────────────────────────────────────────
  function startRecognition(callbacks = {}) {
    if (_recording) return;

    const cap = detectCapabilities();

    // Try Sarvam STT via MediaRecorder
    if (cap.mediaRecorder && _settings.useSarvam) {
      _startSarvamRecognition(callbacks);
    } else if (cap.recognition) {
      _startWebSpeechRecognition(callbacks);
    } else {
      callbacks.onerror && callbacks.onerror('not-supported');
    }
  }

  function _startSarvamRecognition(callbacks) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const chunks = [];
      _mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      _mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        _recording = false;
        callbacks.onend && callbacks.onend();

        const blob = new Blob(chunks, { type: 'audio/webm' });
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          try {
            const res = await fetch('/.netlify/functions/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, lang: _settings.recLang, mimeType: 'audio/webm' }),
            });

            if (res.ok) {
              const data = await res.json();
              callbacks.onresult && callbacks.onresult(data.transcript || '', 1.0);
            } else if (res.status === 503) {
              _settings.useSarvam = false;
              // Fall back to Web Speech for next attempt
              callbacks.onerror && callbacks.onerror('sarvam-not-configured');
            } else {
              callbacks.onerror && callbacks.onerror('stt-error');
            }
          } catch (_e) {
            callbacks.onerror && callbacks.onerror('network-error');
          }
        };
        reader.readAsDataURL(blob);
      };

      _recording = true;
      _mediaRecorder.start();
      callbacks.onstart && callbacks.onstart();

      // Auto-stop after 5 seconds
      setTimeout(() => { if (_mediaRecorder && _mediaRecorder.state === 'recording') stopRecognition(); }, 5000);

    }).catch(_err => {
      callbacks.onerror && callbacks.onerror('not-allowed');
    });
  }

  function _startWebSpeechRecognition(callbacks) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { callbacks.onerror && callbacks.onerror('not-supported'); return; }

    _recognition = new SpeechRec();
    _recognition.lang = _settings.recLang;
    _recognition.continuous = false;
    _recognition.interimResults = false;
    _recognition.maxAlternatives = 3;

    _recognition.onstart = () => { _recording = true; callbacks.onstart && callbacks.onstart(); };

    _recognition.onresult = e => {
      const alts = Array.from(e.results[0]);
      const best = alts.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
      callbacks.onresult && callbacks.onresult(best.transcript, best.confidence);
    };

    _recognition.onerror = e => {
      _recording = false;
      if (e.error === 'language-not-supported' && _settings.recLang !== 'hi-IN') {
        // Retry with Hindi
        _settings.recLang = 'hi-IN';
        _startWebSpeechRecognition(callbacks);
        return;
      }
      callbacks.onerror && callbacks.onerror(e.error);
    };

    _recognition.onend = () => { _recording = false; callbacks.onend && callbacks.onend(); };

    _recognition.start();
  }

  function stopRecognition() {
    if (_mediaRecorder && _mediaRecorder.state === 'recording') {
      _mediaRecorder.stop();
    }
    if (_recognition) {
      try { _recognition.stop(); } catch (_) {}
    }
    _recording = false;
  }

  // ── Pronunciation scoring ─────────────────────────
  function scorePronunciation(heard, targetGurmukhi, targetRoman) {
    const norm = s => (s || '').toLowerCase().replace(/[^\u0A00-\u0A7Fa-z0-9 ]/g, '').trim();

    const heardN = norm(heard);
    const gurN   = norm(targetGurmukhi);
    const romN   = norm(targetRoman);

    if (!heardN) return { score: 0, level: 'miss' };

    // Check exact match against either script
    if (heardN === gurN || heardN === romN) return { score: 100, level: 'perfect' };

    // Check substring match
    if (heardN.includes(romN) || romN.includes(heardN) ||
        heardN.includes(gurN) || gurN.includes(heardN)) {
      return { score: 80, level: 'good' };
    }

    // Levenshtein against both targets, take best
    const scorGur = _levenshteinScore(heardN, gurN);
    const scorRom = _levenshteinScore(heardN, romN);
    const score   = Math.max(scorGur, scorRom);

    let level;
    if (score >= 90)      level = 'perfect';
    else if (score >= 60) level = 'good';
    else if (score >= 30) level = 'partial';
    else                  level = 'miss';

    return { score, level };
  }

  function _levenshteinScore(a, b) {
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const dist = dp[m][n];
    const maxLen = Math.max(m, n);
    return Math.max(0, Math.round((1 - dist / maxLen) * 100));
  }

  // ── Settings ──────────────────────────────────────
  function updateSettings(obj) {
    Object.assign(_settings, obj);
  }

  // ── Public API ────────────────────────────────────
  return {
    detectCapabilities,
    loadVoices,
    speak,
    stopSpeaking,
    isSpeaking,
    startRecognition,
    stopRecognition,
    scorePronunciation,
    updateSettings,
  };
})();
