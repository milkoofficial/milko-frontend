/**
 * Root loading UI – shown during navigation while route segments load.
 * Helps avoid "missing required error components, refreshing" during transitions.
 */
export default function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        fontFamily: 'system-ui, sans-serif',
        color: '#666',
      }}
    >
      Loading…
    </div>
  );
}
