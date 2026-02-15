export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (request.method === 'GET' && pathname === '/api/wishes') {
        const data = await readJsonFile(env, env.WISHES_FILE_PATH);
        return jsonResponse(data.content, 200, corsHeaders);
      }

      if (request.method === 'POST' && pathname === '/api/wishes') {
        const payload = await request.json();
        if (!payload?.name || !payload?.content) {
          return jsonResponse({ error: 'Missing required fields: name, content' }, 400, corsHeaders);
        }

        const current = await readJsonFile(env, env.WISHES_FILE_PATH);
        const next = Array.isArray(current.content) ? current.content : [];
        next.push(payload);
        await writeJsonFile(env, env.WISHES_FILE_PATH, next, current.sha, 'chore: append wedding wish');
        return jsonResponse(payload, 201, corsHeaders);
      }

      if (request.method === 'GET' && pathname === '/api/rsvp') {
        const data = await readJsonFile(env, env.RSVP_FILE_PATH);
        return jsonResponse(data.content, 200, corsHeaders);
      }

      if (request.method === 'POST' && pathname === '/api/rsvp') {
        const payload = await request.json();
        if (!payload?.name || !payload?.attendance) {
          return jsonResponse({ error: 'Missing required fields: name, attendance' }, 400, corsHeaders);
        }

        const current = await readJsonFile(env, env.RSVP_FILE_PATH);
        const next = Array.isArray(current.content) ? current.content : [];
        next.push(payload);
        await writeJsonFile(env, env.RSVP_FILE_PATH, next, current.sha, 'chore: append wedding rsvp');
        return jsonResponse(payload, 201, corsHeaders);
      }

      if (request.method === 'GET' && pathname === '/wishes.json') {
        const data = await readJsonFile(env, env.WISHES_FILE_PATH);
        return jsonResponse(data.content, 200, corsHeaders);
      }

      if (request.method === 'GET' && pathname === '/rsvp.json') {
        const data = await readJsonFile(env, env.RSVP_FILE_PATH);
        return jsonResponse(data.content, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Unexpected error' }, 500, corsHeaders);
    }
  },
};

function getCorsHeaders(env, request) {
  const requestOrigin = request.headers.get('Origin') || '*';
  const allowedOrigin = env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN.trim() ? env.ALLOWED_ORIGIN.trim() : '*';
  const origin = allowedOrigin === '*' ? requestOrigin : allowedOrigin;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });
}

function githubApiBase(env, filePath) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'wedding-worker',
  };
}

async function readJsonFile(env, filePath) {
  const branch = env.GITHUB_BRANCH || 'main';
  const response = await fetch(`${githubApiBase(env, filePath)}?ref=${encodeURIComponent(branch)}`, {
    method: 'GET',
    headers: githubHeaders(env),
  });

  if (response.status === 404) {
    return { content: [], sha: null };
  }

  if (!response.ok) {
    throw new Error(`Failed to read ${filePath}: ${response.status}`);
  }

  const result = await response.json();
  const decoded = decodeBase64Unicode((result.content || '').replace(/\n/g, ''));

  try {
    const parsed = JSON.parse(decoded || '[]');
    return { content: Array.isArray(parsed) ? parsed : [], sha: result.sha || null };
  } catch {
    return { content: [], sha: result.sha || null };
  }
}

async function writeJsonFile(env, filePath, data, sha, message) {
  const branch = env.GITHUB_BRANCH || 'main';
  const body = {
    message,
    branch,
    content: encodeBase64Unicode(JSON.stringify(data, null, 2)),
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(githubApiBase(env, filePath), {
    method: 'PUT',
    headers: {
      ...githubHeaders(env),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to write ${filePath}: ${response.status} ${errorText}`);
  }
}

function decodeBase64Unicode(input) {
  const binary = atob(input || '');
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Unicode(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
