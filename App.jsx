import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ============================================================================
// AUTOSOC - INCIDENT RESPONSE ORCHESTRATOR
// SecOps Command Center Component 4
// ============================================================================

// Playbook definitions
const PLAYBOOKS = [
  {
    id: 'pb-001',
    name: 'Brute Force Response',
    description: 'Automated response to brute force authentication attempts',
    trigger: 'BRUTE_FORCE',
    severity: ['high', 'critical'],
    steps: [
      { id: 1, name: 'Block Source IP', action: 'firewall_block', timeout: 30, status: 'pending' },
      { id: 2, name: 'Enrich with Threat Intel', action: 'sentinelforge_lookup', timeout: 60, status: 'pending' },
      { id: 3, name: 'Capture Forensics', action: 'collect_logs', timeout: 120, status: 'pending' },
      { id: 4, name: 'Notify SOC Team', action: 'send_alert', timeout: 30, status: 'pending' },
      { id: 5, name: 'Create Ticket', action: 'create_incident', timeout: 30, status: 'pending' },
    ],
    enabled: true,
    executions: 147,
    avgTime: '2m 34s',
    successRate: 98.2,
  },
  {
    id: 'pb-002',
    name: 'Malware Containment',
    description: 'Isolate infected endpoint and initiate remediation',
    trigger: 'MALWARE_DETECTED',
    severity: ['critical'],
    steps: [
      { id: 1, name: 'Isolate Endpoint', action: 'edr_isolate', timeout: 15, status: 'pending' },
      { id: 2, name: 'Kill Malicious Process', action: 'edr_kill_process', timeout: 30, status: 'pending' },
      { id: 3, name: 'Collect Memory Dump', action: 'forensics_memdump', timeout: 300, status: 'pending' },
      { id: 4, name: 'Scan for IOCs', action: 'ioc_scan', timeout: 180, status: 'pending' },
      { id: 5, name: 'Quarantine Files', action: 'quarantine', timeout: 60, status: 'pending' },
      { id: 6, name: 'Escalate to Tier 2', action: 'escalate', timeout: 30, status: 'pending' },
    ],
    enabled: true,
    executions: 23,
    avgTime: '8m 12s',
    successRate: 95.7,
  },
  {
    id: 'pb-003',
    name: 'Data Exfiltration Response',
    description: 'Respond to potential data exfiltration attempts',
    trigger: 'DATA_EXFILTRATION',
    severity: ['critical'],
    steps: [
      { id: 1, name: 'Block Destination', action: 'firewall_block_dest', timeout: 15, status: 'pending' },
      { id: 2, name: 'Terminate Connection', action: 'kill_connection', timeout: 10, status: 'pending' },
      { id: 3, name: 'Capture Network Traffic', action: 'pcap_capture', timeout: 60, status: 'pending' },
      { id: 4, name: 'Identify Data Scope', action: 'dlp_scan', timeout: 300, status: 'pending' },
      { id: 5, name: 'Preserve Evidence', action: 'evidence_collection', timeout: 120, status: 'pending' },
      { id: 6, name: 'Executive Notification', action: 'exec_alert', timeout: 30, status: 'pending' },
      { id: 7, name: 'Legal Hold', action: 'legal_hold', timeout: 60, status: 'pending' },
    ],
    enabled: true,
    executions: 8,
    avgTime: '12m 45s',
    successRate: 100,
  },
  {
    id: 'pb-004',
    name: 'C2 Communication Block',
    description: 'Detect and block command & control communications',
    trigger: 'C2_COMMUNICATION',
    severity: ['critical', 'high'],
    steps: [
      { id: 1, name: 'Block C2 Domain/IP', action: 'dns_sinkhole', timeout: 15, status: 'pending' },
      { id: 2, name: 'Isolate Affected Host', action: 'edr_isolate', timeout: 30, status: 'pending' },
      { id: 3, name: 'Hunt for Persistence', action: 'persistence_scan', timeout: 180, status: 'pending' },
      { id: 4, name: 'Update Threat Intel', action: 'sentinelforge_update', timeout: 30, status: 'pending' },
      { id: 5, name: 'Network-wide Scan', action: 'network_ioc_scan', timeout: 600, status: 'pending' },
    ],
    enabled: true,
    executions: 34,
    avgTime: '15m 22s',
    successRate: 97.1,
  },
  {
    id: 'pb-005',
    name: 'Phishing Response',
    description: 'Handle reported phishing emails and compromised accounts',
    trigger: 'PHISHING_DETECTED',
    severity: ['medium', 'high'],
    steps: [
      { id: 1, name: 'Quarantine Email', action: 'email_quarantine', timeout: 30, status: 'pending' },
      { id: 2, name: 'Extract IOCs', action: 'email_ioc_extract', timeout: 60, status: 'pending' },
      { id: 3, name: 'Block Sender Domain', action: 'email_block_domain', timeout: 30, status: 'pending' },
      { id: 4, name: 'Search Mailboxes', action: 'email_search', timeout: 300, status: 'pending' },
      { id: 5, name: 'Reset Credentials', action: 'password_reset', timeout: 60, status: 'pending' },
      { id: 6, name: 'User Notification', action: 'user_notify', timeout: 30, status: 'pending' },
    ],
    enabled: false,
    executions: 89,
    avgTime: '5m 18s',
    successRate: 99.1,
  },
  {
    id: 'pb-006',
    name: 'Privilege Escalation',
    description: 'Respond to unauthorized privilege escalation attempts',
    trigger: 'PRIVILEGE_ESCALATION',
    severity: ['high', 'critical'],
    steps: [
      { id: 1, name: 'Disable Account', action: 'disable_account', timeout: 15, status: 'pending' },
      { id: 2, name: 'Revoke Sessions', action: 'revoke_sessions', timeout: 30, status: 'pending' },
      { id: 3, name: 'Audit Access Logs', action: 'access_audit', timeout: 180, status: 'pending' },
      { id: 4, name: 'Check for Lateral Movement', action: 'lateral_scan', timeout: 300, status: 'pending' },
      { id: 5, name: 'Manager Notification', action: 'manager_alert', timeout: 30, status: 'pending' },
    ],
    enabled: true,
    executions: 56,
    avgTime: '6m 42s',
    successRate: 96.4,
  },
];

