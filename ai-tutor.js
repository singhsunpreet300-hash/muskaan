// ai-tutor.js — AiTutor
// Claude API client for theth Punjabi conversation + word lookup
// Exposes: window.AiTutor

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-6';
const MAX_TOKENS     = 1500;

const SYSTEM_PROMPT = `You are ਗੁਰਮੁਖੀ ਗੁਰੂ (Gurmukhi Guru), an expert teacher of Theth Punjabi — the pure, traditional village dialect of Punjabi spoken in rural Punjab. Theth Punjabi avoids loanwords from Urdu, Hindi, English, and Persian, preferring original vocabulary rooted in agricultural and village life.

YOUR ROLE:
- Teach theth Punjabi vocabulary, grammar, pronunciation, and cultural context
- Provide example sentences drawn from village life: farming (ਖੇਤ, ਹਲ, ਵਾਢੀ), the well (ਖੂਹ), the hearth (ਚੁੱਲ੍ਹਾ), the communal meeting spot (ਸੱਥ), livestock (ਡੰਗਰ, ਮੱਝ, ਬਲਦ), family relationships, and seasonal traditions
- Gently correct errors, always providing the theth alternative alongside the modern one
- Share proverbs (ਅਖਾਣ), folk sayings, and cultural context when relevant
- Hold lengthy, flowing conversations entirely in theth Punjabi when asked

RESPONSE FORMAT — ALWAYS USE THIS EXACT STRUCTURE:
Every response must include all three tagged blocks:

<gurmukhi>
[Your main response in Gurmukhi script]
</gurmukhi>

<roman>
[Roman transliteration of the Gurmukhi above]
</roman>

<english>
[English translation and any teaching notes]
</english>

CONFIDENCE AND HONESTY:
- For common theth words: answer confidently with full cultural context
- For less common words: prefix with [ਅਨਿਸ਼ਚਿਤ] (uncertain) and explain what you do know
- For very obscure or niche words you are not sure about: honestly state "ਮੈਨੂੰ ਇਸ ਸ਼ਬਦ ਬਾਰੇ ਪੱਕੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਹੈ" and recommend Mahaan Kosh at searchgurbani.com/mahan-kosh
- Never fabricate definitions — candid uncertainty is better than confident misinformation

THETH VOCABULARY PREFERENCES:
Use these over their modern or borrowed equivalents:
- ਚੁੱਲ੍ਹਾ (chullha) NOT ਸਟੋਵ; ਖੂਹ (khuu) NOT ਟੂਟੀ; ਡੰਗਰ (dangar) NOT ਜਾਨਵਰ
- ਪੱਗ (pagg) NOT ਦਸਤਾਰ in village context; ਹਲ (hal) for plough
- ਕੁੜੀ (kurhi) NOT ਲੜਕੀ; ਮੁੰਡਾ (munda) NOT ਲੜਕਾ
- ਬਾਪੂ (baapu) for father, ਬੇਬੇ (bebe) for mother in village speech
- ਰੋਟੀ (roti) for meal or food in general

CULTURAL CONTEXT to weave in naturally:
- Seasonal cycles: ਵਾਢੀ (harvest), ਬਿਜਾਈ (sowing), ਸਾਵਣ (monsoon), ਫੱਗਣ (spring), ਵਿਸਾਖ (harvest festival)
- Village social structures: ਸੱਥ, ਟੋਭਾ, ਖੂਹ as social gathering points; ਸਰਪੰਚ, ਪੰਚਾਇਤ
- Folk instruments: ਢੋਲ (dhol), ਤੁੰਬੀ (tumbi), ਅਲਗੋਜ਼ਾ (algoza), ਇਕਤਾਰਾ (iktaara)
- Traditional crafts: ਫੁਲਕਾਰੀ embroidery, ਖੱਦਰ weaving, ਘੜਾ pottery
- Traditional attire: ਖੱਦਰ (khaddar), ਪੱਗ (pagg), ਫੁਲਕਾਰੀ (phulkaari), ਜੁੱਤੀ (jutti)
- Agricultural life: ਹਲ (hal), ਬਲਦ (balad), ਮੱਝ (majjh), ਡੰਗਰ (dangar)

TONE: Warm, patient, like a knowledgeable village elder who is delighted to share their language. Be encouraging and positive. Celebrate correct usage enthusiastically in Punjabi.`;

const LOOKUP_SYSTEM_PROMPT = `You are a Punjabi dictionary assistant specializing in Theth Punjabi — the pure village dialect. When given a Punjabi word, provide:
1. Its meaning in theth context with cultural background
2. Etymology if known (especially if it is a true theth word vs a borrowed word)
3. A vivid example sentence from village life

CONFIDENCE RULES (mandatory — do not skip):
- If highly confident: answer directly and fully
- If somewhat uncertain: start response with [ਅਨਿਸ਼ਚਿਤ] on its own line
- If not confident: say exactly "ਮੈਨੂੰ ਇਸ ਸ਼ਬਦ ਬਾਰੇ ਪੱਕੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਹੈ" and recommend Mahaan Kosh at searchgurbani.com/mahan-kosh
- Never fabricate meanings

ALWAYS use the tagged format — every response must include all three tags:
<gurmukhi>definition and example in Gurmukhi script</gurmukhi>
<roman>roman transliteration</roman>
<english>English meaning, cultural context, and notes</english>`;

