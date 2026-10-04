import type { ReactNode } from "react";

type CanvasHeaderTone = "default" | "blocked" | "canary";

function InformationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6M12 7.5h.01" />
    </svg>
  );
}

export function SimulationCanvasHeader({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = "default",
  titleAccessory,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: CanvasHeaderTone;
  titleAccessory?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="simulation-canvas-header" data-simulation-page-heading>
      <div className="simulation-canvas-header-copy">
        <p className="simulation-canvas-eyebrow">{eyebrow}</p>
        <div className="simulation-canvas-title-row">
          <h1>{title}</h1>
          {titleAccessory}
        </div>
        <p className="simulation-canvas-description">{description}</p>
      </div>
      <div className="simulation-canvas-header-aside">
        <span
          className={`simulation-canvas-status simulation-canvas-status-${statusTone}`}
          role="status"
        >
          <InformationIcon />
          <span>{statusLabel}</span>
        </span>
        {actions ? <div className="simulation-canvas-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
