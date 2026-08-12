import type { ReactNode } from "react";

import styles from "./analytics.module.css";

export type DataStateVariant = "empty" | "stale" | "warning" | "unavailable" | "error";

const STATE_LABELS: Record<DataStateVariant, string> = {
  empty: "Sem dados",
  stale: "Fonte atrasada",
  warning: "Atenção",
  unavailable: "Indisponível",
  error: "Erro",
};

export function DataState({
  variant,
  title,
  description,
  action,
  compact = false,
  headingLevel = "h2",
}: {
  variant: DataStateVariant;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <div
      className={`${styles.state} ${compact ? styles.stateCompact : ""}`}
      data-variant={variant}
      role={
        variant === "error"
          ? "alert"
          : variant === "warning" || variant === "stale"
            ? "status"
            : undefined
      }
    >
      <p className={styles.stateLabel}>{STATE_LABELS[variant]}</p>
      <Heading className={styles.stateTitle}>{title}</Heading>
      <p className={styles.stateDescription}>{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function UnavailableValue({ reason }: { reason?: string }) {
  return (
    <span
      className={styles.unavailableValue}
      title={reason}
      aria-label={reason ? `Indisponível: ${reason}` : undefined}
    >
      Indisponível
    </span>
  );
}

export function AnalyticsSkeleton({ label = "Carregando indicadores" }: { label?: string }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label={label}>
      <span className={styles.skeletonLine} aria-hidden="true" />
      <span className={styles.skeletonValue} aria-hidden="true" />
      <span className={styles.skeletonChart} aria-hidden="true" />
    </div>
  );
}
