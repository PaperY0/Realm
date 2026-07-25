'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ASSETS = new Map([
  ['/', { file: 'index.html', contentType: 'text/html; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', contentType: 'text/css; charset=utf-8' }],
  ['/app.js', { file: 'app.js', contentType: 'text/javascript; charset=utf-8' }],
]);

function getPort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function resolveAsset(requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  // Reject encoded or platform-specific traversal before resolving a file.
  if (decodedPath.includes(String.fromCharCode(0)) || decodedPath.includes(String.fromCharCode(92))) return null;
  const segments = decodedPath.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) return null;

  const asset = ASSETS.get(decodedPath);
  if (!asset) return null;

  const candidate = path.resolve(SRC_DIR, asset.file);
  const sourceRoot = path.resolve(SRC_DIR) + path.sep;
  if (!candidate.startsWith(sourceRoot)) return null;
  return { ...asset, filePath: candidate };
}

function serveAsset(response, asset) {
  fs.readFile(asset.filePath, (error, data) => {
    if (error) {
      console.error(error);
      sendJson(response, 500, { ok: false, error: 'internal_server_error' });
      return;
    }
    response.writeHead(200, {
      'Content-Type': asset.contentType,
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
    });
    response.end(data);
  });
}

const port = getPort(process.env.PORT);
const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url, 'http://127.0.0.1');
  } catch {
    sendJson(response, 400, { ok: false, error: 'bad_request' });
    return;
  }

  if (requestUrl.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'dream-book-world',
      stage: 'world-entry',
    });
    return;
  }

  const asset = resolveAsset(requestUrl.pathname);
  if (asset) {
    if (request.method === 'HEAD') {
      response.writeHead(200, { 'Content-Type': asset.contentType });
      response.end();
      return;
    }
    serveAsset(response, asset);
    return;
  }

  sendJson(response, 404, { ok: false, error: 'not_found' });
});

let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Received ' + signal + '; shutting down.');
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen({ host: HOST, port }, () => {
  console.log('藏梦书境 world entry listening at http://' + HOST + ':' + port);
});
