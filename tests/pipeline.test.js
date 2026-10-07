import { describe, expect, it } from 'vitest';
import { scoreWithIntel, upgradeSeverity } from '../lib/enrich.js';
import { normalizeEvent } from '../lib/normalize.js';
import { processRawEvent } from '../lib/pipeline.js';

const iocs = {
  '185.220.101.45': {
    matches: [{ confidence: 92, threat_type: 'botnet', tags: ['ssh'], source: 'SentinelForge' }],
  },
  '203.0.113.8': {
    matches: [{ confidence: 90, threat_type: 'scanner', tags: ['recon'], source: 'SentinelForge' }],
  },
};

describe('nexuswatch normalization', () => {
  it('maps honeytrap ssh brute force into a SIEM event', () => {
    const event = normalizeEvent({
      event_type: 'ssh_brute_force',
      service: 'ssh',
      source_ip: '185.220.101.45',
      dest_ip: '10.0.0.5',
      dest_port: 22,
      username: 'root',
      timestamp: '2026-01-22T08:14:00.000Z',
    });

    expect(event).toMatchObject({
      type: 'BRUTE_FORCE',
      severity: 'high',
      source: 'HoneyTrap-SSH',
      sourceIp: '185.220.101.45',
      destIp: '10.0.0.5',
      destPort: 22,
      threatScore: 75,
      status: 'active',
      details: 'User: root',
    });
    expect(event.id).toMatch(/^EVT-[A-F0-9]{12}$/);
  });

  it('builds honeytrap details and falls back when the event type is unknown', () => {
    const event = normalizeEvent({
      event_type: 'not-a-real-sensor',
      service: 'http',
      attacker_ip: '203.0.113.9',
      command: 'x'.repeat(140),
      payload: 'drop',
      user_agent: 'y'.repeat(80),
    });
    expect(event.type).toBe('ANOMALOUS_ACTIVITY');
    expect(event.severity).toBe('medium');
    expect(event.sourceIp).toBe('203.0.113.9');
    expect(event.details).toContain('Cmd: ');
    expect(event.details).toContain('Payload detected');
    expect(event.details.split('UA: ')[1]).toHaveLength(50);
  });

  it('rejects honeytrap events with a non-numeric port', () => {
    expect(
      normalizeEvent({ event_type: 'port_scan', service: 'ssh', dest_port: 'nope' }),
    ).toBeNull();
  });

  it('accepts an already normalized SIEM alert', () => {
    const event = normalizeEvent({
      id: 'EVT-PHISH-0001',
      type: 'PHISHING_DETECTED',
      severity: 'high',
      source: 'Email-Gateway',
      sourceIp: '203.0.113.50',
      destIp: '10.0.2.15',
      destPort: 25,
      details: 'Credential harvest',
      threatScore: 70,
    });
    expect(event.id).toBe('EVT-PHISH-0001');
    expect(event.icon).toBe('🎣');
  });
});

describe('nexuswatch scoring', () => {
  it('preserves the original bridge score order for a known high-risk indicator', () => {
    const score = scoreWithIntel(75, {
      is_known_threat: true,
      confidence: 92,
      threat_types: ['botnet'],
    });
    expect(score).toBe(100);
  });

  it('adds the known-threat boost without a high-risk category', () => {
    const score = scoreWithIntel(50, {
      is_known_threat: true,
      confidence: 50,
      threat_types: ['scanner'],
    });
    expect(score).toBe(80);
  });

  it('leaves unknown hosts at the base score', () => {
    expect(scoreWithIntel(30, { is_known_threat: false, confidence: 0, threat_types: [] })).toBe(
      30,
    );
  });

  it('raises severity only when indicator confidence is above 80', () => {
    const intel = { is_known_threat: true, confidence: 81 };
    expect(upgradeSeverity('low', intel)).toBe('medium');
    expect(upgradeSeverity('medium', intel)).toBe('high');
    expect(upgradeSeverity('high', intel)).toBe('high');
    expect(upgradeSeverity('low', { is_known_threat: true, confidence: 80 })).toBe('low');
  });
});

describe('ingest pipeline', () => {
  it('enriches, deduplicates, and ignores demo hints when hashing', () => {
    const seen = new Set();
    const raw = {
      event_type: 'ssh_brute_force',
      service: 'ssh',
      source_ip: '185.220.101.45',
      dest_ip: '10.0.0.5',
      dest_port: 22,
      timestamp: '2026-01-22T08:14:00.000Z',
      demo: { progress: 'running' },
    };
    const first = processRawEvent(raw, { iocs, seen });
    const second = processRawEvent(raw, { iocs, seen });

    expect(second).toBeNull();
    expect(first.demo).toEqual({ progress: 'running' });
    expect(first.event).toMatchObject({
      type: 'BRUTE_FORCE',
      iocMatch: true,
      threatScore: 100,
      severity: 'high',
      enrichment: { is_known_threat: true, threat_types: ['botnet'], confidence: 92 },
    });
  });

  it('upgrades a low-severity connection when the source is a high-confidence indicator', () => {
    const processed = processRawEvent(
      {
        event_type: 'connection',
        service: 'ssh',
        source_ip: '203.0.113.8',
        dest_port: 22,
        timestamp: '2026-01-22T08:00:00.000Z',
      },
      { iocs, seen: new Set() },
    );
    expect(processed.event.severity).toBe('medium');
    expect(processed.event.iocMatch).toBe(true);
    expect(processed.event.threatScore).toBe(68);
  });
});
