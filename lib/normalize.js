import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical.js';
import { HONEYTRAP_EVENT_MAPPING, SEVERITIES } from './event-map.js';
import { iconFor } from './icons.js';

export function eventIdFromPayload(payload) {
  const digest = createHash('sha256').update(canonicalJson(payload)).digest('hex');
  return `EVT-${digest.slice(0, 12).toUpperCase()}`;
}

export function splitIngestHints(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { demo: undefined, payload: raw };
  }
  const payload = { ...raw };
  const demo = payload.demo;
  delete payload.demo;
  delete payload.replayNonce;
  return { demo, payload };
}

function detailsFromHoneytrap(raw, type) {
  const parts = [];
  if (raw.username) parts.push(`User: ${raw.username}`);
  if (raw.command) parts.push(`Cmd: ${String(raw.command).slice(0, 100)}`);
  if (raw.payload) parts.push('Payload detected');
  if (raw.user_agent) parts.push(`UA: ${String(raw.user_agent).slice(0, 50)}`);
  if (parts.length > 0) return parts.join(' | ');
  return `Detected ${type.toLowerCase().replaceAll('_', ' ')}`;
}

export function isHoneytrapEvent(raw) {
  return Boolean(
    raw && typeof raw === 'object' && (raw.event_type || raw.attacker_ip || raw.service),
  );
}

export function normalizeHoneytrapEvent(raw, timestamp = new Date().toISOString()) {
  try {
    const eventType = raw.event_type || 'default';
    const mapping = HONEYTRAP_EVENT_MAPPING[eventType] || HONEYTRAP_EVENT_MAPPING.default;
    const service = raw.service || 'unknown';
    const sourceIp = raw.source_ip || raw.attacker_ip || '0.0.0.0';
    const destIp = raw.dest_ip || raw.honeypot_ip || '10.0.0.1';
    const destPort = Number(raw.dest_port ?? raw.port ?? 0);
    if (!Number.isInteger(destPort)) return null;

    return {
      id: raw.id || eventIdFromPayload(raw),
      timestamp: raw.timestamp || timestamp,
      type: mapping.type,
      severity: mapping.severity,
      icon: iconFor(mapping.type),
      source: `HoneyTrap-${String(service).toUpperCase()}`,
      sourceIp,
      destIp,
      destPort,
      targetAsset: raw.target_asset || raw.targetAsset || destIp,
      status: 'active',
      details: detailsFromHoneytrap(raw, mapping.type),
      iocMatch: false,
      threatScore: mapping.baseScore,
      simulateFailure: false,
    };
  } catch {
    return null;
  }
}

export function normalizeSiemEvent(raw, timestamp = new Date().toISOString()) {
  if (!raw || typeof raw.type !== 'string' || raw.type.length === 0) return null;
  const sourceIp = raw.sourceIp || raw.source_ip;
  if (!sourceIp) return null;
  const severity = raw.severity || 'medium';
  if (!SEVERITIES.includes(severity)) return null;
  const destPort = Number(raw.destPort ?? raw.dest_port ?? 0);
  if (!Number.isInteger(destPort)) return null;
  const threatScore = Number(raw.threatScore ?? raw.threat_score ?? 50);
  if (!Number.isFinite(threatScore)) return null;

  return {
    id: raw.id || eventIdFromPayload(raw),
    timestamp: raw.timestamp || timestamp,
    type: raw.type,
    severity,
    icon: raw.icon || iconFor(raw.type),
    source: raw.source || 'Unknown',
    sourceIp,
    destIp: raw.destIp || raw.dest_ip || '0.0.0.0',
    destPort,
    targetAsset: raw.targetAsset || raw.target_asset || raw.destIp || raw.dest_ip || '0.0.0.0',
    status: raw.status || 'active',
    details: raw.details || `Detected ${raw.type.toLowerCase().replaceAll('_', ' ')}`,
    iocMatch: Boolean(raw.iocMatch),
    threatScore,
    simulateFailure: Boolean(raw.simulateFailure),
  };
}

export function normalizeEvent(raw, timestamp) {
  if (isHoneytrapEvent(raw)) return normalizeHoneytrapEvent(raw, timestamp);
  return normalizeSiemEvent(raw, timestamp);
}
