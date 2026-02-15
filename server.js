const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const wishesPath = path.join(rootDir, 'wishes.json');
const rsvpPath = path.join(rootDir, 'rsvp.json');
const port = Number(process.env.PORT || 5500);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function ensureJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]\n', 'utf8');
  }
}

function readJson(filePath) {
  ensureJsonFile(filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(safePath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(rootDir, normalized);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/wishes') {
    sendJson(res, 200, readJson(wishesPath));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/wishes') {
    try {
      const payload = await readRequestBody(req);
      if (!payload || !payload.name || !payload.content) {
        sendJson(res, 400, { error: 'Missing required fields' });
        return;
      }
      const data = readJson(wishesPath);
      data.push(payload);
      writeJson(wishesPath, data);
      sendJson(res, 201, payload);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/rsvp') {
    sendJson(res, 200, readJson(rsvpPath));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/rsvp') {
    try {
      const payload = await readRequestBody(req);
      if (!payload || !payload.name || !payload.attendance) {
        sendJson(res, 400, { error: 'Missing required fields' });
        return;
      }
      const data = readJson(rsvpPath);
      data.push(payload);
      writeJson(rsvpPath, data);
      sendJson(res, 201, payload);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
