const STEP_ELAPSED_SECONDS = 40;

export function matchPlaybook(event, playbooks, { includeDisabled = false } = {}) {
  return (
    playbooks.find((playbook) => {
      if (playbook.hidden || playbook.trigger === '*') return false;
      if (!includeDisabled && !playbook.enabled) return false;
      if (playbook.trigger !== event.type) return false;
      return playbook.severity.includes(event.severity);
    }) ?? null
  );
}

export function createIncident(event, playbook, { id, now }) {
  const steps = playbook.steps.map((step, index) => ({
    ...step,
    status: index === 0 ? 'running' : 'pending',
  }));
  return {
    id,
    eventId: event.id,
    timestamp: event.timestamp || now,
    type: event.type,
    severity: event.severity,
    status: 'running',
    playbook: playbook.name,
    playbookId: playbook.id,
    source: event.source,
    sourceIp: event.sourceIp,
    targetAsset: event.targetAsset || event.destIp,
    steps,
    currentStep: 1,
    totalSteps: steps.length,
    duration: 0,
    analyst: 'AutoSOC',
    escalated: false,
    simulateFailure: Boolean(event.simulateFailure),
    origin: 'nexuswatch',
  };
}

export function applyIncidentAction(incident, action) {
  switch (action) {
    case 'pause':
      if (incident.status !== 'running') return incident;
      return { ...incident, status: 'paused' };
    case 'resume':
      if (incident.status !== 'paused') return incident;
      return { ...incident, status: 'running' };
    case 'abort': {
      if (incident.status !== 'running' && incident.status !== 'paused') return incident;
      return {
        ...incident,
        status: 'failed',
        steps: incident.steps.map((step) =>
          step.status === 'running' ? { ...step, status: 'failed' } : step,
        ),
      };
    }
    case 'retry': {
      if (incident.status !== 'failed') return incident;
      return {
        ...incident,
        status: 'running',
        simulateFailure: false,
        currentStep: 1,
        steps: incident.steps.map((step, index) => ({
          ...step,
          status: index === 0 ? 'running' : 'pending',
        })),
      };
    }
    case 'escalate':
      return { ...incident, escalated: true, analyst: 'Tier 2' };
    default: {
      const unknown = action;
      throw new Error(`Unknown incident action: ${unknown}`);
    }
  }
}

export function advanceIncident(incident, { succeed = true, elapsed = STEP_ELAPSED_SECONDS } = {}) {
  if (incident.status !== 'running') return incident;
  const steps = incident.steps.map((step) => ({ ...step }));
  const index = steps.findIndex((step) => step.status === 'running');
  if (index < 0) return incident;

  const duration = incident.duration + elapsed;
  if (!succeed) {
    steps[index].status = 'failed';
    return {
      ...incident,
      steps,
      status: 'failed',
      currentStep: index + 1,
      duration,
    };
  }

  steps[index].status = 'completed';
  if (index < steps.length - 1) {
    steps[index + 1].status = 'running';
    return {
      ...incident,
      steps,
      status: 'running',
      currentStep: index + 2,
      duration,
    };
  }

  return {
    ...incident,
    steps,
    status: 'completed',
    currentStep: steps.length,
    duration,
  };
}

export function seedIncident(incident, progress) {
  switch (progress) {
    case 'running':
    case undefined:
      return incident;
    case 'mid': {
      const hops = Math.min(2, incident.steps.length - 1);
      let next = incident;
      for (let index = 0; index < hops; index += 1) {
        next = advanceIncident(next, { succeed: true });
      }
      return next;
    }
    case 'completed': {
      let next = incident;
      while (next.status === 'running') {
        next = advanceIncident(next, { succeed: true });
      }
      return next;
    }
    case 'failed': {
      let next = advanceIncident(incident, { succeed: true });
      if (next.status === 'running') next = advanceIncident(next, { succeed: false });
      return next;
    }
    case 'paused':
      return applyIncidentAction(advanceIncident(incident, { succeed: true }), 'pause');
    default: {
      const unknown = progress;
      throw new Error(`Unknown demo progress: ${unknown}`);
    }
  }
}