window.AiTutor = (function () {
  'use strict';

  let _history = [];

  // ── API key management ────────────────────────────
  function getApiKey() {
    return localStorage.getItem('theth_claude_api_key') || null;
  }

  function saveApiKey(key) {
    if (key && key.trim()) {
      localStorage.setItem('theth_claude_api_key', key.trim());
    }
  }

  function clearApiKey() {
    localStorage.removeItem('theth_claude_api_key');
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  // ── Conversation ──────────────────────────────────
  async function sendMessage(userMessage, callbacks = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
      callbacks.onerror && callbacks.onerror('No API key. Please add your Claude API key in Settings (⚙).');
      return;
    }

    _history.push({ role: 'user', content: userMessage });
    callbacks.onstart && callbacks.onstart();

    try {
      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: _history,
        }),
      });

      if (!res.ok) {
        _history.pop();
        let errMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData?.error?.message || errMsg;
        } catch (_) {}
        callbacks.onerror && callbacks.onerror(errMsg);
        return;
      }

      const data = await res.json();
      const rawText = data?.content?.[0]?.text || '';
      _history.push({ role: 'assistant', content: rawText });

      const parsed = _parseTaggedResponse(rawText);
      callbacks.onsuccess && callbacks.onsuccess(parsed);

    } catch (err) {
      _history.pop();
      callbacks.onerror && callbacks.onerror(err.message || 'Network error');
    }
  }

  // ── Word lookup (tiered) ──────────────────────────
  async function lookupWord(word, callbacks = {}) {
    if (!word || !word.trim()) return;
    const query = word.trim();

    callbacks.onstart && callbacks.onstart();

    // Tier 1: curated VOCAB_DB
    if (window.VOCAB_DB) {
      const normQ = query.toLowerCase();
      const match = window.VOCAB_DB.find(e =>
        e.gurmukhi === query ||
        e.roman.toLowerCase() === normQ ||
        e.english.toLowerCase().includes(normQ)
      );
      if (match) {
        callbacks.onsuccess && callbacks.onsuccess({
          gurmukhi: match.gurmukhi,
          roman: match.roman,
          english: match.english,
          example: match.example,
          source: 'curated',
          confidence: 'high',
          raw: '',
        });
        return;
      }
    }

    // Tier 2: Wiktionary dataset
    if (window.VOCAB_WIKTIONARY) {
      const wtDef = window.VOCAB_WIKTIONARY.get(query) || window.VOCAB_WIKTIONARY.get(query.toLowerCase());
      if (wtDef) {
        callbacks.onsuccess && callbacks.onsuccess({
          gurmukhi: query,
          roman: '',
          english: wtDef,
          source: 'wiktionary',
          confidence: 'medium',
          raw: '',
        });
        return;
      }
    }

    // Tier 3: Shabdkosh dictionary function
    try {
      const dictRes = await fetch(`/.netlify/functions/dictionary?word=${encodeURIComponent(query)}&lang=pa`);
      if (dictRes.ok) {
        const dictData = await dictRes.json();
        if (dictData.found && dictData.definition) {
          callbacks.onsuccess && callbacks.onsuccess({
            gurmukhi: query,
            roman: '',
            english: dictData.definition,
            examples: dictData.examples || [],
            source: 'shabdkosh',
            confidence: 'medium',
            raw: '',
          });
          return;
        }
      }
    } catch (_) {
      // Network error — continue to Claude
    }

    // Tier 4: Claude with lookup prompt + confidence flags
    const apiKey = getApiKey();
    if (!apiKey) {
      callbacks.onerror && callbacks.onerror('No API key configured. Add your Claude API key in Settings (⚙) to look up words not in the local database.');
      return;
    }

    try {
      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 600,
          system: LOOKUP_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Look up this Punjabi word: ${query}` }],
        }),
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try { const d = await res.json(); errMsg = d?.error?.message || errMsg; } catch (_) {}
        callbacks.onerror && callbacks.onerror(errMsg);
        return;
      }

      const data = await res.json();
      const rawText = data?.content?.[0]?.text || '';
      const parsed  = _parseTaggedResponse(rawText);

      // Detect confidence level from raw text
      let confidence = 'high';
      if (rawText.includes('ਅਨਿਸ਼ਚਿਤ') || rawText.includes('[ਅਨਿਸ਼ਚਿਤ]')) confidence = 'medium';
      if (rawText.includes('ਪੱਕੀ ਜਾਣਕਾਰੀ ਨਹੀਂ') || rawText.includes('mahan-kosh')) confidence = 'low';

      callbacks.onsuccess && callbacks.onsuccess({
        ...parsed,
        source: 'claude',
        confidence,
      });

    } catch (err) {
      callbacks.onerror && callbacks.onerror(err.message || 'Network error');
    }
  }

  // ── Response parsing ──────────────────────────────
  function _parseTaggedResponse(rawText) {
    const extract = tag => {
      const m = rawText.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : '';
    };
    return {
      gurmukhi: extract('gurmukhi'),
      roman:    extract('roman'),
      english:  extract('english'),
      raw:      rawText,
    };
  }

  // ── Conversation management ───────────────────────
  function resetConversation() { _history = []; }
  function getHistory() { return [..._history]; }

  // ── Public API ────────────────────────────────────
  return {
    getApiKey,
    saveApiKey,
    clearApiKey,
    hasApiKey,
    sendMessage,
    lookupWord,
    resetConversation,
    getHistory,
  };
})();
