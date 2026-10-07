import { describe, expect, it } from 'vitest';
import { startServer } from '../server/index.js';
import { createStore } from '../lib/store.js';

async function listen(store) {
  return startServer({
    store,
    port: 0,
    host: '127.0.0.1',
    staticDir: null,
    liveIntervalMs: 60_000,
  });
}

describe('autosoc api', () => {
  it('serves the sample snapshot and incident controls', async () => {
    const store = createStore({
      rawEvents: [
        {
          id: 'EVT-BRUTE-0002',
          timestamp: '2026-01-22T15:01:00.000Z',
          type: 'BRUTE_FORCE',
          severity: 'high',
          source: 'HoneyTrap-HTTP',
          sourceIp: '45.155.205.90',
          destIp: '10.0.4.12',
          destPort: 443,
          threatScore: 70,
          demo: { progress: 'running' },
        },
      ],
      iocs: {},
      now: () => '2026-01-22T15:05:00.000Z',
    });
    store.setLive(false);
    const running = await listen(store);

    try {
      const health = await fetch(`http://127.0.0.1:${running.port}/api/health`);
      expect(health.status).toBe(200);

      const snapshot = await (await fetch(`http://127.0.0.1:${running.port}/api/snapshot`)).json();
      expect(snapshot.incidents).toHaveLength(1);
      const incidentId = snapshot.incidents[0].id;

      const paused = await fetch(
        `http://127.0.0.1:${running.port}/api/incidents/${incidentId}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pause' }),
        },
      );
      expect(paused.status).toBe(200);
      const pausedBody = await paused.json();
      expect(pausedBody.incident.status).toBe('paused');

      const unknown = await fetch(
        `http://127.0.0.1:${running.port}/api/incidents/${incidentId}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete' }),
        },
      );
      expect(unknown.status).toBe(400);

      const batch = await fetch(`http://127.0.0.1:${running.port}/api/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            {
              event_type: 'port_scan',
              service: 'ssh',
              source_ip: '198.51.100.23',
              dest_port: 22,
              timestamp: '2026-01-22T16:00:00.000Z',
            },
          ],
        }),
      });
      expect(batch.status).toBe(201);
      const batchBody = await batch.json();
      expect(batchBody.created).toBe(1);
      expect(batchBody.snapshot.events.some((event) => event.type === 'PORT_SCAN')).toBe(true);

      const missing = await fetch(
        `http://127.0.0.1:${running.port}/api/incidents/INC-missing/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pause' }),
        },
      );
      expect(missing.status).toBe(404);
    } finally {
      await running.close();
    }
  });
});
