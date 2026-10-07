import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// NEXUSWATCH - SIEM DASHBOARD
// SecOps Command Center Component 3
// ============================================================================

// Simulated data generators for demo purposes
const generateSecurityEvent = (id) => {
  const eventTypes = [
    { type: 'INTRUSION_ATTEMPT', severity: 'critical', icon: '⚠' },
    { type: 'BRUTE_FORCE', severity: 'high', icon: '🔐' },
    { type: 'MALWARE_DETECTED', severity: 'critical', icon: '☣' },
    { type: 'SUSPICIOUS_LOGIN', severity: 'medium', icon: '👤' },
    { type: 'DATA_EXFILTRATION', severity: 'critical', icon: '📤' },
    { type: 'PORT_SCAN', severity: 'low', icon: '🔍' },
    { type: 'PRIVILEGE_ESCALATION', severity: 'high', icon: '⬆' },
    { type: 'C2_COMMUNICATION', severity: 'critical', icon: '📡' },
    { type: 'POLICY_VIOLATION', severity: 'medium', icon: '📋' },
    { type: 'ANOMALOUS_TRAFFIC', severity: 'medium', icon: '📊' },
  ];
  
  const sources = ['HoneyTrap-SSH', 'HoneyTrap-HTTP', 'SentinelForge', 'Firewall', 'IDS/IPS', 'EDR', 'WAF', 'DNS-Monitor'];
  const ips = ['185.220.101.', '45.155.205.', '91.240.118.', '194.26.29.', '162.247.74.', '103.251.167.'];
  
  const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const sourceIp = ips[Math.floor(Math.random() * ips.length)] + Math.floor(Math.random() * 255);
  
  return {
    id: `EVT-${id.toString().padStart(6, '0')}`,
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    ...event,
    source: sources[Math.floor(Math.random() * sources.length)],
    sourceIp,
    destIp: `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    destPort: [22, 80, 443, 3389, 445, 3306, 5432, 8080][Math.floor(Math.random() * 8)],
    status: Math.random() > 0.3 ? 'active' : 'resolved',
    details: `Detected ${event.type.toLowerCase().replace(/_/g, ' ')} from ${sourceIp}`,
    iocMatch: Math.random() > 0.5,
    threatScore: Math.floor(Math.random() * 40) + 60,
  };
};

const generateMetrics = () => ({
  totalEvents: Math.floor(Math.random() * 5000) + 15000,
  criticalAlerts: Math.floor(Math.random() * 50) + 20,
  activeThreats: Math.floor(Math.random() * 30) + 10,
  blockedIps: Math.floor(Math.random() * 500) + 1000,
  avgResponseTime: (Math.random() * 2 + 0.5).toFixed(2),
  eventsPerSecond: Math.floor(Math.random() * 100) + 50,
  iocMatches: Math.floor(Math.random() * 200) + 100,
  dataSources: 8,
});

// Severity color mapping
const severityColors = {
  critical: { bg: '#ff0040', text: '#ffffff', glow: 'rgba(255, 0, 64, 0.5)' },
  high: { bg: '#ff6b00', text: '#ffffff', glow: 'rgba(255, 107, 0, 0.5)' },
  medium: { bg: '#ffc800', text: '#000000', glow: 'rgba(255, 200, 0, 0.5)' },
  low: { bg: '#00d4ff', text: '#000000', glow: 'rgba(0, 212, 255, 0.5)' },
};

// ============================================================================
// COMPONENTS
// ============================================================================

const GlitchText = ({ children, className = '' }) => {
  const [glitch, setGlitch] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 100);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <span className={className} style={{
      position: 'relative',
      display: 'inline-block',
      textShadow: glitch ? '2px 0 #ff0040, -2px 0 #00d4ff' : 'none',
      transform: glitch ? `translate(${Math.random() * 2 - 1}px, 0)` : 'none',
    }}>
      {children}
    </span>
  );
};

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
    opacity: 0.3,
  }} />
);

const MetricCard = ({ label, value, icon, trend, critical = false }) => (
  <div style={{
    background: critical 
      ? 'linear-gradient(135deg, rgba(255, 0, 64, 0.15) 0%, rgba(10, 14, 20, 0.95) 100%)'
      : 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(10, 14, 20, 0.95) 100%)',
    border: `1px solid ${critical ? 'rgba(255, 0, 64, 0.4)' : 'rgba(0, 212, 255, 0.2)'}`,
    borderRadius: '4px',
    padding: '16px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '2px',
      background: critical 
        ? 'linear-gradient(90deg, transparent, #ff0040, transparent)'
        : 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
    }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(0, 212, 255, 0.6)', 
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          {label}
        </div>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: '700',
          color: critical ? '#ff0040' : '#00d4ff',
          fontFamily: '"Orbitron", sans-serif',
          textShadow: critical ? '0 0 20px rgba(255, 0, 64, 0.5)' : '0 0 20px rgba(0, 212, 255, 0.3)',
        }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {trend && (
          <div style={{ 
            fontSize: '11px', 
            color: trend > 0 ? '#ff0040' : '#00ff88',
            marginTop: '4px',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% from last hour
          </div>
        )}
      </div>
      <div style={{ 
        fontSize: '24px',
        opacity: 0.5,
      }}>
        {icon}
      </div>
    </div>
  </div>
);

const EventRow = ({ event, onClick }) => {
  const colors = severityColors[event.severity];
  
  return (
    <div 
      onClick={() => onClick(event)}
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 100px 1fr 120px 80px 100px 60px',
        gap: '12px',
        padding: '12px 16px',
        background: event.status === 'active' 
          ? 'rgba(255, 0, 64, 0.05)' 
          : 'rgba(0, 0, 0, 0.2)',
        borderLeft: `3px solid ${colors.bg}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontSize: '12px',
        fontFamily: '"JetBrains Mono", monospace',
        borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = event.status === 'active' 
          ? 'rgba(255, 0, 64, 0.05)' 
          : 'rgba(0, 0, 0, 0.2)';
      }}
    >
      <div style={{ color: 'rgba(0, 212, 255, 0.6)' }}>
        {new Date(event.timestamp).toLocaleTimeString()}
      </div>
      <div style={{ 
        color: colors.bg,
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
          animation: event.severity === 'critical' ? 'pulse 1s infinite' : 'none',
        }} />
        {event.severity.toUpperCase()}
      </div>
      <div style={{ color: '#e0e0e0' }}>
        <span style={{ marginRight: '8px' }}>{event.icon}</span>
        {event.type.replace(/_/g, ' ')}
      </div>
      <div style={{ color: 'rgba(255, 107, 0, 0.9)' }}>{event.sourceIp}</div>
      <div style={{ color: 'rgba(0, 212, 255, 0.7)' }}>{event.source}</div>
      <div style={{ 
        color: event.iocMatch ? '#ff0040' : 'rgba(0, 212, 255, 0.5)',
        fontWeight: event.iocMatch ? '600' : '400',
      }}>
        {event.iocMatch ? '⚡ IOC MATCH' : '—'}
      </div>
      <div style={{ 
        color: event.threatScore > 80 ? '#ff0040' : event.threatScore > 60 ? '#ffc800' : '#00ff88',
      }}>
        {event.threatScore}%
      </div>
    </div>
  );
};

