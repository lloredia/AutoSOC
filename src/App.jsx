import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import NexusWatch from './detection/NexusWatch.jsx';
import AutoSOC from './response/AutoSOC.jsx';

export default function App() {
  const [view, setView] = useState('response');
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const inflight = useRef(0);
  const epoch = useRef(0);

  const refresh = useCallback(async () => {
    if (inflight.current > 0) return;
    const token = epoch.current;
    try {
      const data = await api('/api/snapshot');
      if (inflight.current === 0 && token === epoch.current) {
        setSnapshot(data);
        setError('');
      }
    } catch (err) {
      if (inflight.current === 0 && token === epoch.current) {
        setError(err.message || 'Cannot reach the AutoSOC API');
      }
    }
  }, []);

  const mutate = useCallback(async (path, body) => {
    inflight.current += 1;
    epoch.current += 1;
    try {
      const data = await api(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
      setSnapshot(data.snapshot);
      setError('');
      return data;
    } catch (err) {
      setError(err.message || 'Request failed');
      return null;
    } finally {
      inflight.current -= 1;
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(() => {
      refresh();
    }, 0);
    const timer = setInterval(() => {
      refresh();
    }, 2000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (event.key === 'l' && event.ctrlKey) {
        event.preventDefault();
        if (snapshot) mutate('/api/live', { enabled: !snapshot.live });
      }
      if (!typing && event.key === '1') setView('detection');
      if (!typing && event.key === '2') setView('response');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mutate, snapshot]);

  const onEventAction = useCallback(
    async (action, event) => {
      const result = await mutate(`/api/events/${encodeURIComponent(event.id)}/actions`, {
        action,
      });
      if (action === 'investigate' && result?.incident) {
        setSelectedIncidentId(result.incident.id);
        setView('response');
      }
      return result;
    },
    [mutate],
  );

  if (!snapshot) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0a0f1a',
          color: '#e2e8f0',
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '20px', marginBottom: '8px' }}>AutoSOC</div>
          <div style={{ color: error ? '#ff6b6b' : '#94a3b8' }}>
            {error || 'Loading the detection and response consoles…'}
          </div>
        </div>
      </main>
    );
  }

  const shared = {
    view,
    onNavigate: setView,
    live: snapshot.live,
    onToggleLive: () => mutate('/api/live', { enabled: !snapshot.live }),
    error,
  };

  return view === 'detection' ? (
    <NexusWatch
      {...shared}
      events={snapshot.events}
      metrics={snapshot.detection}
      sources={snapshot.sources}
      onEventAction={onEventAction}
    />
  ) : (
    <AutoSOC
      {...shared}
      incidents={snapshot.incidents}
      playbooks={snapshot.playbooks}
      metrics={snapshot.response}
      selectedIncidentId={selectedIncidentId}
      onSelectIncident={setSelectedIncidentId}
      onIncidentAction={(action, incident) =>
        mutate(`/api/incidents/${encodeURIComponent(incident.id)}/actions`, { action })
      }
      onTogglePlaybook={(id) => mutate(`/api/playbooks/${encodeURIComponent(id)}/toggle`)}
      onReset={() => mutate('/api/demo/reset')}
    />
  );
}
