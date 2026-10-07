export function emptyIntel() {
  return {
    is_known_threat: false,
    threat_types: [],
    confidence: 0,
    tags: [],
    first_seen: null,
    last_seen: null,
    sources: [],
  };
}

export function intelFromIocPayload(iocData) {
  const result = emptyIntel();
  const matches = iocData?.matches;
  if (!Array.isArray(matches) || matches.length === 0) return result;

  result.is_known_threat = true;
  result.confidence = Math.max(...matches.map((match) => match.confidence ?? 50));
  for (const match of matches) {
    if (match.threat_type) result.threat_types.push(match.threat_type);
    if (Array.isArray(match.tags)) result.tags.push(...match.tags);
    if (match.source) result.sources.push(match.source);
  }
  result.threat_types = [...new Set(result.threat_types)];
  result.tags = [...new Set(result.tags)];
  result.sources = [...new Set(result.sources)];
  return result;
}

export function lookupIoc(iocs, ip) {
  if (!ip || !iocs) return null;
  return iocs[ip] ?? null;
}

export function enrichEvent(event, iocs) {
  const intel = intelFromIocPayload(lookupIoc(iocs, event.sourceIp));
  return {
    ...event,
    enrichment: intel,
    iocMatch: intel.is_known_threat,
    threatScore: scoreWithIntel(event.threatScore, intel),
    severity: upgradeSeverity(event.severity, intel),
  };
}

const HIGH_RISK_TYPES = ['botnet', 'c2', 'ransomware', 'apt'];

export function scoreWithIntel(baseScore, enrichment) {
  let score = baseScore;
  if (enrichment?.is_known_threat) {
    score += 20;
    score = Math.min(100, score + Math.floor((enrichment.confidence || 0) / 5));
  }
  const types = enrichment?.threat_types || [];
  for (const threatType of types) {
    const normalized = String(threatType).toLowerCase();
    if (HIGH_RISK_TYPES.some((risk) => normalized.includes(risk))) {
      score += 15;
      break;
    }
  }
  return Math.min(100, score);
}

export function upgradeSeverity(severity, enrichment) {
  if (!enrichment?.is_known_threat || (enrichment.confidence || 0) <= 80) return severity;
  if (severity === 'low') return 'medium';
  if (severity === 'medium') return 'high';
  return severity;
}
