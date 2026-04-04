// Netlify Function: Sarvam AI TTS proxy
// POST /.netlify/functions/tts
// Body JSON: { text: string, lang?: string }
// Returns: { audio: string (base64 WAV) } or { error: string }

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'SARVAM_API_KEY not configured' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { text, lang = 'pa-IN' } = body;
  if (!text) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'text is required' }) };
  }

  // Sarvam has a ~500 char limit per request
  const truncated = text.slice(0, 500);

  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        inputs: [truncated],
        target_language_code: lang,
        speaker: 'arjun',
        model: 'bulbul:v3',
        pace: 0.9,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: res.status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: errText }),
      };
    }

    const data = await res.json();
    // Sarvam returns { audios: [base64string], request_id: string }
    const audio = (data.audios && data.audios[0]) || '';
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ audio }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message || 'Unknown error' }),
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