const ThreatMap = ({ events }) => {
  const regions = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const prefix = e.sourceIp.split('.').slice(0, 2).join('.');
      map[prefix] = (map[prefix] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [events]);
  
  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      borderRadius: '4px',
      padding: '16px',
      height: '100%',
    }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(0, 212, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '16px',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        Top Attack Origins
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {regions.map(([prefix, count], i) => (
          <div key={prefix} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '30px', 
              fontSize: '10px', 
              color: 'rgba(0, 212, 255, 0.5)',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              #{i + 1}
            </div>
            <div style={{ 
              flex: 1, 
              height: '20px', 
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${(count / regions[0][1]) * 100}%`,
                height: '100%',
                background: `linear-gradient(90deg, rgba(255, 0, 64, 0.8) 0%, rgba(255, 107, 0, 0.6) 100%)`,
                boxShadow: '0 0 10px rgba(255, 0, 64, 0.3)',
              }} />
            </div>
            <div style={{ 
              width: '80px',
              fontSize: '11px',
              color: '#e0e0e0',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {prefix}.*.*
            </div>
            <div style={{ 
              width: '40px',
              fontSize: '11px',
              color: '#ff6b00',
              fontFamily: '"JetBrains Mono", monospace',
              textAlign: 'right',
            }}>
              {count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TimelineChart = ({ events }) => {
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0).map((_, i) => ({
      hour: i,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }));
    
    events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hours[hour][e.severity]++;
    });
    
    return hours;
  }, [events]);
  
  const maxValue = Math.max(...hourlyData.map(h => h.critical + h.high + h.medium + h.low));
  
  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      borderRadius: '4px',
      padding: '16px',
      height: '100%',
    }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(0, 212, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '16px',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        Event Timeline (24h)
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        gap: '2px', 
        height: '120px',
        paddingTop: '20px',
      }}>
        {hourlyData.map((h, i) => {
          const total = h.critical + h.high + h.medium + h.low;
          const height = maxValue > 0 ? (total / maxValue) * 100 : 0;
          
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div style={{
                width: '100%',
                height: `${height}%`,
                minHeight: total > 0 ? '4px' : '0',
                background: h.critical > 0 
                  ? 'linear-gradient(180deg, #ff0040 0%, #ff6b00 100%)'
                  : 'linear-gradient(180deg, #00d4ff 0%, rgba(0, 212, 255, 0.3) 100%)',
                borderRadius: '2px 2px 0 0',
                boxShadow: h.critical > 0 ? '0 0 8px rgba(255, 0, 64, 0.5)' : 'none',
              }} />
              {i % 4 === 0 && (
                <div style={{
                  fontSize: '9px',
                  color: 'rgba(0, 212, 255, 0.4)',
                  marginTop: '4px',
                  fontFamily: '"JetBrains Mono", monospace',
                }}>
                  {i.toString().padStart(2, '0')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DataSourceStatus = () => {
  const sources = [
    { name: 'HoneyTrap-SSH', status: 'active', events: 2847, latency: '12ms' },
    { name: 'HoneyTrap-HTTP', status: 'active', events: 1523, latency: '8ms' },
    { name: 'SentinelForge', status: 'active', events: 5621, latency: '15ms' },
    { name: 'Firewall', status: 'active', events: 8934, latency: '5ms' },
    { name: 'IDS/IPS', status: 'active', events: 3241, latency: '22ms' },
    { name: 'EDR', status: 'degraded', events: 1876, latency: '145ms' },
    { name: 'WAF', status: 'active', events: 4521, latency: '18ms' },
    { name: 'DNS-Monitor', status: 'active', events: 6723, latency: '7ms' },
  ];
  
  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      borderRadius: '4px',
      padding: '16px',
    }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(0, 212, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '16px',
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        Data Sources
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {sources.map(s => (
          <div 
            key={s.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: s.status === 'active' ? '#00ff88' : '#ffc800',
              boxShadow: `0 0 8px ${s.status === 'active' ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 200, 0, 0.5)'}`,
            }} />
            <div style={{ flex: 1, color: '#e0e0e0' }}>{s.name}</div>
            <div style={{ color: 'rgba(0, 212, 255, 0.5)' }}>{s.latency}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EventDetailModal = ({ event, onClose }) => {
  if (!event) return null;
  
  const colors = severityColors[event.severity];
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(10, 14, 20, 0.98) 0%, rgba(20, 28, 40, 0.98) 100%)',
          border: `1px solid ${colors.bg}`,
          borderRadius: '8px',
          padding: '24px',
          width: '600px',
          maxWidth: '90vw',
          boxShadow: `0 0 40px ${colors.glow}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>{event.icon}</span>
            <div>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#e0e0e0',
                fontFamily: '"Orbitron", sans-serif',
              }}>
                {event.type.replace(/_/g, ' ')}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'rgba(0, 212, 255, 0.6)',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {event.id}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            CLOSE [ESC]
          </button>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '20px',
        }}>
          {[
            { label: 'Severity', value: event.severity.toUpperCase(), color: colors.bg },
            { label: 'Status', value: event.status.toUpperCase(), color: event.status === 'active' ? '#ff0040' : '#00ff88' },
            { label: 'Source IP', value: event.sourceIp, color: '#ff6b00' },
            { label: 'Dest IP', value: event.destIp, color: '#00d4ff' },
            { label: 'Dest Port', value: event.destPort, color: '#e0e0e0' },
            { label: 'Data Source', value: event.source, color: '#00d4ff' },
            { label: 'Threat Score', value: `${event.threatScore}%`, color: event.threatScore > 80 ? '#ff0040' : '#ffc800' },
            { label: 'IOC Match', value: event.iocMatch ? 'YES' : 'NO', color: event.iocMatch ? '#ff0040' : '#00ff88' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '12px',
              borderRadius: '4px',
            }}>
              <div style={{
                fontSize: '10px',
                color: 'rgba(0, 212, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '4px',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {label}
              </div>
              <div style={{
                fontSize: '14px',
                color,
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: '600',
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '16px',
          borderRadius: '4px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'rgba(0, 212, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            Event Details
          </div>
          <div style={{
            fontSize: '13px',
            color: '#e0e0e0',
            fontFamily: '"JetBrains Mono", monospace',
            lineHeight: '1.6',
          }}>
            {event.details}
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
        }}>
          <button style={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(255, 0, 64, 0.2) 0%, rgba(255, 0, 64, 0.1) 100%)',
            border: '1px solid rgba(255, 0, 64, 0.5)',
            color: '#ff0040',
            padding: '12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: '600',
          }}>
            🚫 BLOCK IP
          </button>
          <button style={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%)',
            border: '1px solid rgba(0, 212, 255, 0.5)',
            color: '#00d4ff',
            padding: '12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: '600',
          }}>
            🔍 INVESTIGATE
          </button>
          <button style={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 255, 136, 0.1) 100%)',
            border: '1px solid rgba(0, 255, 136, 0.5)',
            color: '#00ff88',
            padding: '12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: '600',
          }}>
            ✓ RESOLVE
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function NexusWatch() {
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState(generateMetrics());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  
  // Initialize events
  useEffect(() => {
    const initialEvents = Array(100).fill(null).map((_, i) => generateSecurityEvent(1000 + i));
    setEvents(initialEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
  }, []);
  
  // Simulate live event stream
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setEvents(prev => {
        const newEvent = generateSecurityEvent(Date.now());
        return [newEvent, ...prev].slice(0, 500);
      });
      setMetrics(generateMetrics());
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isLive]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedEvent(null);
      if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setIsLive(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filter !== 'all' && e.severity !== filter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          e.type.toLowerCase().includes(query) ||
          e.sourceIp.includes(query) ||
          e.source.toLowerCase().includes(query) ||
          e.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [events, filter, searchQuery]);
  
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e14 0%, #141c28 50%, #0a0e14 100%)',
      color: '#e0e0e0',
      fontFamily: '"Inter", -apple-system, sans-serif',
    }}>
      <ScanLine />
      
      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Orbitron:wght@500;700;900&display=swap');
        
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 255, 0.3);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 255, 0.5);
        }
      `}</style>
      
      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)',
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
              background: 'linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                fontFamily: '"Orbitron", sans-serif',
                background: 'linear-gradient(90deg, #00d4ff 0%, #00ff88 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                <GlitchText>NEXUSWATCH</GlitchText>
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(0, 212, 255, 0.6)',
                letterSpacing: '2px',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                SIEM DASHBOARD • SECOPS COMMAND CENTER
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: isLive ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 200, 0, 0.1)',
              border: `1px solid ${isLive ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 200, 0, 0.3)'}`,
              borderRadius: '4px',
              cursor: 'pointer',
            }} onClick={() => setIsLive(!isLive)}>
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
                fontFamily: '"JetBrains Mono", monospace',
                color: isLive ? '#00ff88' : '#ffc800',
              }}>
                {isLive ? 'LIVE' : 'PAUSED'}
              </span>
            </div>
            
            <div style={{
              fontSize: '12px',
              color: 'rgba(0, 212, 255, 0.6)',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main style={{
        maxWidth: '1800px',
        margin: '0 auto',
        padding: '24px',
      }}>
        {/* Metrics Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <MetricCard label="Total Events (24h)" value={metrics.totalEvents} icon="📊" trend={12} />
          <MetricCard label="Critical Alerts" value={metrics.criticalAlerts} icon="🚨" trend={-5} critical />
          <MetricCard label="Active Threats" value={metrics.activeThreats} icon="☠️" critical />
          <MetricCard label="Blocked IPs" value={metrics.blockedIps} icon="🛡️" trend={8} />
          <MetricCard label="IOC Matches" value={metrics.iocMatches} icon="⚡" />
          <MetricCard label="Events/sec" value={metrics.eventsPerSecond} icon="⚡" />
          <MetricCard label="Avg Response" value={`${metrics.avgResponseTime}s`} icon="⏱️" />
          <MetricCard label="Data Sources" value={metrics.dataSources} icon="🔌" />
        </div>
        
        {/* Charts Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <TimelineChart events={events} />
          <ThreatMap events={events} />
          <DataSourceStatus />
        </div>
        
        {/* Events Table */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#00d4ff',
              fontFamily: '"Orbitron", sans-serif',
            }}>
              SECURITY EVENTS
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Search */}
              <div style={{
                position: 'relative',
              }}>
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '4px',
                    padding: '8px 12px 8px 32px',
                    color: '#e0e0e0',
                    fontSize: '12px',
                    fontFamily: '"JetBrains Mono", monospace',
                    width: '200px',
                    outline: 'none',
                  }}
                />
                <span style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(0, 212, 255, 0.5)',
                }}>
                  🔍
                </span>
              </div>
              
              {/* Filters */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      background: filter === f 
                        ? (f === 'all' ? 'rgba(0, 212, 255, 0.2)' : severityColors[f]?.bg || 'rgba(0, 212, 255, 0.2)')
                        : 'transparent',
                      border: `1px solid ${f === 'all' ? 'rgba(0, 212, 255, 0.3)' : severityColors[f]?.bg || 'rgba(0, 212, 255, 0.3)'}`,
                      color: filter === f ? '#ffffff' : (f === 'all' ? '#00d4ff' : severityColors[f]?.bg || '#00d4ff'),
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontFamily: '"JetBrains Mono", monospace',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Column Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 100px 1fr 120px 80px 100px 60px',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(0, 212, 255, 0.05)',
            borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
            fontSize: '10px',
            fontFamily: '"JetBrains Mono", monospace',
            color: 'rgba(0, 212, 255, 0.6)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            <div>Time</div>
            <div>Severity</div>
            <div>Event Type</div>
            <div>Source IP</div>
            <div>Source</div>
            <div>IOC</div>
            <div>Score</div>
          </div>
          
          {/* Events List */}
          <div style={{
            maxHeight: '500px',
            overflowY: 'auto',
          }}>
            {filteredEvents.slice(0, 50).map(event => (
              <EventRow 
                key={event.id} 
                event={event} 
                onClick={setSelectedEvent}
              />
            ))}
          </div>
          
          {/* Footer */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(0, 212, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.2)',
            fontSize: '11px',
            fontFamily: '"JetBrains Mono", monospace',
            color: 'rgba(0, 212, 255, 0.5)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Showing {Math.min(50, filteredEvents.length)} of {filteredEvents.length} events</span>
            <span>Press Ctrl+L to toggle live mode</span>
          </div>
        </div>
      </main>
      
      {/* Event Detail Modal */}
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