// Generate mock incident
const generateIncident = (id) => {
  const types = ['BRUTE_FORCE', 'MALWARE_DETECTED', 'DATA_EXFILTRATION', 'C2_COMMUNICATION', 'PRIVILEGE_ESCALATION'];
  const severities = ['critical', 'high', 'medium'];
  const statuses = ['running', 'completed', 'failed', 'pending', 'paused'];
  const sources = ['NexusWatch', 'HoneyTrap-SSH', 'SentinelForge', 'EDR', 'Firewall'];
  
  const type = types[Math.floor(Math.random() * types.length)];
  const playbook = PLAYBOOKS.find(p => p.trigger === type) || PLAYBOOKS[0];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  const steps = playbook.steps.map((step, i) => {
    let stepStatus = 'pending';
    if (status === 'completed') stepStatus = 'completed';
    else if (status === 'failed' && i === Math.floor(Math.random() * playbook.steps.length)) stepStatus = 'failed';
    else if (status === 'running') {
      if (i < Math.floor(Math.random() * playbook.steps.length)) stepStatus = 'completed';
      else if (i === Math.floor(Math.random() * playbook.steps.length)) stepStatus = 'running';
    }
    return { ...step, status: stepStatus };
  });

  return {
    id: `INC-${id.toString().padStart(6, '0')}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    type,
    severity: severities[Math.floor(Math.random() * severities.length)],
    status,
    playbook: playbook.name,
    playbookId: playbook.id,
    source: sources[Math.floor(Math.random() * sources.length)],
    sourceIp: `${Math.floor(Math.random() * 200 + 50)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    targetAsset: `WORKSTATION-${Math.floor(Math.random() * 500 + 100)}`,
    steps,
    currentStep: steps.findIndex(s => s.status === 'running') + 1 || (status === 'completed' ? steps.length : 0),
    totalSteps: steps.length,
    duration: Math.floor(Math.random() * 900) + 60,
    analyst: status !== 'pending' ? ['Sarah Chen', 'Mike Rodriguez', 'Alex Kim', 'Jordan Lee'][Math.floor(Math.random() * 4)] : null,
  };
};

// Status colors
const statusColors = {
  running: { bg: '#00d4ff', text: '#000', glow: 'rgba(0, 212, 255, 0.5)' },
  completed: { bg: '#00ff88', text: '#000', glow: 'rgba(0, 255, 136, 0.5)' },
  failed: { bg: '#ff0040', text: '#fff', glow: 'rgba(255, 0, 64, 0.5)' },
  pending: { bg: '#64748b', text: '#fff', glow: 'rgba(100, 116, 139, 0.3)' },
  paused: { bg: '#ffc800', text: '#000', glow: 'rgba(255, 200, 0, 0.5)' },
};

const severityColors = {
  critical: '#ff0040',
  high: '#ff6b00',
  medium: '#ffc800',
  low: '#00d4ff',
};

// ============================================================================
// COMPONENTS
// ============================================================================

const ScanLine = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
    zIndex: 9999,
    opacity: 0.2,
  }} />
);

