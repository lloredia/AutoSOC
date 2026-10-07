import { describe, expect, it } from 'vitest';
import { defaultPlaybooks } from '../lib/playbooks.js';
import {
  advanceIncident,
  applyIncidentAction,
  createIncident,
  matchPlaybook,
  seedIncident,
} from '../lib/orchestrator.js';
import { createStore, loadDemoCatalog } from '../lib/store.js';

const playbooks = defaultPlaybooks();
const now = '2026-01-22T08:14:00.000Z';

function bruteEvent(overrides = {}) {
  return {
    id: 'EVT-BRUTE',
    timestamp: now,
    type: 'BRUTE_FORCE',
    severity: 'high',
    source: 'HoneyTrap-SSH',
    sourceIp: '185.220.101.45',
    destIp: '10.0.1.50',
    targetAsset: '10.0.1.50',
    simulateFailure: false,
    ...overrides,
  };
}

describe('playbook matching', () => {
  it('matches an enabled playbook by trigger and severity', () => {
    expect(matchPlaybook(bruteEvent(), playbooks)?.id).toBe('pb-001');
  });

  it('skips a disabled playbook unless an analyst forces the match', () => {
    const phishing = {
      ...bruteEvent(),
      id: 'EVT-PHISH-0001',
      type: 'PHISHING_DETECTED',
      severity: 'high',
    };
    expect(matchPlaybook(phishing, playbooks)).toBeNull();
    expect(matchPlaybook(phishing, playbooks, { includeDisabled: true })?.id).toBe('pb-005');
  });

  it('does not match when the severity is outside the playbook', () => {
    expect(matchPlaybook(bruteEvent({ severity: 'low' }), playbooks)).toBeNull();
  });
});

describe('incident execution', () => {
  const incident = () => createIncident(bruteEvent(), playbooks[0], { id: 'INC-1001', now });

  it('starts at the first step without mutating the playbook template', () => {
    const templateStatus = playbooks[0].steps[0].status;
    const created = incident();
    expect(created).toMatchObject({
      status: 'running',
      currentStep: 1,
      totalSteps: 5,
      analyst: 'AutoSOC',
      origin: 'nexuswatch',
      eventId: 'EVT-BRUTE',
    });
    expect(created.steps[0].status).toBe('running');
    expect(created.steps[1].status).toBe('pending');
    expect(playbooks[0].steps[0].status).toBe(templateStatus);
  });

  it('advances, pauses, resumes, aborts, retries, and escalates', () => {
    let current = incident();
    current = advanceIncident(current);
    expect(current.steps.map((step) => step.status)).toEqual([
      'completed',
      'running',
      'pending',
      'pending',
      'pending',
    ]);
    expect(current.currentStep).toBe(2);
    expect(current.duration).toBe(40);

    const paused = applyIncidentAction(current, 'pause');
    expect(paused.status).toBe('paused');
    expect(advanceIncident(paused)).toBe(paused);

    const resumed = applyIncidentAction(paused, 'resume');
    const aborted = applyIncidentAction(resumed, 'abort');
    expect(aborted.status).toBe('failed');
    expect(aborted.steps[1].status).toBe('failed');
    expect(applyIncidentAction(aborted, 'pause').status).toBe('failed');

    const retried = applyIncidentAction(aborted, 'retry');
    expect(retried.status).toBe('running');
    expect(retried.steps[0].status).toBe('running');
    expect(retried.steps.slice(1).every((step) => step.status === 'pending')).toBe(true);

    const escalated = applyIncidentAction(retried, 'escalate');
    expect(escalated).toMatchObject({ escalated: true, analyst: 'Tier 2', status: 'running' });
  });

  it('fails the running step and completes a playbook', () => {
    const failed = advanceIncident(incident(), { succeed: false, elapsed: 10 });
    expect(failed.status).toBe('failed');
    expect(failed.currentStep).toBe(1);
    expect(failed.duration).toBe(10);

    let done = incident();
    while (done.status === 'running') done = advanceIncident(done, { elapsed: 1 });
    expect(done.status).toBe('completed');
    expect(done.currentStep).toBe(5);
    expect(done.steps.every((step) => step.status === 'completed')).toBe(true);
  });

  it('rejects an unknown action', () => {
    expect(() => applyIncidentAction(incident(), 'delete')).toThrow(/Unknown incident action/);
  });

  it('seeds demo progress for the sample board', () => {
    expect(seedIncident(incident(), 'paused').status).toBe('paused');
    expect(seedIncident(incident(), 'failed').status).toBe('failed');
    expect(seedIncident(incident(), 'completed').status).toBe('completed');
    expect(seedIncident(incident(), 'mid').currentStep).toBe(3);
  });
});

