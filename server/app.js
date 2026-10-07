import fs from 'node:fs';
import path from 'node:path';

const MAX_BODY = 1_000_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': body.length,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, staticDir) {
  if (!staticDir || !fs.existsSync(staticDir)) {
    send(res, 200, {
      service: 'autosoc',
      message: 'API is running. Start the console with npm run dev, or build the UI first.',
    });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const root = path.resolve(staticDir);
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
    send(res, 403, { error: 'Forbidden' });
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    sendFile(res, target);
    return;
  }
  const fallback = path.join(root, 'index.html');
  if (req.method === 'GET' && fs.existsSync(fallback)) {
    sendFile(res, fallback);
    return;
  }
  send(res, 404, { error: 'Not found' });
}

async function handleApi(req, res, store) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  const method = req.method || 'GET';

  if (method === 'GET' && pathname === '/api/health') {
    send(res, 200, { ok: true, service: 'autosoc' });
    return;
  }
  if (method === 'GET' && pathname === '/api/snapshot') {
    send(res, 200, store.snapshot());
    return;
  }
  if (
    method === 'GET' &&
    (pathname === '/api/events' || pathname === '/api/incidents' || pathname === '/api/playbooks')
  ) {
    const snapshot = store.snapshot();
    const key = pathname.slice('/api/'.length);
    send(res, 200, { [key]: snapshot[key] });
    return;
  }

  if (method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  if (pathname === '/api/live') {
    store.setLive(body.enabled);
    send(res, 200, { ok: true, snapshot: store.snapshot() });
    return;
  }
  if (pathname === '/api/demo/reset') {
    store.reset();
    send(res, 200, { ok: true, snapshot: store.snapshot() });
    return;
  }
  if (pathname === '/api/events') {
    const created = store.ingest(body);
    send(res, created ? 201 : 200, { ok: true, created, snapshot: store.snapshot() });
    return;
  }
  if (pathname === '/api/events/batch') {
    const records = Array.isArray(body.events) ? body.events : null;
    if (!records) {
      send(res, 400, { error: 'Expected { events: [] }' });
      return;
    }
    const created = store.ingestMany(records);
    send(res, 201, { ok: true, created: created.length, snapshot: store.snapshot() });
    return;
  }

  const eventAction = pathname.match(/^\/api\/events\/([^/]+)\/actions$/);
  if (eventAction) {
    const result = store.eventAction(decodeURIComponent(eventAction[1]), body.action);
    if (!result) {
      send(res, 404, { error: 'Event not found' });
      return;
    }
    send(res, 200, { ok: true, ...result, snapshot: store.snapshot() });
    return;
  }

  const incidentAction = pathname.match(/^\/api\/incidents\/([^/]+)\/actions$/);
  if (incidentAction) {
    const incident = store.incidentAction(decodeURIComponent(incidentAction[1]), body.action);
    if (!incident) {
      send(res, 404, { error: 'Incident not found' });
      return;
    }
    send(res, 200, { ok: true, incident, snapshot: store.snapshot() });
    return;
  }

  const toggle = pathname.match(/^\/api\/playbooks\/([^/]+)\/toggle$/);
  if (toggle) {
    const playbook = store.togglePlaybook(decodeURIComponent(toggle[1]));
    if (!playbook) {
      send(res, 404, { error: 'Playbook not found' });
      return;
    }
    send(res, 200, { ok: true, playbook, snapshot: store.snapshot() });
    return;
  }

  send(res, 404, { error: 'Not found' });
}

export function createRequestHandler({ store, staticDir }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, store);
        return;
      }
      if ((req.method || 'GET') !== 'GET' && (req.method || 'GET') !== 'HEAD') {
        send(res, 405, { error: 'Method not allowed' });
        return;
      }
      serveStatic(req, res, staticDir);
    } catch (error) {
      const status =
        error.status || (String(error.message || '').startsWith('Unknown') ? 400 : 500);
      send(res, status, { error: status === 500 ? 'Internal error' : error.message });
    }
  };
}
