// Netlify Function: Dictionary lookup proxy
// GET /.netlify/functions/dictionary?word=ਟੋਭਾ&lang=pa
// Returns: { found: bool, word: string, definition: string, examples: [], source: string }

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  const word = (event.queryStringParameters && event.queryStringParameters.word) || '';
  if (!word) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ found: false, error: 'word query parameter is required' }),
    };
  }

  const apiKey = process.env.SHABDKOSH_API_KEY;
  if (!apiKey) {
    // Graceful degradation — inform caller to use Claude fallback
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        found: false,
        source: 'not-configured',
        message:
          'Shabdkosh API not configured. ' +
          'Contact https://www.shabdkosh.com/services/dictionary-apis for an API key. ' +
          'Set SHABDKOSH_API_KEY as a Netlify environment variable.',
      }),
    };
  }

  try {
    // Shabdkosh REST API endpoint (adjust path when key is obtained)
    const url = new URL('https://api.shabdkosh.com/v1/dictionary');
    url.searchParams.set('word', word);
    url.searchParams.set('sourceLang', 'pa');
    url.searchParams.set('targetLang', 'en');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ found: false, source: 'shabdkosh' }),
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: res.status,
        headers: corsHeaders(),
        body: JSON.stringify({ found: false, error: errText, source: 'shabdkosh' }),
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        found: true,
        word: data.word || word,
        definition: data.meaning || data.definition || '',
        examples: data.examples || [],
        source: 'shabdkosh',
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ found: false, error: err.message, source: 'shabdkosh' }),
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
