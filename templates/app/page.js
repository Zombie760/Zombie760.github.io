export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
    }}>
      <pre style={{
        color: '#00e5ff',
        fontSize: 'clamp(0.45rem, 1.5vw, 0.85rem)',
        lineHeight: 1.3,
        textAlign: 'left',
        marginBottom: '2rem',
      }}>{` _____ _          ____                  ____        _
|_   _| |__   ___|  _ \\ ___  _ __   ___| __ )  ___ | |_
  | | | '_ \\ / _ \\ |_) / _ \\| '_ \\ / _ \\  _ \\ / _ \\| __|
  | | | | | |  __/  __/ (_) | |_) |  __/ |_) | (_) | |_
  |_| |_| |_|\\___|_|   \\___/| .__/ \\___|____/ \\___/ \\__|
                            |_|`}</pre>
      <p style={{ color: '#888', fontSize: '1rem' }}>
        Your AI agent is running.
      </p>
    </main>
  );
}