const MetricCard = ({ label, value, icon, color = '#00d4ff', subtitle }) => (
  <div style={{
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
    border: '1px solid rgba(148, 163, 184, 0.1)',
    borderRadius: '8px',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '4px',
      height: '100%',
      background: color,
      boxShadow: `0 0 20px ${color}`,
    }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{
          fontSize: '11px',
          color: 'rgba(148, 163, 184, 0.8)',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          marginBottom: '8px',
          fontFamily: '"IBM Plex Mono", monospace',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '32px',
          fontWeight: '700',
          color,
          fontFamily: '"Rajdhani", sans-serif',
          lineHeight: 1,
        }}>
          {value}
        </div>
        {subtitle && (
          <div style={{
            fontSize: '11px',
            color: 'rgba(148, 163, 184, 0.6)',
            marginTop: '6px',
            fontFamily: '"IBM Plex Mono", monospace',
          }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ fontSize: '28px', opacity: 0.4 }}>{icon}</div>
    </div>
  </div>
);

const PlaybookCard = ({ playbook, onToggle, onView }) => (
  <div style={{
    background: playbook.enabled 
      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)'
      : 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
    border: `1px solid ${playbook.enabled ? 'rgba(0, 212, 255, 0.3)' : 'rgba(148, 163, 184, 0.1)'}`,
    borderRadius: '8px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }}
  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
  onClick={() => onView(playbook)}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: playbook.enabled ? '#00d4ff' : '#94a3b8',
        fontFamily: '"Rajdhani", sans-serif',
      }}>
        {playbook.name}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(playbook.id); }}
        style={{
          background: playbook.enabled ? 'rgba(0, 255, 136, 0.2)' : 'rgba(100, 116, 139, 0.2)',
          border: `1px solid ${playbook.enabled ? '#00ff88' : '#64748b'}`,
          borderRadius: '12px',
          padding: '4px 12px',
          fontSize: '10px',
          color: playbook.enabled ? '#00ff88' : '#64748b',
          cursor: 'pointer',
          fontFamily: '"IBM Plex Mono", monospace',
          textTransform: 'uppercase',
        }}
      >
        {playbook.enabled ? 'Active' : 'Disabled'}
      </button>
    </div>
    <div style={{
      fontSize: '11px',
      color: 'rgba(148, 163, 184, 0.7)',
      marginBottom: '12px',
      lineHeight: '1.4',
      fontFamily: '"IBM Plex Mono", monospace',
    }}>
      {playbook.description}
    </div>
    <div style={{
      display: 'flex',
      gap: '16px',
      fontSize: '10px',
      fontFamily: '"IBM Plex Mono", monospace',
    }}>
      <span style={{ color: '#64748b' }}>
        <span style={{ color: '#00d4ff' }}>{playbook.executions}</span> runs
      </span>
      <span style={{ color: '#64748b' }}>
        <span style={{ color: '#ffc800' }}>{playbook.avgTime}</span> avg
      </span>
      <span style={{ color: '#64748b' }}>
        <span style={{ color: '#00ff88' }}>{playbook.successRate}%</span> success
      </span>
    </div>
    <div style={{
      marginTop: '12px',
      display: 'flex',
      gap: '6px',
    }}>
      {playbook.severity.map(s => (
        <span key={s} style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '9px',
          background: `${severityColors[s]}20`,
          color: severityColors[s],
          textTransform: 'uppercase',
          fontFamily: '"IBM Plex Mono", monospace',
        }}>
          {s}
        </span>
      ))}
    </div>
  </div>
);

