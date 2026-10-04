import { Building2, CalendarDays, CircleGauge, UsersRound } from "lucide-react";
import Link from "next/link";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import {
  GOAL_PROFILES,
  GOAL_RATE_FIELDS,
  GOAL_STAGES,
  getVisibleStageOffset,
  type GoalProfileKey,
} from "@/lib/crm/goals/catalog";
import { loadFunnelGoalsDraft } from "@/lib/crm/commercial-engine/draft-data";
import { funnelDraftValuesToGoals } from "@/lib/crm/commercial-engine/drafts";
import { loadFunnelGoals, type FunnelGoals } from "@/lib/crm/goals/data";

import { prepareFunnelGoalsDraftAction } from "../actions";
import { ConfigurationDraftForm } from "./ConfigurationDraftForm";

type GoalValues = Omit<FunnelGoals, "profileKey" | "effectiveMonth" | "updatedAt">;
type GoalValueKey = keyof GoalValues;

const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function numberInput(
  name: GoalValueKey,
  label: string,
  value: number | undefined,
  options: {
    maximum?: number;
    suffix?: string;
    accent?: "cyan" | "lime";
    compact?: boolean;
  } = {},
) {
  const focusClasses =
    options.accent === "lime"
      ? "focus-within:border-lime-500 focus-within:ring-lime-200"
      : "focus-within:border-cyan-500 focus-within:ring-cyan-200";

  return (
    <label
      key={name}
      className={`group ${options.compact ? "flex items-center gap-2" : "grid gap-1.5"} min-w-0 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] p-2 focus-within:ring-2 ${focusClasses}`}
    >
      <span className="min-w-0 flex-1 text-[0.7rem] leading-4 font-semibold text-[var(--analytics-ink)]">
        {label}
      </span>
      <span
        className={`flex min-w-0 items-center gap-1.5 ${options.compact ? "w-28 shrink-0" : "w-full"}`}
      >
        <input
          required
          name={name}
          type="number"
          min="0"
          max={options.maximum ?? 100000}
          step="1"
          defaultValue={value}
          placeholder="—"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-2 py-1.5 text-sm font-semibold text-[var(--analytics-ink)] tabular-nums"
        />
        {options.suffix ? (
          <small className="shrink-0 text-[0.65rem] font-medium text-[var(--analytics-muted)]">
            {options.suffix}
          </small>
        ) : null}
      </span>
    </label>
  );
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Dados indisponíveis";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export async function FunnelGoalsPage({
  canManageDraft,
  profile,
  notification,
}: {
  canManageDraft: boolean;
  profile: GoalProfileKey;
  notification?: "saved" | "validation" | "save";
}) {
  const [result, draft] = await Promise.all([
    loadFunnelGoals(profile),
    canManageDraft ? loadFunnelGoalsDraft(profile) : Promise.resolve(null),
  ]);
  const legacyValues = result.status === "ready" ? result.goals : null;
  const values: GoalValues | null = draft
    ? funnelDraftValuesToGoals(draft.payload, draft.updatedAt)
    : legacyValues;
  const effectiveMonth = draft
    ? draft.payload.effectiveMonth
    : result.status === "ready"
      ? result.goals.effectiveMonth
      : result.effectiveMonth;
  const stageOffset = getVisibleStageOffset(profile);
  const visibleStages = GOAL_STAGES.slice(stageOffset);
  const visibleRates = GOAL_RATE_FIELDS.slice(stageOffset);
  const isPartnerships = profile === "partnerships";
  const pageTitle = isPartnerships ? "Metas do funil de parcerias" : "Metas do funil";
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${effectiveMonth}T12:00:00Z`));
  const updatedAt = draft?.updatedAt ?? (result.status === "ready" ? result.goals.updatedAt : null);
  const draftAction = prepareFunnelGoalsDraftAction.bind(null, profile);
  const funnelWidthClasses =
    visibleStages.length > 4
      ? ["w-full", "w-[94%]", "w-[88%]", "w-[82%]", "w-[76%]", "w-[70%]"]
      : ["w-full", "w-[90%]", "w-[80%]", "w-[70%]"];

  return (
    <ManagementPage>
      <ManagementPageHeader
        title={pageTitle}
        description={
          canManageDraft
            ? `Prepare e valide um rascunho inativo para ${monthLabel}. Nada é aplicado ao funil.`
            : `Consulte a base legada de ${monthLabel}. O rascunho permanece indisponível para este perfil.`
        }
        status={
          <ManagementStatusBadge tone={canManageDraft ? "positive" : "warning"}>
            {canManageDraft ? "Rascunho editável" : "Somente leitura"}
          </ManagementStatusBadge>
        }
      />

      <section
        className={`${managementStyles.panel} ${managementStyles.panelStrong} grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`}
        aria-label="Estado do planejamento comercial"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className={managementStyles.sectionKicker}>Planejamento comercial</p>
          <span
            className={managementStyles.statusPill}
            data-state={result.status === "ready" ? "approved" : "pending"}
          >
            {canManageDraft
              ? "Base legada: somente leitura · Rascunho atual: editável"
              : "Base legada: somente leitura · Rascunho atual: indisponível"}
          </span>
        </div>
        <dl className="grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-lg border border-[var(--analytics-line)] lg:w-auto lg:min-w-72">
          <div className="px-3 py-2">
            <dt className="text-[0.62rem] font-bold tracking-wide text-[var(--analytics-cyan-strong)] uppercase">
              Competência
            </dt>
            <dd className="mt-1 text-xs font-semibold text-[var(--analytics-ink)] capitalize">
              {monthLabel}
            </dd>
          </div>
          <div className="border-l border-[var(--analytics-line)] px-3 py-2">
            <dt className="text-[0.62rem] font-bold tracking-wide text-[var(--analytics-cyan-strong)] uppercase">
              Atualização
            </dt>
            <dd className="mt-1 text-xs font-semibold text-[var(--analytics-ink)]">
              {formatUpdatedAt(updatedAt)}
            </dd>
          </div>
        </dl>
      </section>

      <nav aria-label="Canal das metas" className="grid gap-2 sm:grid-cols-2 lg:max-w-3xl">
        {(
          Object.entries(GOAL_PROFILES) as Array<
            [GoalProfileKey, (typeof GOAL_PROFILES)[GoalProfileKey]]
          >
        ).map(([key, item]) => {
          const Icon = key === "partnerships" ? UsersRound : Building2;
          const active = profile === key;

          return (
            <Link
              key={key}
              href={item.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`${managementStyles.panel} flex min-h-14 items-center gap-3 px-3 py-2 no-underline ${
                active
                  ? "border-cyan-500 bg-[color-mix(in_srgb,var(--analytics-cyan)_10%,var(--analytics-surface))]"
                  : "hover:border-[var(--analytics-cyan-strong)]"
              }`}
            >
              <span className={managementStyles.iconFrame}>
                <Icon aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-[var(--analytics-ink)]">{item.label}</strong>
                <span className="block text-xs text-[var(--analytics-muted)]">
                  {item.description}
                </span>
              </span>
              <span aria-hidden="true" className="text-[var(--analytics-cyan-strong)]">
                {active ? "●" : "›"}
              </span>
            </Link>
          );
        })}
      </nav>

      {notification ? (
        <div
          role={notification === "saved" ? "status" : "alert"}
          className={`${managementStyles.panel} px-4 py-3 text-sm ${
            notification === "saved"
              ? "text-[var(--analytics-positive-ink)]"
              : "text-[var(--analytics-danger-ink)]"
          }`}
        >
          {notification === "saved"
            ? "Rascunho de metas salvo e registrado na auditoria; nenhuma ativação foi realizada."
            : notification === "validation"
              ? "Revise os campos: existem valores ausentes ou fora dos limites permitidos."
              : "Não foi possível salvar as metas. Tente novamente."}
        </div>
      ) : null}

      {result.status === "empty" ? (
        <div
          className={`${managementStyles.panel} px-4 py-3 text-sm text-[var(--analytics-muted)]`}
          role="status"
        >
          <strong className="text-[var(--analytics-ink)]">Metas ainda não configuradas.</strong> Os
          campos permanecem vazios; nenhum dado demonstrativo foi aplicado para {monthLabel}.
        </div>
      ) : null}

      <ConfigurationDraftForm
        action={draftAction}
        enabled={canManageDraft}
        saveLabel={`Salvar rascunho de ${monthLabel}`}
      >
        <input type="hidden" name="draftRevision" value={draft?.revision ?? 0} />
        <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(15rem,0.82fr)_minmax(25rem,1.35fr)_minmax(15rem,0.78fr)]">
          <section
            aria-labelledby="conversion-title"
            className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-cyan-500 text-xs font-bold text-[var(--analytics-cyan-strong)]">
                01
              </span>
              <div>
                <p className={managementStyles.sectionKicker}>Conversões</p>
                <h2 id="conversion-title" className={managementStyles.sectionTitle}>
                  Volume da etapa anterior
                </h2>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--analytics-muted)]">
              Define a proporção de ocorrências entre etapas do funil.
            </p>
            <div className="mt-3 grid gap-1.5">
              {visibleRates.map((rate) =>
                numberInput(rate.key, rate.label, values?.[rate.key], {
                  maximum: 10000,
                  suffix: "%",
                  compact: true,
                }),
              )}
            </div>
            {isPartnerships ? (
              <>
                <input type="hidden" name="opportunitiesRate" value="0" />
                <input type="hidden" name="appointmentsRate" value="0" />
              </>
            ) : null}
          </section>

          <section
            aria-labelledby="funnel-result-title"
            className={`${managementStyles.panel} ${managementStyles.panelStrong} overflow-hidden`}
          >
            <div className="grid gap-3 border-b border-[var(--analytics-line)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
              <div>
                <p className={managementStyles.sectionKicker}>02 · Resultado mensal</p>
                <h2 id="funnel-result-title" className={managementStyles.sectionTitle}>
                  {result.status === "ready" ? "Última base legada" : "Base legada indisponível"}
                </h2>
                <p className={managementStyles.sectionDescription}>
                  Os volumes exibidos refletem exclusivamente a última base legada carregada. Para
                  conferir alterações do rascunho, use “Validar sem aplicar”.
                </p>
              </div>
              <label className="grid gap-1 rounded-lg border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] p-2">
                <span className="text-[0.68rem] font-semibold text-[var(--analytics-cyan-strong)]">
                  Meta mensal de vendas
                </span>
                <input
                  required
                  name="sales"
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  defaultValue={values?.sales}
                  placeholder="—"
                  className="min-h-11 w-full rounded-md border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-2 text-base font-semibold text-[var(--analytics-ink)] tabular-nums"
                />
              </label>
            </div>

            <div className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.68rem] font-bold tracking-widest text-[var(--analytics-positive-ink)] uppercase">
                  Sequência do funil
                </p>
                <p className="text-[0.65rem] text-[var(--analytics-muted)]">
                  Larguras ilustrativas; volumes sem proporção visual.
                </p>
              </div>
              <ol className="mt-2 grid gap-1" aria-label={`Funil de ${monthLabel}`}>
                {visibleStages.map((stage, index) => {
                  const value = legacyValues?.[stage.key];
                  const isFirstStage = index === 0;
                  const isSalesStage = stage.key === "sales";

                  return (
                    <li
                      key={stage.key}
                      className={`mx-auto ${funnelWidthClasses[index] ?? "w-full"}`}
                    >
                      <div
                        className={`grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-1.5 [clip-path:polygon(2%_0,98%_0,94%_100%,6%_100%)] ${
                          isSalesStage || isFirstStage
                            ? "bg-[var(--analytics-cyan)] text-[#082137]"
                            : "border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] text-[var(--analytics-ink)]"
                        }`}
                      >
                        <span className="min-w-0 text-xs font-semibold">{stage.label}</span>
                        <strong className="text-sm font-semibold tabular-nums">
                          {value === undefined ? "—" : integerFormatter.format(value)}
                        </strong>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <section
            aria-labelledby="capacity-title"
            className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--analytics-positive)] text-xs font-bold text-[var(--analytics-positive-ink)]">
                03
              </span>
              <div>
                <p className={managementStyles.sectionKicker}>Capacidade</p>
                <h2 id="capacity-title" className={managementStyles.sectionTitle}>
                  {isPartnerships ? "Imobiliárias" : "Corretores"} por tempo de operação
                </h2>
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
              {numberInput("brokerMinimumMonth1", "1º mês", values?.brokerMinimumMonth1, {
                accent: "lime",
              })}
              {numberInput("brokerMinimumMonth2", "2º mês", values?.brokerMinimumMonth2, {
                accent: "lime",
              })}
              {numberInput("brokerMinimumMonth3", "3º mês", values?.brokerMinimumMonth3, {
                accent: "lime",
              })}
              {numberInput(
                "brokerMinimumMonth4Plus",
                "4º mês ou mais",
                values?.brokerMinimumMonth4Plus,
                {
                  accent: "lime",
                },
              )}
            </div>
          </section>
        </div>

        <section className="grid gap-3 lg:grid-cols-2" aria-label="Parâmetros operacionais">
          <article className={`${managementStyles.panel} ${managementStyles.panelPadded}`}>
            <div className="flex items-start gap-3">
              <span className={managementStyles.iconFrame}>
                <CalendarDays aria-hidden="true" />
              </span>
              <div>
                <p className={managementStyles.sectionKicker}>04 · Ritmo semanal</p>
                <h2 className={managementStyles.sectionTitle}>Produção por unidade</h2>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {isPartnerships ? (
                <input type="hidden" name="brokerWeeklyAppointments" value="0" />
              ) : (
                numberInput(
                  "brokerWeeklyAppointments",
                  "Agendamentos",
                  values?.brokerWeeklyAppointments,
                  {
                    suffix: "/ semana",
                  },
                )
              )}
              {numberInput("brokerWeeklyVisits", "Visitas", values?.brokerWeeklyVisits, {
                suffix: "/ semana",
              })}
              {numberInput("brokerWeeklyFolders", "Pastas", values?.brokerWeeklyFolders, {
                suffix: "/ semana",
              })}
            </div>
          </article>

          <article className={`${managementStyles.panel} ${managementStyles.panelPadded}`}>
            <div className="flex items-start gap-3">
              <span className={managementStyles.iconFrame}>
                <CircleGauge aria-hidden="true" />
              </span>
              <div>
                <p className={managementStyles.sectionKicker}>05 · Time produtivo</p>
                <h2 className={managementStyles.sectionTitle}>Cobertura mínima da equipe</h2>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {isPartnerships ? (
                <input type="hidden" name="productiveTeamAppointments" value="0" />
              ) : (
                numberInput(
                  "productiveTeamAppointments",
                  "Agendamentos",
                  values?.productiveTeamAppointments,
                  { maximum: 100, suffix: "%", accent: "lime" },
                )
              )}
              {numberInput("productiveTeamVisits", "Visitas", values?.productiveTeamVisits, {
                maximum: 100,
                suffix: "%",
                accent: "lime",
              })}
              {numberInput("productiveTeamFolders", "Pastas", values?.productiveTeamFolders, {
                maximum: 100,
                suffix: "%",
                accent: "lime",
              })}
              {numberInput("productiveTeamSales", "Vendas", values?.productiveTeamSales, {
                maximum: 100,
                suffix: "%",
                accent: "lime",
              })}
            </div>
          </article>
        </section>
      </ConfigurationDraftForm>
    </ManagementPage>
  );
}
