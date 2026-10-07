import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical.js';
import { enrichEvent } from './enrich.js';
import { normalizeEvent, splitIngestHints } from './normalize.js';

export function fingerprint(payload) {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function processRawEvent(
  raw,
  { iocs = {}, seen = new Set(), now = () => new Date().toISOString() } = {},
) {
  const { demo, payload } = splitIngestHints(raw);
  if (!payload || typeof payload !== 'object') return null;

  const digest = fingerprint(payload);
  if (seen.has(digest)) return null;

  const event = normalizeEvent(payload, now());
  if (!event) return null;

  seen.add(digest);
  return {
    demo,
    event: enrichEvent(event, iocs),
  };
}
