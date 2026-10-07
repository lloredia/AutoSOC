import { useEffect, useMemo, useState } from 'react';
import ViewSwitch from '../components/ViewSwitch.jsx';

// ============================================================================
// AUTOSOC - INCIDENT RESPONSE ORCHESTRATOR
// SecOps Command Center Component 4
// ============================================================================

// Playbooks are served by the orchestrator API.

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
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      background:
        'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
      zIndex: 9999,
      opacity: 0.2,
    }}
  />
);

const MetricCard = ({ label, value, icon, color = '#00d4ff', subtitle }) => (
  <div
    style={{
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '8px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '4px',
        height: '100%',
        background: color,
        boxShadow: `0 0 20px ${color}`,
      }}
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div
          style={{
            fontSize: '11px',
            color: 'rgba(148, 163, 184, 0.8)',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            marginBottom: '8px',
            fontFamily: '"IBM Plex Mono", monospace',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '32px',
            fontWeight: '700',
            color,
            fontFamily: '"Rajdhani", sans-serif',
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(148, 163, 184, 0.6)',
              marginTop: '6px',
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ fontSize: '28px', opacity: 0.4 }}>{icon}</div>
    </div>
  </div>
);

const PlaybookCard = ({ playbook, onToggle, onView }) => (
  <div
    style={{
      background: playbook.enabled
        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)'
        : 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
      border: `1px solid ${playbook.enabled ? 'rgba(0, 212, 255, 0.3)' : 'rgba(148, 163, 184, 0.1)'}`,
      borderRadius: '8px',
      padding: '16px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    onClick={() => onView(playbook)}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          fontSize: '14px',
          fontWeight: '600',
          color: playbook.enabled ? '#00d4ff' : '#94a3b8',
          fontFamily: '"Rajdhani", sans-serif',
        }}
      >
        {playbook.name}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(playbook.id);
        }}
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
    <div
      style={{
        fontSize: '11px',
        color: 'rgba(148, 163, 184, 0.7)',
        marginBottom: '12px',
        lineHeight: '1.4',
        fontFamily: '"IBM Plex Mono", monospace',
      }}
    >
      {playbook.description}
    </div>
    <div
      style={{
        display: 'flex',
        gap: '16px',
        fontSize: '10px',
        fontFamily: '"IBM Plex Mono", monospace',
      }}
    >
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
    <div
      style={{
        marginTop: '12px',
        display: 'flex',
        gap: '6px',
      }}
    >
      {playbook.severity.map((s) => (
        <span
          key={s}
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '9px',
            background: `${severityColors[s]}20`,
            color: severityColors[s],
            textTransform: 'uppercase',
            fontFamily: '"IBM Plex Mono", monospace',
          }}
        >
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
        background:
          incident.status === 'running'
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
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background =
          incident.status === 'running'
            ? 'rgba(0, 212, 255, 0.05)'
            : incident.status === 'failed'
              ? 'rgba(255, 0, 64, 0.05)'
              : 'transparent')
      }
    >
      <div style={{ color: '#94a3b8' }}>{incident.id}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: colors.bg,
            boxShadow: `0 0 8px ${colors.glow}`,
            animation: incident.status === 'running' ? 'pulse 1.5s infinite' : 'none',
          }}
        />
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
          <div
            style={{
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
            }}
          >
            {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: compact ? '11px' : '13px',
                color: step.status === 'pending' ? '#64748b' : '#e2e8f0',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {step.name}
            </div>
            {!compact && (
              <div
                style={{
                  fontSize: '10px',
                  color: '#64748b',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {step.action} • timeout: {step.timeout}s
              </div>
            )}
          </div>
          {step.status === 'running' && (
            <div
              style={{
                fontSize: '10px',
                color: '#00d4ff',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
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
    <div
      style={{
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
      }}
      onClick={onClose}
    >
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
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontFamily: '"IBM Plex Mono", monospace',
                marginBottom: '4px',
              }}
            >
              {incident.id}
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#e2e8f0',
                fontFamily: '"Rajdhani", sans-serif',
              }}
            >
              {incident.playbook}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
              }}
            >
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: `${colors.bg}20`,
                  color: colors.bg,
                  textTransform: 'uppercase',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {incident.status}
              </span>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: `${severityColors[incident.severity]}20`,
                  color: severityColors[incident.severity],
                  textTransform: 'uppercase',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {incident.severity}
              </span>
              {incident.escalated && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: 'rgba(255, 107, 0, 0.15)',
                    color: '#ff6b00',
                    textTransform: 'uppercase',
                    fontFamily: '"IBM Plex Mono", monospace',
                  }}
                >
                  Escalated
                </span>
              )}
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {[
            { label: 'Detection', value: incident.eventId || '—', color: '#00d4ff' },
            { label: 'Source', value: incident.source },
            { label: 'Source IP', value: incident.sourceIp, color: '#ff6b00' },
            { label: 'Target', value: incident.targetAsset },
            {
              label: 'Duration',
              value: `${Math.floor(incident.duration / 60)}m ${incident.duration % 60}s`,
            },
            {
              label: 'Progress',
              value: `${incident.currentStep}/${incident.totalSteps} steps`,
              color: '#00d4ff',
            },
            {
              label: 'Analyst',
              value: incident.analyst || 'Unassigned',
              color: incident.analyst ? '#00ff88' : '#64748b',
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '12px',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '4px',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: color || '#e2e8f0',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Playbook Steps */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '16px',
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
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
                background:
                  'linear-gradient(135deg, rgba(255, 200, 0, 0.2) 0%, rgba(255, 200, 0, 0.1) 100%)',
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
                background:
                  'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%)',
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
                background:
                  'linear-gradient(135deg, rgba(255, 0, 64, 0.2) 0%, rgba(255, 0, 64, 0.1) 100%)',
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
                background:
                  'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 255, 136, 0.1) 100%)',
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
              background:
                'linear-gradient(135deg, rgba(255, 107, 0, 0.2) 0%, rgba(255, 107, 0, 0.1) 100%)',
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
    <div
      style={{
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
      }}
      onClick={onClose}
    >
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
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontFamily: '"IBM Plex Mono", monospace',
                marginBottom: '4px',
              }}
            >
              {playbook.id}
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#00d4ff',
                fontFamily: '"Rajdhani", sans-serif',
              }}
            >
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

        <div
          style={{
            fontSize: '13px',
            color: '#94a3b8',
            marginBottom: '20px',
            lineHeight: '1.5',
            fontFamily: '"IBM Plex Mono", monospace',
          }}
        >
          {playbook.description}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
            <div
              style={{
                fontSize: '10px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              TRIGGER
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#00d4ff',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {playbook.trigger}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
            <div
              style={{
                fontSize: '10px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              EXECUTIONS
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#ffc800',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {playbook.executions}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
            <div
              style={{
                fontSize: '10px',
                color: '#64748b',
                marginBottom: '4px',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              SUCCESS RATE
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#00ff88',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {playbook.successRate}%
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: '20px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '16px',
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
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

export default function AutoSOC({
  incidents = [],
  playbooks = [],
  metrics,
  live,
  onToggleLive,
  onIncidentAction,
  onTogglePlaybook,
  onReset,
  onNavigate,
  view,
  selectedIncidentId,
  onSelectIncident,
  error,
}) {
  const [selectedPlaybook, setSelectedPlaybook] = useState(null);
  const [filter, setFilter] = useState('all');
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) || null;
  const board = metrics || {
    running: 0,
    completed: 0,
    failed: 0,
    avgTime: 0,
    successRate: 0,
    activePlaybooks: 0,
    totalPlaybooks: playbooks.length,
  };

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onSelectIncident?.(null);
        setSelectedPlaybook(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSelectIncident]);

  const filteredIncidents = useMemo(() => {
    if (filter === 'all') return incidents;
    return incidents.filter((incident) => incident.status === filter);
  }, [incidents, filter]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1a 0%, #111827 50%, #0a0f1a 100%)',
        color: '#e2e8f0',
        fontFamily: '"Inter", -apple-system, sans-serif',
      }}
    >
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
      <header
        style={{
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '1800px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ff6b00 0%, #ff0040 100%)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(255, 107, 0, 0.4)',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: '700',
                  fontFamily: '"Rajdhani", sans-serif',
                  background: 'linear-gradient(90deg, #ff6b00 0%, #ff0040 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                AUTOSOC
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(148, 163, 184, 0.7)',
                  letterSpacing: '2px',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                RESPONSE • FED BY NEXUSWATCH
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <ViewSwitch view={view} onChange={onNavigate} />
            <button
              type="button"
              onClick={() => onReset?.()}
              style={{
                background: 'transparent',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                color: '#94a3b8',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              RESET DEMO
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: live ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 200, 0, 0.1)',
                border: `1px solid ${live ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 200, 0, 0.3)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => onToggleLive?.()}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: live ? '#00ff88' : '#ffc800',
                  boxShadow: `0 0 8px ${live ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 200, 0, 0.5)'}`,
                  animation: live ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: '"IBM Plex Mono", monospace',
                  color: live ? '#00ff88' : '#ffc800',
                }}
              >
                {live ? 'LIVE' : 'PAUSED'}
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(148, 163, 184, 0.6)',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1800px', margin: '0 auto', padding: '24px' }}>
        {/* Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <MetricCard
            label="Running"
            value={board.running}
            icon="▶"
            color="#00d4ff"
            subtitle="Active responses"
          />
          <MetricCard
            label="Completed"
            value={board.completed}
            icon="✓"
            color="#00ff88"
            subtitle="Resolved incidents"
          />
          <MetricCard
            label="Failed"
            value={board.failed}
            icon="✗"
            color="#ff0040"
            subtitle="Need attention"
          />
          <MetricCard
            label="Avg Time"
            value={`${board.avgTime}m`}
            icon="⏱"
            color="#ffc800"
            subtitle="Mean response"
          />
          <MetricCard
            label="Success Rate"
            value={`${board.successRate}%`}
            icon="📊"
            color="#00ff88"
          />
          <MetricCard
            label="Playbooks"
            value={`${board.activePlaybooks}/${board.totalPlaybooks ?? playbooks.length}`}
            icon="📋"
            color="#ff6b00"
            subtitle="Active"
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 12px',
              border: '1px solid rgba(255, 0, 64, 0.45)',
              color: '#ff8aa3',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}
        <div className="response-layout">
          {/* Incidents Table */}
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#ff6b00',
                  fontFamily: '"Rajdhani", sans-serif',
                }}
              >
                ACTIVE RESPONSES
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['all', 'running', 'completed', 'failed', 'paused'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      background:
                        filter === f ? (statusColors[f]?.bg || '#00d4ff') + '20' : 'transparent',
                      border: `1px solid ${filter === f ? statusColors[f]?.bg || '#00d4ff' : 'rgba(148, 163, 184, 0.2)'}`,
                      color: filter === f ? statusColors[f]?.bg || '#00d4ff' : '#64748b',
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
            <div
              style={{
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
              }}
            >
              <div>Incident</div>
              <div>Status</div>
              <div>Playbook</div>
              <div>Source IP</div>
              <div>Target</div>
              <div>Step</div>
              <div>Duration</div>
            </div>

            <div className="table-scroll" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {filteredIncidents.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  onClick={(incident) => onSelectIncident?.(incident.id)}
                />
              ))}
            </div>
          </div>

          {/* Playbooks Panel */}
          <div
            style={{
              background:
                'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#00d4ff',
                  fontFamily: '"Rajdhani", sans-serif',
                }}
              >
                PLAYBOOKS
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontFamily: '"IBM Plex Mono", monospace',
                  marginTop: '4px',
                }}
              >
                {playbooks.filter((p) => p.enabled).length} of {playbooks.length} active
              </div>
            </div>
            <div
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxHeight: '560px',
                overflowY: 'auto',
              }}
            >
              {playbooks.map((playbook) => (
                <PlaybookCard
                  key={playbook.id}
                  playbook={playbook}
                  onToggle={onTogglePlaybook}
                  onView={setSelectedPlaybook}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      <IncidentModal
        incident={selectedIncident}
        onClose={() => onSelectIncident?.(null)}
        onAction={onIncidentAction}
      />
      <PlaybookModal playbook={selectedPlaybook} onClose={() => setSelectedPlaybook(null)} />
    </div>
  );
}
