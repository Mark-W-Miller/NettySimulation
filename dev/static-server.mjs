import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = Number.parseInt(process.env.PORT || '', 10) || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DOCUMENT = '/index.html';
const ALLOWED_ROOTS = new Set(['dist', 'docs', 'public', 'src', 'examples']);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const method = req.method || 'GET';

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Allow': 'GET, HEAD',
    });
    res.end('Method Not Allowed');
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  let requestedPath = decodeURIComponent(requestUrl.pathname);

  if (requestedPath === '/' || requestedPath === '') {
    requestedPath = DEFAULT_DOCUMENT;
  }

  if (requestedPath.endsWith('/')) {
    requestedPath += 'index.html';
  }

  const normalizedPath = path
    .normalize(requestedPath)
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^([/\\])+/, '');
  const topLevelSegment = normalizedPath.split(path.sep)[0] || '';

  const isFileRequest = topLevelSegment.includes('.');
  if (topLevelSegment && !isFileRequest && !ALLOWED_ROOTS.has(topLevelSegment)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const filePath = path.join(ROOT_DIR, normalizedPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    let stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      stats = await fs.stat(indexPath);
      await streamFile(indexPath, stats, res, method);
      return;
    }

    await streamFile(filePath, stats, res, method);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    console.error('Static server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Static server ready at http://127.0.0.1:${PORT}/index.html`);
});

async function streamFile(filePath, stats, res, method) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stats.size,
    'Cache-Control': 'no-store',
  });

  if (method === 'HEAD') {
    res.end();
    return;
  }

  const stream = (await fs.open(filePath, 'r')).createReadStream();
  stream.on('error', (error) => {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  });
  stream.pipe(res);
}
