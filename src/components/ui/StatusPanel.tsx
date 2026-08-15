interface StatusPanelProps {
  kind: "loading" | "error";
  label: string;
  message?: string;
  onRetry?: () => void;
}

/** Loading / error placeholder that never lets a null response crash a section. */
export function StatusPanel({ kind, label, message, onRetry }: StatusPanelProps) {
  if (kind === "loading") {
    return (
      <div className="status-panel status-panel--loading" role="status" aria-live="polite">
        <span className="status-panel__pulse" aria-hidden="true" />
        <p>Computing {label}…</p>
      </div>
    );
  }

  return (
    <div className="status-panel status-panel--error" role="alert">
      <p className="status-panel__title">Could not load {label}.</p>
      {message ? <p className="status-panel__detail">{message}</p> : null}
      {onRetry ? (
        <button type="button" className="status-panel__retry" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
