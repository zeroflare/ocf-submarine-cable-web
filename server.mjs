import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build-site.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3456);
const HOST = process.env.HOST || '127.0.0.1';
const TAIWAN_VIEW = path.join(SRC, 'taiwan-view.json');
const DESTINATIONS = path.join(SRC, 'destinations.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...extra });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function parseTaiwanView(raw) {
  const data = JSON.parse(raw);
  const lng = Number(data.lng);
  const lat = Number(data.lat);
  const zoom = Number(data.zoom);
  if (![lng, lat, zoom].every(Number.isFinite)) throw new Error('invalid view');
  if (lng < -180 || lng > 180 || lat < -85 || lat > 85 || zoom < 1 || zoom > 22) {
    throw new Error('view out of range');
  }
  return { lng, lat, zoom };
}

function parseDestinations(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0 || data.length > 40) {
    throw new Error('invalid destinations');
  }
  return data.map((item) => {
    const lng = Number(item.lng);
    const lat = Number(item.lat);
    if (!item.id || !item.name || ![lng, lat].every(Number.isFinite)) {
      throw new Error('invalid destination');
    }
    if (lng < -180 || lng > 180 || lat < -85 || lat > 85) {
      throw new Error('gps out of range');
    }
    return {
      id: String(item.id),
      name: String(item.name),
      lng,
      lat,
      anchor: item.anchor === 'left' ? 'left' : 'right',
    };
  });
}

function safeFile(urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\//, '');
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) return null;
  return file;
}

function mirrorToDist(srcFile) {
  const rel = path.relative(SRC, srcFile);
  const dest = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcFile, dest);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function rebuild(reason = '') {
  const started = Date.now();
  const result = buildSite();
  const suffix = reason ? ` (${reason})` : '';
  console.log(`compile ${result.articles} md → dist/${suffix} ${Date.now() - started}ms`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (
    (url.pathname === '/__save-taiwan-view' || url.pathname === '/__save-destinations') &&
    req.method === 'OPTIONS'
  ) {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/__save-taiwan-view') {
    try {
      const view = parseTaiwanView(await readBody(req));
      fs.writeFileSync(TAIWAN_VIEW, `${JSON.stringify(view, null, 2)}\n`);
      mirrorToDist(TAIWAN_VIEW);
      send(res, 200, JSON.stringify({ ok: true, ...view }), 'application/json; charset=utf-8', CORS);
    } catch (err) {
      send(res, 400, err instanceof Error ? err.message : 'bad request', 'text/plain; charset=utf-8', CORS);
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/__save-destinations') {
    try {
      const sites = parseDestinations(await readBody(req));
      fs.writeFileSync(DESTINATIONS, `${JSON.stringify(sites, null, 2)}\n`);
      mirrorToDist(DESTINATIONS);
      send(res, 200, JSON.stringify({ ok: true, count: sites.length }), 'application/json; charset=utf-8', CORS);
    } catch (err) {
      send(res, 400, err instanceof Error ? err.message : 'bad request', 'text/plain; charset=utf-8', CORS);
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'method not allowed');
    return;
  }

  const file = safeFile(url.pathname);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    send(res, 404, 'not found');
    return;
  }

  const type = MIME[path.extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
});

function watchSources() {
  const dirs = ['src', 'content'].map((name) => path.join(ROOT, name));
  let timer = null;
  const queue = (reason) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        rebuild(reason);
      } catch (err) {
        console.error(err);
      }
    }, 80);
  };
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (filename.startsWith('.')) return;
      queue(filename);
    });
  }
}

rebuild('start');
watchSources();

server.listen(PORT, HOST, () => {
  console.log(`site → http://${HOST}:${PORT}/`);
  console.log('edit content/articles/*.md to update article pages');
});
