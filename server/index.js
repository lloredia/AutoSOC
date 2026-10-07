import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from './app.js';
import { createStore, loadDemoCatalog } from '../lib/store.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnvFile(filePath = path.join(repoRoot, '.env')) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function startServer({
  store = createStore(loadDemoCatalog()),
  port = Number(process.env.PORT || 8787),
  host = process.env.HOST || '0.0.0.0',
  staticDir = path.join(repoRoot, 'dist'),
  liveIntervalMs = Number(process.env.LIVE_INTERVAL_MS || 3000),
} = {}) {
  const server = http.createServer(createRequestHandler({ store, staticDir }));
  const timer = setInterval(() => {
    if (process.env.DEMO_MODE !== 'false') store.tick();
  }, liveIntervalMs);
  timer.unref();

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        store,
        port: typeof address === 'object' && address ? address.port : port,
        close() {
          clearInterval(timer);
          return new Promise((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          });
        },
      });
    });
  });
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  loadEnvFile();
  const running = await startServer();
  console.log(`AutoSOC listening on http://${process.env.HOST || '0.0.0.0'}:${running.port}`);
}
