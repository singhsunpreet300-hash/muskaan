/* ══════════════════════════════════════════════════
   Bolee — provider proxy  (Netlify Function)
   ──────────────────────────────────────────────────
   Holds the API keys server-side so every visitor gets
   the tutor, the translator and real Punjabi speech
   without supplying a key of their own.

   Env vars (set in the Netlify dashboard, never here):
     ANTHROPIC_API_KEY   required for tutor + translate
     BHASHINI_USER_ID    optional, enables Punjabi TTS
     BHASHINI_API_KEY    optional, ditto
     BOLEE_ALLOWED_ORIGIN  optional, defaults to same-origin only

   Routes, by ?task=
     chat       streamed Claude response (SSE passthrough)
     translate  non-streamed JSON translation
     tts        Bhashini Punjabi speech, returns base64 audio
     status     which providers are configured (no secrets)

   Every route fails soft: the client treats any error as
   "provider unavailable" and falls back to local behaviour.
   ══════════════════════════════════════════════════ */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

const BHASHINI_CONFIG_URL =
  'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
// Published pipeline id for the ULCA/Bhashini default provider set.
const BHASHINI_PIPELINE_ID = '64392f96daac500b55c543cd';

/* Keep the surface small: only these models may be requested, so a crafted
   request can't point our key at something unexpected. */
const ALLOWED_MODELS = new Set([
  'claude-sonnet-5',
  'claude-opus-5',
  'claude-haiku-4-5-20251001'
]);

const MAX_BODY_BYTES = 100 * 1024;
const MAX_MESSAGES = 40;
const MAX_TOKENS_CAP = 2048;

function cors(origin) {
  const allowed = process.env.BOLEE_ALLOWED_ORIGIN || origin || '*';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'origin'
  };
}

function json(status, body, origin) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', ...cors(origin) },
    body: JSON.stringify(body)
  };
}

export default async function handler(request) {
  const origin = request.headers.get('origin') || '';
  const url = new URL(request.url);
  const task = url.searchParams.get('task') || 'chat';

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: cors(origin) });
  }

  // `status` is a GET so the client can cheaply ask what's available.
  if (task === 'status') {
    return new Response(JSON.stringify({
      chat: !!process.env.ANTHROPIC_API_KEY,
      translate: !!process.env.ANTHROPIC_API_KEY,
      tts: !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY)
    }), { status: 200, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: { 'content-type': 'application/json', ...cors(origin) } });
    }
    payload = JSON.parse(raw || '{}');
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  try {
    if (task === 'tts')       return await handleTts(payload, origin);
    if (task === 'translate') return await handleTranslate(payload, origin);
    return await handleChat(payload, origin);
  } catch (err) {
    // Never leak a stack or a key into the response.
    console.error('[bolee proxy]', task, err && err.message);
    return new Response(JSON.stringify({ error: 'Provider request failed' }),
      { status: 502, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }
}

/* ── chat: stream Claude straight through ───────────
   The browser already parses Anthropic's SSE frames, so passing the body
   through unchanged keeps the client's streaming path identical whether it
   talks to this proxy or directly to the API with a user key.          */

async function handleChat(payload, origin) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'Tutor is not configured on this deployment.', code: 'not-configured' }),
      { status: 503, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages.slice(-MAX_MESSAGES) : [];
  if (!messages.length) {
    return new Response(JSON.stringify({ error: 'No messages supplied' }),
      { status: 400, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  const model = ALLOWED_MODELS.has(payload.model) ? payload.model : DEFAULT_MODEL;

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(Number(payload.max_tokens) || 1024, MAX_TOKENS_CAP),
      system: String(payload.system || ''),
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      })),
      stream: true
    })
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error('[bolee proxy] anthropic', upstream.status, text.slice(0, 300));
    return new Response(JSON.stringify({
      error: upstream.status === 429
        ? 'The tutor is busy right now — try again in a moment.'
        : 'The tutor is unavailable right now.',
      code: upstream.status === 429 ? 'rate-limit' : 'upstream'
    }), { status: upstream.status === 429 ? 429 : 502,
          headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      ...cors(origin)
    }
  });
}

/* ── translate: single non-streamed call ───────────── */