const IncidentRow = ({ incident, onClick }) => {
  const colors = statusColors[incident.status];
  
  return (
    <div
      onClick={() => onClick(incident)}
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 90px 1fr 140px 100px 80px 100px',
        gap: '12px',
        padding: '14px 16px',
        background: incident.status === 'running' 
          ? 'rgba(0, 212, 255, 0.05)'
          : incident.status === 'failed'
          ? 'rgba(255, 0, 64, 0.05)'
          : 'transparent',
        borderLeft: `3px solid ${colors.bg}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        fontSize: '12px',
        fontFamily: '"IBM Plex Mono", monospace',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = incident.status === 'running' 
        ? 'rgba(0, 212, 255, 0.05)'
        : incident.status === 'failed'
        ? 'rgba(255, 0, 64, 0.05)'
        : 'transparent'}
    >
      <div style={{ color: '#94a3b8' }}>{incident.id}</div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: colors.bg,
          boxShadow: `0 0 8px ${colors.glow}`,
          animation: incident.status === 'running' ? 'pulse 1.5s infinite' : 'none',
        }} />
        <span style={{ color: colors.bg, textTransform: 'uppercase', fontSize: '10px' }}>
          {incident.status}
        </span>
      </div>
      <div style={{ color: '#e2e8f0' }}>{incident.playbook}</div>
      <div style={{ color: '#ff6b00' }}>{incident.sourceIp}</div>
      <div style={{ color: '#94a3b8' }}>{incident.targetAsset}</div>
      <div style={{ color: '#00d4ff' }}>
        {incident.currentStep}/{incident.totalSteps}
      </div>
      <div style={{ color: '#94a3b8' }}>
        {Math.floor(incident.duration / 60)}m {incident.duration % 60}s
      </div>
    </div>
  );
};

const StepProgress = ({ steps, compact = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '8px' : '12px' }}>
    {steps.map((step, i) => {
      const colors = statusColors[step.status];
      return (
        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: compact ? '24px' : '32px',
            height: compact ? '24px' : '32px',
            borderRadius: '50%',
            background: step.status === 'completed' ? colors.bg : 'transparent',
            border: `2px solid ${colors.bg}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? '10px' : '12px',
            color: step.status === 'completed' ? colors.text : colors.bg,
            fontFamily: '"IBM Plex Mono", monospace',
            boxShadow: step.status === 'running' ? `0 0 12px ${colors.glow}` : 'none',
            animation: step.status === 'running' ? 'pulse 1.5s infinite' : 'none',
          }}>
            {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: compact ? '11px' : '13px',
              color: step.status === 'pending' ? '#64748b' : '#e2e8f0',
              fontFamily: '"IBM Plex Mono", monospace',
            }}>
              {step.name}
            </div>
            {!compact && (
              <div style={{
                fontSize: '10px',
                color: '#64748b',
                fontFamily: '"IBM Plex Mono", monospace',
              }}>
                {step.action} • timeout: {step.timeout}s
              </div>
            )}
          </div>
          {step.status === 'running' && (
            <div style={{
              fontSize: '10px',
              color: '#00d4ff',
              fontFamily: '"IBM Plex Mono", monospace',
            }}>
              In Progress...
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const IncidentModal = ({ incident, onClose, onAction }) => {
  if (!incident) return null;
  
  const colors = statusColors[incident.status];
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: `1px solid ${colors.bg}`,
          borderRadius: '12px',
          padding: '28px',
          width: '700px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: `0 0 60px ${colors.glow}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              fontFamily: '"IBM Plex Mono", monospace',
              marginBottom: '4px',
            }}>
              {incident.id}
            </div>
            <div style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#e2e8f0',
              fontFamily: '"Rajdhani", sans-serif',
            }}>
              {incident.playbook}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '8px',
            }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                background: `${colors.bg}20`,
                color: colors.bg,
                textTransform: 'uppercase',
                fontFamily: '"IBM Plex Mono", monospace',
              }}>
                {incident.status}
              </span>
              <span style={{
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                background: `${severityColors[incident.severity]}20`,
                color: severityColors[incident.severity],
                textTransform: 'uppercase',
                fontFamily: '"IBM Plex Mono", monospace',
              }}>
                {incident.severity}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#94a3b8',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
            ESC
          </button>
        </div>

        {/* Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {[
            { label: 'Source', value: incident.source },
            { label: 'Source IP', value: incident.sourceIp, color: '#ff6b00' },
            { label: 'Target', value: incident.targetAsset },
            { label: 'Duration', value: `${Math.floor(incident.duration / 60)}m ${incident.duration % 60}s` },
            { label: 'Progress', value: `${incident.currentStep}/${incident.totalSteps} steps`, color: '#00d4ff' },
            { label: 'Analyst', value: incident.analyst || 'Unassigned', color: incident.analyst ? '#00ff88' : '#64748b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '12px',
              borderRadius: '6px',
            }}>
              <div style={{
                fontSize: '10px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '4px',
                fontFamily: '"IBM Plex Mono", monospace',
              }}>
                {label}
              </div>
              <div style={{
                fontSize: '13px',
                color: color || '#e2e8f0',
                fontFamily: '"IBM Plex Mono", monospace',
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Playbook Steps */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
            fontFamily: '"IBM Plex Mono", monospace',
          }}>
            Playbook Execution
          </div>
          <StepProgress steps={incident.steps} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {incident.status === 'running' && (
            <button
              onClick={() => onAction('pause', incident)}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(255, 200, 0, 0.2) 0%, rgba(255, 200, 0, 0.1) 100%)',
                border: '1px solid rgba(255, 200, 0, 0.5)',
                color: '#ffc800',
                padding: '14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"IBM Plex Mono", monospace',
                fontWeight: '600',
              }}
            >
              ⏸ PAUSE
            </button>
          )}
          {incident.status === 'paused' && (
            <button
              onClick={() => onAction('resume', incident)}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%)',
                border: '1px solid rgba(0, 212, 255, 0.5)',
                color: '#00d4ff',
                padding: '14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"IBM Plex Mono", monospace',
                fontWeight: '600',
              }}
            >
              ▶ RESUME
            </button>
          )}
          {(incident.status === 'running' || incident.status === 'paused') && (
            <button
              onClick={() => onAction('abort', incident)}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(255, 0, 64, 0.2) 0%, rgba(255, 0, 64, 0.1) 100%)',
                border: '1px solid rgba(255, 0, 64, 0.5)',
                color: '#ff0040',
                padding: '14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"IBM Plex Mono", monospace',
                fontWeight: '600',
              }}
            >
              ✗ ABORT
            </button>
          )}
          {incident.status === 'failed' && (
            <button
              onClick={() => onAction('retry', incident)}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 255, 136, 0.1) 100%)',
                border: '1px solid rgba(0, 255, 136, 0.5)',
                color: '#00ff88',
                padding: '14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"IBM Plex Mono", monospace',
                fontWeight: '600',
              }}
            >
              ↻ RETRY
            </button>
          )}
          <button
            onClick={() => onAction('escalate', incident)}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.2) 0%, rgba(255, 107, 0, 0.1) 100%)',
              border: '1px solid rgba(255, 107, 0, 0.5)',
              color: '#ff6b00',
              padding: '14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: '"IBM Plex Mono", monospace',
              fontWeight: '600',
            }}
          >
            ⬆ ESCALATE
          </button>
        </div>
      </div>
    </div>
  );
};

