import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = Number.parseInt(process.env.PORT || '', 10) || 6060;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(PROJECT_ROOT, '.assistant.log');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'export');

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      send(res, 400, 'Bad Request');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (url.pathname === '/log') {
      await handleLogRoute(req, res, url);
      return;
    }

    if (url.pathname === '/export') {
      await handleExportRoute(req, res, url);
      return;
    }

    send(res, 404, 'Not Found');
  } catch (error) {
    console.error('Error reporter failure:', error);
    send(res, 500, 'Internal Server Error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Error reporter listening on http://127.0.0.1:${PORT}`);
});

async function handleLogRoute(req, res, url) {
  switch (req.method) {
    case 'GET':
      await handleLogGet(res, url);
      break;
    case 'POST':
      await handleLogPost(req, res);
      break;
    case 'DELETE':
      await fs.rm(LOG_FILE, { force: true });
      send(res, 204);
      break;
    default:
      send(res, 405, 'Method Not Allowed', { Allow: 'GET, POST, DELETE' });
  }
}

async function handleLogGet(res, url) {
  const sessionAction = url.searchParams.get('session');

  if (sessionAction === 'start') {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.writeFile(LOG_FILE, '');
    send(res, 204);
    return;
  }

  try {
    const contents = await fs.readFile(LOG_FILE, 'utf8');
    if (!contents) {
      send(res, 204);
      return;
    }
    send(res, 200, contents, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      send(res, 204);
      return;
    }
    throw error;
  }
}

async function handleLogPost(req, res) {
  const body = await collectBody(req);

  if (!body.length) {
    send(res, 400, 'Missing request body');
    return;
  }

  let entry;

  try {
    entry = JSON.parse(body.toString('utf8'));
  } catch {
    send(res, 400, 'Body must be valid JSON');
    return;
  }

  const logRecord = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.appendFile(LOG_FILE, `${JSON.stringify(logRecord)}\n`, 'utf8');
  send(res, 204);
}

async function handleExportRoute(req, res, url) {
  if (req.method !== 'POST') {
    send(res, 405, 'Method Not Allowed', { Allow: 'POST' });
    return;
  }

  const nameParam = url.searchParams.get('name');

  if (!nameParam) {
    send(res, 400, 'Missing name query parameter');
    return;
  }

  const safeName = sanitizeFilename(nameParam);

  if (!safeName) {
    send(res, 400, 'Invalid export filename');
    return;
  }

  const body = await collectBody(req);

  await fs.mkdir(EXPORT_DIR, { recursive: true });
  const filePath = path.join(EXPORT_DIR, safeName);
  await fs.writeFile(filePath, body);

  send(res, 201, 'Created', { 'Location': `/export/${safeName}` });
}

function send(res, statusCode, message = '', headers = {}) {
  const finalHeaders = { ...headers };

  if (!finalHeaders['Content-Type'] && message) {
    finalHeaders['Content-Type'] = 'text/plain; charset=utf-8';
  }

  res.writeHead(statusCode, finalHeaders);
  res.end(message);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;

    req.on('data', (chunk) => {
      chunks.push(chunk);
      totalLength += chunk.length;

      // Abort unusually large payloads (>10MB)
      if (totalLength > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sanitizeFilename(name) {
  const trimmed = name.trim().replace(/\\/g, '/');
  if (!trimmed || trimmed.includes('..') || trimmed.includes('/')) {
    return '';
  }

  return trimmed;
}
