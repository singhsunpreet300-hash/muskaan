// Netlify Function: Sarvam AI STT proxy
// POST /.netlify/functions/stt
// Body JSON: { audio: string (base64), lang?: string, mimeType?: string }
// Returns: { transcript: string } or { error: string }

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
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

  const { audio, lang = 'pa-IN', mimeType = 'audio/webm' } = body;
  if (!audio) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'audio (base64) is required' }) };
  }

  // Decode base64 audio to buffer
  const audioBuffer = Buffer.from(audio, 'base64');

  // Build multipart/form-data manually
  const boundary = '----SarvamBoundary' + Date.now();
  const CRLF = '\r\n';

  // Field: file
  const fileHeader =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="audio.webm"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`;

  // Fields: model, language_code, with_timestamps
  const modelField =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `saaras:v3${CRLF}`;

  const langField =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="language_code"${CRLF}${CRLF}` +
    `${lang}${CRLF}`;

  const tsField =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="with_timestamps"${CRLF}${CRLF}` +
    `false${CRLF}`;

  const closingBoundary = `--${boundary}--${CRLF}`;

  const bodyParts = [
    Buffer.from(fileHeader, 'utf8'),
    audioBuffer,
    Buffer.from(CRLF + modelField + langField + tsField + closingBoundary, 'utf8'),
  ];
  const multipartBody = Buffer.concat(bodyParts);

  try {
    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length,
        'api-subscription-key': apiKey,
      },
      body: multipartBody,
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
    // Sarvam returns { transcript: string, language_code: string, request_id: string }
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ transcript: data.transcript || '' }),
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
