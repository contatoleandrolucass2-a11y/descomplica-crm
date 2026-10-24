import { DatabaseZap, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";

export function LeadPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <ManagementPage>
      <ManagementPageHeader
        {...(eyebrow ? { eyebrow } : {})}
        title={title}
        description={description}
        status={<ManagementStatusBadge tone="warning">Fonte não configurada</ManagementStatusBadge>}
      />
      {children}
    </ManagementPage>
  );
}

export function LeadSourceNotice() {
  return (
    <section
      className={`${managementStyles.panel} ${managementStyles.panelStrong} grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start`}
      aria-labelledby="lead-source-notice-title"
      role="status"
    >
      <span className={managementStyles.iconFrame} aria-hidden="true">
        <DatabaseZap />
      </span>
      <div>
        <h2
          id="lead-source-notice-title"
          className="text-sm font-semibold text-[var(--analytics-ink)]"
        >
          Dados operacionais ainda não conectados
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--analytics-muted)]">
          Este primeiro incremento prepara a navegação e os estados seguros do módulo. Nenhum
          contato, atividade ou indicador demonstrativo é exibido enquanto a fonte oficial não for
          definida.
        </p>
      </div>
    </section>
  );
}

export function LeadEmptyState({
  icon: Icon = Info,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className={`${managementStyles.panel} grid min-h-56 place-items-center p-6 text-center`}>
      <div className="grid max-w-xl justify-items-center gap-3">
        <span className={managementStyles.iconFrame} aria-hidden="true">
          <Icon />
        </span>
        <div>
          <strong className="block text-base text-[var(--analytics-ink)]">{title}</strong>
          <p className="mt-1 text-sm leading-6 text-[var(--analytics-muted)]">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function LeadUnavailableMetric({ label }: { label: string }) {
  return (
    <div className={managementStyles.summaryCard}>
      <span
        className="grid size-9 place-items-center rounded-md border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] text-[var(--analytics-muted)]"
        aria-hidden="true"
      >
        —
      </span>
      <span>
        <span className={managementStyles.summaryLabel}>{label}</span>
        <strong className={managementStyles.summaryValue}>Indisponível</strong>
      </span>
    </div>
  );
}
