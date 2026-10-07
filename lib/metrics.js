const BLOCK_ACTIONS = new Set([
  'firewall_block',
  'firewall_block_dest',
  'dns_sinkhole',
  'email_block_domain',
]);

export const SOURCE_CATALOG = [
  'HoneyTrap-SSH',
  'HoneyTrap-HTTP',
  'SentinelForge',
  'Firewall',
  'IDS/IPS',
  'EDR',
  'WAF',
  'DNS-Monitor',
];

export function detectionMetrics(events, incidents, now = Date.now()) {
  const recent = events.filter((event) => now - Date.parse(event.timestamp) <= 60_000);
  const completed = incidents.filter((incident) => incident.status === 'completed');
  const avgSeconds =
    completed.length === 0
      ? 0
      : completed.reduce((total, incident) => total + incident.duration, 0) / completed.length;
  const blocked = new Set(incidents.filter(incidentBlockedIp).map((incident) => incident.sourceIp));
  for (const event of events) {
    if (event.status === 'blocked') blocked.add(event.sourceIp);
  }

  return {
    totalEvents: events.length,
    criticalAlerts: events.filter((event) => event.severity === 'critical').length,
    activeThreats: events.filter(
      (event) =>
        event.status === 'active' && (event.severity === 'critical' || event.severity === 'high'),
    ).length,
    blockedIps: blocked.size,
    iocMatches: events.filter((event) => event.iocMatch).length,
    eventsPerSecond: Number((recent.length / 60).toFixed(2)),
    avgResponseTime: avgSeconds.toFixed(2),
    dataSources: new Set(events.map((event) => event.source)).size,
  };
}

function incidentBlockedIp(incident) {
  return incident.steps.some(
    (step) => step.status === 'completed' && BLOCK_ACTIONS.has(step.action),
  );
}

export function responseMetrics(incidents, playbooks) {
  const completed = incidents.filter((incident) => incident.status === 'completed').length;
  const failed = incidents.filter((incident) => incident.status === 'failed').length;
  const finished = completed + failed;
  const avgTime =
    incidents.length === 0
      ? 0
      : Math.round(
          incidents.reduce((total, incident) => total + incident.duration, 0) /
            incidents.length /
            60,
        );

  return {
    running: incidents.filter((incident) => incident.status === 'running').length,
    completed,
    failed,
    paused: incidents.filter((incident) => incident.status === 'paused').length,
    avgTime,
    successRate: finished === 0 ? 0 : Math.round((completed / finished) * 100),
    activePlaybooks: playbooks.filter((playbook) => playbook.enabled && !playbook.hidden).length,
    totalPlaybooks: playbooks.filter((playbook) => !playbook.hidden).length,
  };
}

export function sourceHealth(events) {
  const counts = new Map();
  for (const event of events) {
    counts.set(event.source, (counts.get(event.source) || 0) + 1);
  }
  const names = [...SOURCE_CATALOG];
  for (const name of counts.keys()) {
    if (!names.includes(name)) names.push(name);
  }
  return names.map((name) => ({
    name,
    events: counts.get(name) || 0,
    status: counts.get(name) ? 'active' : 'idle',
  }));
}