async function handleTranslate(payload, origin) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'Translation is not configured on this deployment.', code: 'not-configured' }),
      { status: 503, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  const text = String(payload.text || '').trim().slice(0, 1000);
  if (!text) {
    return new Response(JSON.stringify({ error: 'Nothing to translate' }),
      { status: 400, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  const toPunjabi = payload.direction !== 'pa-en';

  const system = [
    'You translate between English and Punjabi for a theth (rural) Punjabi learning app.',
    'Prefer authentic rural Punjabi vocabulary over Hindi-Urdu borrowings.',
    '',
    'Reply with ONLY a JSON object, no prose and no code fence:',
    '{"gurmukhi":"…","latin":"…","english":"…","note":"…"}',
    toPunjabi
      ? 'Translate the English input into Punjabi. "gurmukhi" is the Punjabi in Gurmukhi script, "latin" its romanisation, "english" the original.'
      : 'Translate the Punjabi input into English. "gurmukhi" is the original Punjabi, "latin" its romanisation, "english" the translation.',
    '"note" is optional: one short sentence on dialect or usage, or "" if there is nothing worth saying.'
  ].join('\n');

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: ALLOWED_MODELS.has(payload.model) ? payload.model : DEFAULT_MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: text }]
    })
  });

  if (!upstream.ok) {
    const body = await upstream.text();
    console.error('[bolee proxy] translate', upstream.status, body.slice(0, 300));
    return new Response(JSON.stringify({ error: 'Translation failed.', code: 'upstream' }),
      { status: 502, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  const data = await upstream.json();
  const replyText = (data.content || []).map(b => b.text || '').join('').trim();

  // The model is told to return bare JSON, but tolerate a code fence anyway.
  let parsed = null;
  try {
    parsed = JSON.parse(replyText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch (e) {
    const match = replyText.match(/\{[\s\S]*\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch (e2) { /* fall through */ } }
  }

  if (!parsed || !parsed.gurmukhi) {
    return new Response(JSON.stringify({ error: 'Could not read the translation.', code: 'unparseable' }),
      { status: 502, headers: { 'content-type': 'application/json', ...cors(origin) } });
  }

  return json(200, {
    gurmukhi: String(parsed.gurmukhi || ''),
    latin: String(parsed.latin || ''),
    english: String(parsed.english || ''),
    note: String(parsed.note || '')
  }, origin);
}

/* ── tts: Bhashini Punjabi speech ───────────────────
   Two-step: ask ULCA for the pipeline (endpoint + short-lived token), then
   call Dhruva inference. The config is cached per warm container since it
   changes rarely and the call is slow.                                  */

let cachedPipeline = null;
let cachedAt = 0;
const PIPELINE_TTL_MS = 30 * 60 * 1000;

async function getPipeline(userId, apiKey) {
  if (cachedPipeline && Date.now() - cachedAt < PIPELINE_TTL_MS) return cachedPipeline;

  const res = await fetch(BHASHINI_CONFIG_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', userID: userId, ulcaApiKey: apiKey },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage: 'pa' } } }],
      pipelineRequestConfig: { pipelineId: BHASHINI_PIPELINE_ID }
    })
  });

  if (!res.ok) throw new Error('bhashini config ' + res.status);

  const data = await res.json();
  const task = (data.pipelineResponseConfig || [])[0] || {};
  const service = (task.config || [])[0] || {};
  const endpoint = data.pipelineInferenceAPIEndPoint || {};

  cachedPipeline = {
    url: endpoint.callbackUrl,
    headerName: (endpoint.inferenceApiKey || {}).name,
    headerValue: (endpoint.inferenceApiKey || {}).value,
    serviceId: service.serviceId
  };
  cachedAt = Date.now();

  if (!cachedPipeline.url || !cachedPipeline.serviceId) {
    cachedPipeline = null;
    throw new Error('bhashini config incomplete');
  }
  return cachedPipeline;
}

async function handleTts(payload, origin) {
  const userId = process.env.BHASHINI_USER_ID;
  const apiKey = process.env.BHASHINI_API_KEY;

  if (!userId || !apiKey) {
    // Not an error condition — the client falls back to browser speech.
    return json(503, { error: 'Punjabi speech is not configured.', code: 'not-configured' }, origin);
  }

  const text = String(payload.text || '').trim().slice(0, 500);
  if (!text) return json(400, { error: 'Nothing to speak' }, origin);

  const pipeline = await getPipeline(userId, apiKey);

  const res = await fetch(pipeline.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [pipeline.headerName]: pipeline.headerValue
    },
    body: JSON.stringify({
      pipelineTasks: [{
        taskType: 'tts',
        config: {
          language: { sourceLanguage: 'pa' },
          serviceId: pipeline.serviceId,
          gender: payload.gender === 'male' ? 'male' : 'female',
          samplingRate: 8000
        }
      }],
      inputData: { input: [{ source: text }] }
    })
  });

  if (!res.ok) throw new Error('bhashini tts ' + res.status);

  const data = await res.json();
  const audio = ((data.pipelineResponse || [])[0] || {}).audio || [];
  const clip = (audio[0] || {}).audioContent;

  if (!clip) return json(502, { error: 'No audio returned.', code: 'no-audio' }, origin);

  return json(200, { audioContent: clip, format: 'wav' }, origin);
}
