import { Activity, CalendarClock, CircleGauge, SlidersHorizontal } from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import { loadPointSettingsDraft } from "@/lib/crm/commercial-engine/draft-data";
import { pointDraftValues } from "@/lib/crm/commercial-engine/drafts";
import { POINT_METRICS } from "@/lib/crm/points/catalog";
import { loadPointSettings } from "@/lib/crm/points/data";

import { ConfigurationDraftForm } from "../../_components/ConfigurationDraftForm";
import styles from "../../../ConfigurationCanvas.module.css";
import { preparePointSettingsDraftAction } from "../actions";

export async function PointSettingsPage({
  canManageDraft,
  notification,
}: {
  canManageDraft: boolean;
  notification?: "saved" | "validation" | "save";
}) {
  const [result, draft] = await Promise.all([
    loadPointSettings(),
    canManageDraft ? loadPointSettingsDraft() : Promise.resolve(null),
  ]);
  const draftValues = draft ? pointDraftValues(draft.payload) : null;
  const weights = draftValues?.weights ?? (result.status === "ready" ? result.weights : null);
  const targets = draftValues?.targets ?? (result.status === "ready" ? result.targets : null);
  const sourceUpdatedAt = draft?.updatedAt ?? (result.status === "ready" ? result.updatedAt : null);
  const updatedAt = sourceUpdatedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(sourceUpdatedAt))
    : null;

  const sourceState = draft
    ? "Rascunho editável"
    : result.status === "ready"
      ? "Base legada disponível"
      : "Sem base legada";
  const accessState = canManageDraft
    ? "Base legada: somente leitura · Rascunho atual: editável"
    : "Base legada: somente leitura · Rascunho atual: indisponível";

  return (
    <ManagementPage className={styles.canvas ?? ""}>
      <ManagementPageHeader
        eyebrow="Regras do ranking"
        title="Metas de pontos"
        description={
          canManageDraft
            ? "Prepare pesos e objetivos como rascunho inativo, sem alterar o ranking."
            : "Consulte a base legada. O rascunho permanece indisponível para este perfil."
        }
        status={
          <ManagementStatusBadge
            tone={draft ? "positive" : result.status === "ready" ? "info" : "warning"}
          >
            {sourceState}
          </ManagementStatusBadge>
        }
      />

      <section
        aria-label={`Resumo da configuração. ${accessState}`}
        className={`${styles.pointSummary} ${managementStyles.summaryGrid}`}
      >
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <Activity />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Atividades configuráveis</span>
            <strong className={managementStyles.summaryValue}>{POINT_METRICS.length}</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <SlidersHorizontal />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Campos por atividade</span>
            <strong className={managementStyles.summaryValue}>Peso + objetivo</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <CircleGauge />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Estado da configuração</span>
            <strong className={managementStyles.summaryValue}>{sourceState}</strong>
          </div>
        </article>
        <article className={managementStyles.summaryCard}>
          <span className={managementStyles.iconFrame} aria-hidden="true">
            <CalendarClock />
          </span>
          <div>
            <span className={managementStyles.summaryLabel}>Última atualização</span>
            <strong className={managementStyles.summaryValue}>{updatedAt ?? "—"}</strong>
          </div>
        </article>
      </section>

      {notification ? (
        <div
          role={notification === "saved" ? "status" : "alert"}
          className={`${managementStyles.panel} ${managementStyles.panelPadded} text-sm ${
            notification === "saved"
              ? "text-[var(--analytics-positive-ink)]"
              : "text-[var(--analytics-danger-ink)]"
          }`}
        >
          {notification === "saved"
            ? "Rascunho salvo e registrado na auditoria; nenhuma ativação foi realizada."
            : notification === "validation"
              ? "Revise os valores: use somente inteiros entre 0 e 100.000."
              : "Não foi possível salvar a configuração. Tente novamente."}
        </div>
      ) : null}

      {result.status === "empty" ? (
        <div
          role="status"
          className={`${managementStyles.panel} ${managementStyles.panelPadded} text-sm leading-6 text-[var(--analytics-muted)]`}
        >
          <strong className="block text-[var(--analytics-ink)]">Base legada ausente</strong>
          Ainda não existe base legada. Os campos permanecem vazios para evitar sugerir uma regra
          comercial. Salvar cria apenas um rascunho inativo.
        </div>
      ) : null}

      <ConfigurationDraftForm
        action={preparePointSettingsDraftAction}
        enabled={canManageDraft}
        saveLabel="Salvar rascunho de pontuação"
      >
        <input type="hidden" name="draftRevision" value={draft?.revision ?? 0} />
        <section className={`${styles.pointMatrix} ${managementStyles.panel} overflow-hidden`}>
          <div className={`${managementStyles.panelPadded} ${managementStyles.sectionHeader}`}>
            <div>
              <p className={managementStyles.sectionKicker}>Matriz de pontuação</p>
              <h2 id="point-activity-heading" className={managementStyles.sectionTitle}>
                Pontos por atividade
              </h2>
              <p className={managementStyles.sectionDescription}>
                Ajuste o valor de cada atividade e o objetivo usado como referência comercial.
              </p>
            </div>
            <span className={managementStyles.statusPill}>{POINT_METRICS.length} atividades</span>
          </div>

          <div className={managementStyles.tableRegion}>
            <table className={managementStyles.table} aria-labelledby="point-activity-heading">
              <caption className="sr-only">
                Configuração de peso e objetivo por atividade comercial
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Atividade</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {POINT_METRICS.map((metric, index) => (
                  <tr key={metric.key}>
                    <td className="w-14 font-semibold text-[var(--analytics-muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <th scope="row" className="text-left font-semibold">
                      {metric.label}
                    </th>
                    <td className="w-44">
                      <input
                        required
                        id={`weight-${metric.formKey}`}
                        aria-label={`Peso de ${metric.label}`}
                        name={`weight.${metric.formKey}`}
                        type="number"
                        min="0"
                        max="100000"
                        step="1"
                        placeholder="—"
                        defaultValue={weights?.[metric.key]}
                        className="min-h-11 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-right text-base font-semibold text-[var(--analytics-ink)] outline-none focus:border-[var(--analytics-cyan-strong)] focus:ring-2 focus:ring-cyan-200"
                      />
                    </td>
                    <td className="w-44">
                      <input
                        required
                        id={`target-${metric.formKey}`}
                        aria-label={`Objetivo de ${metric.label}`}
                        name={`target.${metric.formKey}`}
                        type="number"
                        min="0"
                        max="100000"
                        step="1"
                        placeholder="—"
                        defaultValue={targets?.[metric.key]}
                        className="min-h-11 w-full rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-right text-base font-semibold text-[var(--analytics-ink)] outline-none focus:border-[var(--analytics-cyan-strong)] focus:ring-2 focus:ring-cyan-200"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </ConfigurationDraftForm>
    </ManagementPage>
  );
}
