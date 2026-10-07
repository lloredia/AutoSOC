import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectionMetrics, responseMetrics, sourceHealth } from './metrics.js';
import { defaultPlaybooks } from './playbooks.js';
import {
  advanceIncident,
  applyIncidentAction,
  createIncident,
  matchPlaybook,
  seedIncident,
} from './orchestrator.js';
import { processRawEvent } from './pipeline.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_EVENTS = 200;
const MAX_RUNNING = 5;

export function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => JSON.parse(line));
}

export function resolveDataPath(value, fallback) {
  const chosen = value || fallback;
  return path.isAbsolute(chosen) ? chosen : path.join(repoRoot, chosen);
}

export function loadDemoCatalog({
  eventsPath = resolveDataPath(process.env.SAMPLE_EVENTS_PATH, 'data/sample-events.jsonl'),
  iocsPath = resolveDataPath(process.env.SAMPLE_IOCS_PATH, 'data/sample-iocs.json'),
} = {}) {
  return {
    rawEvents: readJsonl(eventsPath),
    iocs: JSON.parse(fs.readFileSync(iocsPath, 'utf8')),
  };
}

export function createStore({
  rawEvents = [],
  iocs = {},
  playbooks = defaultPlaybooks(),
  now = () => new Date().toISOString(),
} = {}) {
  let state = emptyState(playbooks);

  function emptyState(bookList) {
    return {
      events: [],
      incidents: [],
      playbooks: structuredClone(bookList),
      seen: new Set(),
      live: true,
      cursor: 0,
      seq: 1000,
    };
  }

  function openIncident(event, progress, { force = false, ignoreCap = false } = {}) {
    if (state.events.find((item) => item.id === event.id)?.incidentId) {
      return state.incidents.find((incident) => incident.eventId === event.id) ?? null;
    }
    const running = state.incidents.filter((incident) => incident.status === 'running').length;
    const playbook =
      matchPlaybook(event, state.playbooks, { includeDisabled: force }) ||
      (force ? state.playbooks.find((item) => item.id === 'pb-manual') : null);
    if (!playbook) return null;
    if (!ignoreCap && !force && running >= MAX_RUNNING) return null;

    state.seq += 1;
    let incident = createIncident(event, playbook, { id: `INC-${state.seq}`, now: now() });
    if (progress) incident = seedIncident(incident, progress);
    state.incidents.unshift(incident);
    const linked = state.events.find((item) => item.id === event.id);
    if (linked) linked.incidentId = incident.id;
    return incident;
  }

  function ingest(raw, { ignoreCap = false } = {}) {
    const processed = processRawEvent(raw, { iocs, seen: state.seen, now });
    if (!processed) return null;
    state.events.unshift(processed.event);
    state.events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
    const incident = openIncident(processed.event, processed.demo?.progress, { ignoreCap });
    return { event: processed.event, incident };
  }

  function boot() {
    state = emptyState(playbooks);
    for (const raw of rawEvents) ingest(raw, { ignoreCap: true });
  }

  boot();

  return {
    boot,
    snapshot() {
      const events = state.events.map((event) => ({ ...event }));
      const incidents = state.incidents.map((incident) => ({
        ...incident,
        steps: incident.steps.map((step) => ({ ...step })),
      }));
      const books = state.playbooks.map((playbook) => ({
        ...playbook,
        steps: playbook.steps.map((step) => ({ ...step })),
      }));
      return {
        live: state.live,
        events,
        incidents,
        playbooks: books.filter((playbook) => !playbook.hidden),
        detection: detectionMetrics(events, incidents),
        response: responseMetrics(incidents, books),
        sources: sourceHealth(events),
        generatedAt: now(),
      };
    },
    setLive(enabled) {
      state.live = Boolean(enabled);
      return state.live;
    },
    reset() {
      boot();
    },
    ingest,
    ingestMany(records) {
      return records.map((record) => ingest(record)).filter(Boolean);
    },
    eventAction(eventId, action) {
      const event = state.events.find((item) => item.id === eventId);
      if (!event) return null;
      switch (action) {
        case 'block':
          event.status = 'blocked';
          return {
            event,
            incident: state.incidents.find((item) => item.id === event.incidentId) ?? null,
          };
        case 'resolve':
          event.status = 'resolved';
          return {
            event,
            incident: state.incidents.find((item) => item.id === event.incidentId) ?? null,
          };
        case 'investigate': {
          const incident =
            state.incidents.find((item) => item.eventId === event.id) ||
            openIncident(event, undefined, { force: true, ignoreCap: true });
          return { event, incident };
        }
        default: {
          const unknown = action;
          throw new Error(`Unknown event action: ${unknown}`);
        }
      }
    },
    incidentAction(incidentId, action) {
      const index = state.incidents.findIndex((incident) => incident.id === incidentId);
      if (index < 0) return null;
      const next = applyIncidentAction(state.incidents[index], action);
      state.incidents[index] = next;
      return next;
    },
    togglePlaybook(playbookId) {
      const playbook = state.playbooks.find((item) => item.id === playbookId);
      if (!playbook || playbook.hidden) return null;
      playbook.enabled = !playbook.enabled;
      return playbook;
    },
    tick() {
      if (!state.live) return { advanced: 0, ingested: null };
      let advanced = 0;
      state.incidents = state.incidents.map((incident) => {
        if (incident.status !== 'running') return incident;
        const runningIndex = incident.steps.findIndex((step) => step.status === 'running');
        const fail = incident.simulateFailure && runningIndex === 1;
        advanced += 1;
        return advanceIncident(incident, { succeed: !fail });
      });

      let ingested = null;
      if (rawEvents.length > 0 && state.events.length < MAX_EVENTS) {
        const template = rawEvents[state.cursor % rawEvents.length];
        state.cursor += 1;
        const payload = { ...template };
        delete payload.demo;
        delete payload.replayNonce;
        delete payload.id;
        ingested = ingest({
          ...payload,
          replayNonce: `${now()}-${state.cursor}`,
          timestamp: now(),
        });
      }
      return { advanced, ingested };
    },
  };
}
