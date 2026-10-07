export default function ViewSwitch({ view, onChange }) {
  const item = (id, label) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => onChange(id)}
      style={{
        background: view === id ? 'rgba(255, 107, 0, 0.16)' : 'rgba(0, 0, 0, 0.25)',
        border: `1px solid ${view === id ? '#ff6b00' : 'rgba(148, 163, 184, 0.35)'}`,
        color: view === id ? '#ffb067' : '#94a3b8',
        padding: '8px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
      }}
    >
      {label}
    </button>
  );

  return (
    <div role="tablist" aria-label="AutoSOC consoles" style={{ display: 'flex', gap: '6px' }}>
      {item('detection', 'Detection')}
      {item('response', 'Response')}
    </div>
  );
}
