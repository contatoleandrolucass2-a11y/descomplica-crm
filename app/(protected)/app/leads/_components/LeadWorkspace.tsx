import { AlertTriangle, DatabaseZap, Inbox, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";

import styles from "./LeadOperations.module.css";

export type LeadSourceState = "ready" | "empty" | "error" | "not_configured" | "scope_required";

const SOURCE_LABEL: Record<LeadSourceState, string> = {
  ready: "Dados atualizados",
  empty: "Sem registros",
  error: "Consulta indisponível",
  not_configured: "Fonte não configurada",
  scope_required: "Selecione um escopo",
};

export function LeadPageShell({
  eyebrow,
  title,
  description,
  sourceState = "not_configured",
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  sourceState?: LeadSourceState;
  children: ReactNode;
}) {
  return (
    <ManagementPage>
      <ManagementPageHeader
        {...(eyebrow ? { eyebrow } : {})}
        title={title}
        description={description}
        status={
          <ManagementStatusBadge
            tone={
              sourceState === "ready" ? "positive" : sourceState === "error" ? "warning" : "info"
            }
          >
            {SOURCE_LABEL[sourceState]}
          </ManagementStatusBadge>
        }
      />
      {children}
    </ManagementPage>
  );
}

export function LeadSourceNotice({ state = "not_configured" }: { state?: LeadSourceState }) {
  if (state === "ready") return null;

  const content =
    state === "error"
      ? {
          title: "Não foi possível consultar a operação",
          description:
            "A página continua disponível, mas os dados podem estar desatualizados. Tente novamente antes de tomar uma decisão comercial.",
          icon: AlertTriangle,
        }
      : state === "empty"
        ? {
            title: "A fonte está pronta e ainda não possui registros",
            description:
              "Cadastre o primeiro lead quando seu perfil tiver permissão de escrita. Nenhum total foi inferido.",
            icon: Inbox,
          }
        : state === "scope_required"
          ? {
              title: "Selecione a operação que deseja consultar",
              description:
                "Seu perfil possui mais de um escopo autorizado. A seleção não amplia acesso e será validada novamente no servidor.",
              icon: DatabaseZap,
            }
          : {
              title: "Dados operacionais ainda não conectados",
              description:
                "A estrutura está pronta, porém contatos, atividades e indicadores só serão exibidos quando a fonte oficial e as ações autorizadas forem vinculadas.",
              icon: DatabaseZap,
            };
  const Icon = content.icon;

  return (
    <section
      className={`${managementStyles.panel} ${managementStyles.panelStrong} grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start`}
      aria-labelledby="lead-source-notice-title"
      role={state === "error" ? "alert" : "status"}
    >
      <span className={managementStyles.iconFrame} aria-hidden="true">
        <Icon />
      </span>
      <div>
        <h2
          id="lead-source-notice-title"
          className="text-sm font-semibold text-[var(--analytics-ink)]"
        >
          {content.title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--analytics-muted)]">
          {content.description}
        </p>
      </div>
    </section>
  );
}

export function LeadScopeSelector({
  scopes,
  selectedScopeId,
  invalid = false,
}: {
  scopes: ReadonlyArray<{ id: string; name: string }>;
  selectedScopeId?: string | undefined;
  invalid?: boolean;
}) {
  if (scopes.length < 2 && !invalid) return null;

  return (
    <form
      className={`${managementStyles.panel} ${managementStyles.panelPadded} grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end`}
      method="get"
    >
      <label className={styles.field}>
        Escopo da operação
        <select
          className={styles.select}
          name="scope"
          defaultValue={invalid ? "" : (selectedScopeId ?? "")}
          required
          aria-describedby={invalid ? "lead-scope-error" : undefined}
        >
          <option value="" disabled>
            Selecione
          </option>
          {scopes.map((scope) => (
            <option key={scope.id} value={scope.id}>
              {scope.name}
            </option>
          ))}
        </select>
      </label>
      <button className={managementStyles.buttonPrimary} type="submit">
        Consultar escopo
      </button>
      {invalid ? (
        <p
          id="lead-scope-error"
          className="text-sm text-[var(--analytics-danger-ink)] sm:col-span-2"
          role="alert"
        >
          O escopo informado não pertence aos seus acessos atuais.
        </p>
      ) : null}
    </form>
  );
}

export function LeadStatePanel({
  state,
  title,
  description,
  action,
  icon: Icon,
}: {
  state: "empty" | "error" | "not_configured";
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  const StateIcon =
    Icon ?? (state === "error" ? AlertTriangle : state === "empty" ? Inbox : DatabaseZap);

  return (
    <div
      className={`${styles.statePanel} ${state === "error" ? styles.errorPanel : ""}`}
      role={state === "error" ? "alert" : "status"}
    >
      <div className={styles.stateCopy}>
        <span className={managementStyles.iconFrame} aria-hidden="true">
          <StateIcon />
        </span>
        <strong>{title}</strong>
        <span className={styles.helper}>{description}</span>
        {action}
      </div>
    </div>
  );
}

export function LeadLoadingState({ label = "Carregando dados de leads" }: { label?: string }) {
  return (
    <div className={styles.workspace} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
      <LoaderCircle className="sr-only" aria-hidden="true" />
    </div>
  );
}

export function LeadUnavailableMetric({ label }: { label: string }) {
  return <LeadSummaryMetric label={label} value={null} />;
}

export function LeadSummaryMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number | null;
  helper?: string | undefined;
}) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value ?? "Indisponível"}</strong>
      {helper ? <span className={styles.helper}>{helper}</span> : null}
    </div>
  );
}

export { styles as leadStyles };