describe('demo store', () => {
  const catalog = loadDemoCatalog();

  function demoStore() {
    return createStore({ ...catalog, now: () => '2026-01-22T21:00:00.000Z' });
  }

  it('loads the sample alerts into detection and response', () => {
    const snapshot = demoStore().snapshot();
    expect(snapshot.events).toHaveLength(catalog.rawEvents.length);
    expect(snapshot.events.some((event) => event.iocMatch)).toBe(true);
    expect(
      snapshot.events.find((event) => event.id === 'EVT-PHISH-0001').incidentId,
    ).toBeUndefined();
    expect(
      snapshot.events.find((event) => event.type === 'SQL_INJECTION').incidentId,
    ).toBeUndefined();

    const statuses = new Set(snapshot.incidents.map((incident) => incident.status));
    expect(statuses).toEqual(new Set(['running', 'failed', 'paused', 'completed']));
    expect(snapshot.playbooks.find((playbook) => playbook.id === 'pb-005').enabled).toBe(false);
    expect(snapshot.playbooks.some((playbook) => playbook.hidden)).toBe(false);
    expect(snapshot.response.activePlaybooks).toBe(5);
    expect(snapshot.sources.find((source) => source.name === 'EDR').events).toBeGreaterThan(0);
    expect(snapshot.sources.find((source) => source.name === 'SentinelForge').status).toBe('idle');
  });

  it('opens a manual investigation and blocks the source address', () => {
    const store = demoStore();
    const sql = store.snapshot().events.find((event) => event.type === 'SQL_INJECTION');
    const investigated = store.eventAction(sql.id, 'investigate');
    expect(investigated.incident.playbook).toBe('Manual Investigation');
    expect(investigated.incident.origin).toBe('nexuswatch');

    const scan = store.snapshot().events.find((event) => event.id === 'EVT-SCAN-0002');
    store.eventAction(scan.id, 'block');
    const blocked = store.snapshot();
    expect(blocked.events.find((event) => event.id === scan.id).status).toBe('blocked');
    expect(blocked.detection.blockedIps).toBeGreaterThan(0);
  });

  it('does not auto-open phishing until the playbook is enabled and a new alert arrives', () => {
    const store = demoStore();
    expect(store.togglePlaybook('pb-005').enabled).toBe(true);
    expect(
      store.snapshot().events.find((event) => event.id === 'EVT-PHISH-0001').incidentId,
    ).toBeUndefined();

    const created = store.ingest({
      id: 'EVT-PHISH-0002',
      type: 'PHISHING_DETECTED',
      severity: 'high',
      source: 'Email-Gateway',
      sourceIp: '203.0.113.51',
      destIp: '10.0.2.15',
      destPort: 25,
      threatScore: 70,
      timestamp: '2026-01-22T21:10:00.000Z',
    });
    expect(created.incident.playbookId).toBe('pb-005');
  });

  it('resets back to the sample board', () => {
    const store = demoStore();
    store.togglePlaybook('pb-001');
    store.eventAction('EVT-PHISH-0001', 'resolve');
    store.reset();
    const snapshot = store.snapshot();
    expect(snapshot.playbooks.find((playbook) => playbook.id === 'pb-001').enabled).toBe(true);
    expect(snapshot.events.find((event) => event.id === 'EVT-PHISH-0001').status).toBe('active');
  });

  it('stops advancing when live mode is off', () => {
    const store = demoStore();
    store.setLive(false);
    const before = store.snapshot().incidents.map((incident) => incident.duration);
    expect(store.tick()).toEqual({ advanced: 0, ingested: null });
    expect(store.snapshot().incidents.map((incident) => incident.duration)).toEqual(before);
  });
});