const PlaybookModal = ({ playbook, onClose }) => {
  if (!playbook) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '12px',
          padding: '28px',
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 0 60px rgba(0, 212, 255, 0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              fontFamily: '"IBM Plex Mono", monospace',
              marginBottom: '4px',
            }}>
              {playbook.id}
            </div>
            <div style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#00d4ff',
              fontFamily: '"Rajdhani", sans-serif',
            }}>
              {playbook.name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#94a3b8',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
            ESC
          </button>
        </div>

        <div style={{
          fontSize: '13px',
          color: '#94a3b8',
          marginBottom: '20px',
          lineHeight: '1.5',
          fontFamily: '"IBM Plex Mono", monospace',
        }}>
          {playbook.description}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '24px',
        }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontFamily: '"IBM Plex Mono", monospace' }}>TRIGGER</div>
            <div style={{ fontSize: '12px', color: '#00d4ff', fontFamily: '"IBM Plex Mono", monospace' }}>{playbook.trigger}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontFamily: '"IBM Plex Mono", monospace' }}>EXECUTIONS</div>
            <div style={{ fontSize: '12px', color: '#ffc800', fontFamily: '"IBM Plex Mono", monospace' }}>{playbook.executions}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontFamily: '"IBM Plex Mono", monospace' }}>SUCCESS RATE</div>
            <div style={{ fontSize: '12px', color: '#00ff88', fontFamily: '"IBM Plex Mono", monospace' }}>{playbook.successRate}%</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '20px',
        }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
            fontFamily: '"IBM Plex Mono", monospace',
          }}>
            Playbook Steps ({playbook.steps.length})
          </div>
          <StepProgress steps={playbook.steps} compact />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function AutoSOC() {
  const [playbooks, setPlaybooks] = useState(PLAYBOOKS);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState(null);
  const [filter, setFilter] = useState('all');
  const [isLive, setIsLive] = useState(true);

  // Initialize incidents
  useEffect(() => {
    const initial = Array(30).fill(null).map((_, i) => generateIncident(1000 + i));
    setIncidents(initial.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
  }, []);

  // Simulate live updates
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setIncidents(prev => {
        const updated = prev.map(inc => {
          if (inc.status === 'running' && Math.random() > 0.7) {
            const newSteps = [...inc.steps];
            const runningIdx = newSteps.findIndex(s => s.status === 'running');
            if (runningIdx >= 0) {
              newSteps[runningIdx].status = Math.random() > 0.1 ? 'completed' : 'failed';
              if (newSteps[runningIdx].status === 'completed' && runningIdx < newSteps.length - 1) {
                newSteps[runningIdx + 1].status = 'running';
              }
            }
            const allComplete = newSteps.every(s => s.status === 'completed');
            const anyFailed = newSteps.some(s => s.status === 'failed');
            return {
              ...inc,
              steps: newSteps,
              status: anyFailed ? 'failed' : allComplete ? 'completed' : 'running',
              currentStep: newSteps.filter(s => s.status === 'completed').length + (anyFailed || allComplete ? 0 : 1),
              duration: inc.duration + 3,
            };
          }
          return inc;
        });

        // Occasionally add new incident
        if (Math.random() > 0.8) {
          const newInc = generateIncident(Date.now());
          newInc.status = 'running';
          newInc.steps[0].status = 'running';
          return [newInc, ...updated].slice(0, 100);
        }
        return updated;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedIncident(null);
        setSelectedPlaybook(null);
      }
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setIsLive(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const togglePlaybook = useCallback((id) => {
    setPlaybooks(prev => prev.map(p => 
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ));
  }, []);

  const handleAction = useCallback((action, incident) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id !== incident.id) return inc;
      switch (action) {
        case 'pause':
          return { ...inc, status: 'paused' };
        case 'resume':
          return { ...inc, status: 'running' };
        case 'abort':
          return { ...inc, status: 'failed' };
        case 'retry':
          return { ...inc, status: 'running', steps: inc.steps.map(s => ({ ...s, status: 'pending' })) };
        default:
          return inc;
      }
    }));
    setSelectedIncident(null);
  }, []);

  const filteredIncidents = useMemo(() => {
    if (filter === 'all') return incidents;
    return incidents.filter(i => i.status === filter);
  }, [incidents, filter]);

  const metrics = useMemo(() => ({
    running: incidents.filter(i => i.status === 'running').length,
    completed: incidents.filter(i => i.status === 'completed').length,
    failed: incidents.filter(i => i.status === 'failed').length,
    avgTime: Math.round(incidents.reduce((a, i) => a + i.duration, 0) / incidents.length / 60),
    successRate: Math.round(incidents.filter(i => i.status === 'completed').length / incidents.filter(i => ['completed', 'failed'].includes(i.status)).length * 100) || 0,
    activePlaybooks: playbooks.filter(p => p.enabled).length,
  }), [incidents, playbooks]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1a 0%, #111827 50%, #0a0f1a 100%)',
      color: '#e2e8f0',
      fontFamily: '"Inter", -apple-system, sans-serif',
    }}>
      <ScanLine />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Rajdhani:wght@500;600;700&display=swap');
        
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(0, 212, 255, 0.3); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: '1800px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #ff6b00 0%, #ff0040 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(255, 107, 0, 0.4)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div style={{
                fontSize: '26px',
                fontWeight: '700',
                fontFamily: '"Rajdhani", sans-serif',
                background: 'linear-gradient(90deg, #ff6b00 0%, #ff0040 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                AUTOSOC
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(148, 163, 184, 0.7)',
                letterSpacing: '2px',
                fontFamily: '"IBM Plex Mono", monospace',
              }}>
                INCIDENT RESPONSE ORCHESTRATOR
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: isLive ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 200, 0, 0.1)',
                border: `1px solid ${isLive ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 200, 0, 0.3)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setIsLive(!isLive)}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isLive ? '#00ff88' : '#ffc800',
                boxShadow: `0 0 8px ${isLive ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 200, 0, 0.5)'}`,
                animation: isLive ? 'pulse 1.5s infinite' : 'none',
              }} />
              <span style={{
                fontSize: '11px',
                fontFamily: '"IBM Plex Mono", monospace',
                color: isLive ? '#00ff88' : '#ffc800',
              }}>
                {isLive ? 'LIVE' : 'PAUSED'}
              </span>
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(148, 163, 184, 0.6)',
              fontFamily: '"IBM Plex Mono", monospace',
            }}>
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1800px', margin: '0 auto', padding: '24px' }}>
        {/* Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <MetricCard label="Running" value={metrics.running} icon="▶" color="#00d4ff" subtitle="Active responses" />
          <MetricCard label="Completed" value={metrics.completed} icon="✓" color="#00ff88" subtitle="Resolved incidents" />
          <MetricCard label="Failed" value={metrics.failed} icon="✗" color="#ff0040" subtitle="Need attention" />
          <MetricCard label="Avg Time" value={`${metrics.avgTime}m`} icon="⏱" color="#ffc800" subtitle="Mean response" />
          <MetricCard label="Success Rate" value={`${metrics.successRate}%`} icon="📊" color="#00ff88" />
          <MetricCard label="Playbooks" value={`${metrics.activePlaybooks}/${playbooks.length}`} icon="📋" color="#ff6b00" subtitle="Active" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
          {/* Incidents Table */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#ff6b00',
                fontFamily: '"Rajdhani", sans-serif',
              }}>
                ACTIVE RESPONSES
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['all', 'running', 'completed', 'failed', 'paused'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      background: filter === f ? (statusColors[f]?.bg || '#00d4ff') + '20' : 'transparent',
                      border: `1px solid ${filter === f ? (statusColors[f]?.bg || '#00d4ff') : 'rgba(148, 163, 184, 0.2)'}`,
                      color: filter === f ? (statusColors[f]?.bg || '#00d4ff') : '#64748b',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontFamily: '"IBM Plex Mono", monospace',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Column Headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '110px 90px 1fr 140px 100px 80px 100px',
              gap: '12px',
              padding: '12px 16px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              fontSize: '10px',
              fontFamily: '"IBM Plex Mono", monospace',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              <div>Incident</div>
              <div>Status</div>
              <div>Playbook</div>
              <div>Source IP</div>
              <div>Target</div>
              <div>Step</div>
              <div>Duration</div>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {filteredIncidents.map(incident => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  onClick={setSelectedIncident}
                />
              ))}
            </div>
          </div>

          {/* Playbooks Panel */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#00d4ff',
                fontFamily: '"Rajdhani", sans-serif',
              }}>
                PLAYBOOKS
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                fontFamily: '"IBM Plex Mono", monospace',
                marginTop: '4px',
              }}>
                {playbooks.filter(p => p.enabled).length} of {playbooks.length} active
              </div>
            </div>
            <div style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '560px',
              overflowY: 'auto',
            }}>
              {playbooks.map(playbook => (
                <PlaybookCard
                  key={playbook.id}
                  playbook={playbook}
                  onToggle={togglePlaybook}
                  onView={setSelectedPlaybook}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      <IncidentModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onAction={handleAction}
      />
      <PlaybookModal
        playbook={selectedPlaybook}
        onClose={() => setSelectedPlaybook(null)}
      />
    </div>
  );
}
