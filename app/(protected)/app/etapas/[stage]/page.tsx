import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import { getAuthorizedDashboardViews } from "@/lib/authorization/dashboard-views";
import { enforcePermission } from "@/lib/authorization/enforce";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_VIEWS,
  isDashboardPeriod,
  isDashboardView,
  type DashboardPeriodKey,
  type DashboardStageKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel, type DashboardReadModel } from "@/lib/crm/dashboard/data";
import {
  buildPeriodFunnelReadings,
  calculateConversion,
  calculateProgress,
} from "@/lib/crm/dashboard/presentation";
import { GOALS_UNAVAILABLE_LABEL, availableCommercialValue } from "@/lib/crm/source-availability";
import { CRM_STAGES, getCrmStage, type CrmStage } from "@/lib/crm/stages/catalog";
import { buildStageComparisons, type StageComparison } from "@/lib/crm/stages/presentation";

import {
  AnalyticsCanvas,
  AnalyticsCard,
  AnalyticsTable,
  CommercialSourceLabel,
  FilterBar,
  FilterGroup,
  FilterLink,
  FunnelChart,
  Gauge,
  PageHeader,
  SectionHeading,
  UnavailableValue,
  type AnalyticsColumn,
  type ChartAccent,
} from "../../_components/analytics";
import styles from "../../_components/analytics/analytics.module.css";

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const DATA_UNAVAILABLE_LABEL = "Dados indisponíveis";

const STAGE_ACCENTS: Record<DashboardStageKey, ChartAccent> = {
  opportunities: "cyan",
  appointments: "blue",
  visits: "violet",
  folders: "teal",
  sales: "emerald",
};

const EMPTY_COMPARISONS: StageComparison[] = (
  [
    ["Mês", "Mês anterior", "Mês atual"],
    ["14 dias", "14 dias anteriores", "Últimos 14 dias"],
    ["7 dias", "7 dias anteriores", "Últimos 7 dias"],
    ["Semana", "Semana passada", "Esta semana"],
    ["Dia", "Ontem", "Hoje"],
  ] as const
).map(([label, previousLabel, currentLabel]) => ({
  label,
  previousLabel,
  previous: null,
  currentLabel,
  current: null,
  goal: null,
}));

function stageHref(slug: string, view: DashboardViewKey, period: DashboardPeriodKey) {
  return `/app/etapas/${slug}?view=${encodeURIComponent(view)}&period=${encodeURIComponent(period)}`;
}

function variationFor(row: StageComparison) {
  if (row.previous === null || row.previous <= 0 || row.current === null) return null;
  return (row.current - row.previous) / row.previous;
}

function StageNavigation({
  stage,
  view,
  period,
}: {
  stage: CrmStage;
  view: DashboardViewKey;
  period: DashboardPeriodKey;
}) {
  return (
    <nav aria-label="Etapas do funil" className={styles.stageNavigation}>
      {CRM_STAGES.map((item) => (
        <Link
          key={item.slug}
          href={stageHref(item.slug, view, period)}
          prefetch={false}
          aria-current={item.slug === stage.slug ? "page" : undefined}
          className={styles.stageNavigationLink}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function StageFilters({
  stage,
  view,
  period,
  authorizedViews,
}: {
  stage: CrmStage;
  view: DashboardViewKey;
  period: DashboardPeriodKey;
  authorizedViews: readonly DashboardViewKey[];
}) {
  return (
    <FilterBar
      density="compact"
      label={`Filtros autorizados de ${stage.label}`}
      unavailableDimensions={["Canal de vendas", "Gerente", "Responsável", "Empresa"]}
    >
      <FilterGroup label="Visão">
        {authorizedViews.map((viewKey) => (
          <FilterLink
            key={viewKey}
            href={stageHref(stage.slug, viewKey, period)}
            active={view === viewKey}
          >
            {DASHBOARD_VIEWS[viewKey].label}
          </FilterLink>
        ))}
      </FilterGroup>
      <FilterGroup label="Período">
        {(Object.keys(DASHBOARD_PERIODS) as DashboardPeriodKey[]).map((periodKey) => (
          <FilterLink
            key={periodKey}
            href={stageHref(stage.slug, view, periodKey)}
            active={period === periodKey}
          >
            {DASHBOARD_PERIODS[periodKey].label}
          </FilterLink>
        ))}
      </FilterGroup>
    </FilterBar>
  );
}

function comparisonColumns(
  dashboard: DashboardReadModel | null,
): Array<AnalyticsColumn<StageComparison>> {
  const unavailableReason = "A janela não existe no snapshot validado atual.";

  return [
    { key: "window", label: "Janela", render: (row) => row.label },
    { key: "previous-label", label: "Referência anterior", render: (row) => row.previousLabel },
    {
      key: "previous",
      label: "Valor anterior",
      align: "right",
      render: (row) =>
        row.previous === null ? (
          <UnavailableValue reason={unavailableReason} />
        ) : (
          numberFormatter.format(row.previous)
        ),
    },
    { key: "current-label", label: "Referência atual", render: (row) => row.currentLabel },
    {
      key: "current",
      label: "Valor atual",
      align: "right",
      render: (row) =>
        row.current === null ? (
          <UnavailableValue reason={unavailableReason} />
        ) : (
          numberFormatter.format(row.current)
        ),
    },
    {
      key: "variation",
      label: "Variação",
      align: "right",
      render: (row) => {
        const variation = variationFor(row);
        return variation === null ? (
          <UnavailableValue reason="A variação exige dois valores comparáveis e base maior que zero." />
        ) : (
          percentFormatter.format(variation)
        );
      },
    },
    {
      key: "goal",
      label: "Meta",
      align: "right",
      render: (row) => {
        if (!dashboard) {
          return <UnavailableValue reason="Ainda não existe snapshot comercial validado." />;
        }
        if (!dashboard.goalsAvailable) {
          return <UnavailableValue reason="A fonte oficial de metas não está disponível." />;
        }
        return row.goal !== null && row.goal > 0 ? (
          numberFormatter.format(row.goal)
        ) : (
          <UnavailableValue reason="Não existe meta definida para esta janela." />
        );
      },
    },
  ];
}

function generatedAtLabel(dashboard: DashboardReadModel | null) {
  if (!dashboard) return DATA_UNAVAILABLE_LABEL;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: dashboard.timezone,
  }).format(new Date(dashboard.generatedAt));
}

function StageMetadata({ dashboard }: { dashboard: DashboardReadModel | null }) {
  return (
    <dl className={styles.stageMetadata}>
      <div>
        <dt>Atualizado em</dt>
        <dd>{generatedAtLabel(dashboard)}</dd>
      </div>
      <div>
        <dt>Fonte</dt>
        <dd>
          {dashboard ? <CommercialSourceLabel value={dashboard.source} /> : DATA_UNAVAILABLE_LABEL}
        </dd>
      </div>
    </dl>
  );
}

function StageComposition({
  stage,
  view,
  period,
  dashboard,
  authorizedViews,
}: {
  stage: CrmStage;
  view: DashboardViewKey;
  period: DashboardPeriodKey;
  dashboard: DashboardReadModel | null;
  authorizedViews: readonly DashboardViewKey[];
}) {
  const periodConfig = DASHBOARD_PERIODS[period];
  const viewMetrics = dashboard?.metrics[view] ?? null;
  const metric = viewMetrics?.[stage.key] ?? null;
  const current = metric?.[periodConfig.currentField] ?? null;
  const sourceGoal =
    dashboard && metric
      ? availableCommercialValue(dashboard.goalsAvailable, metric[periodConfig.goalField])
      : null;
  const goal = sourceGoal !== null && sourceGoal > 0 ? sourceGoal : null;
  const progress = current === null || goal === null ? null : calculateProgress(current, goal);
  const gap = current === null || goal === null ? null : Math.max(goal - current, 0);
  const stageIndex = CRM_STAGES.findIndex((item) => item.slug === stage.slug);
  const previousStage = stageIndex > 0 ? CRM_STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < CRM_STAGES.length - 1 ? CRM_STAGES[stageIndex + 1] : null;
  const previousValue =
    viewMetrics && previousStage ? viewMetrics[previousStage.key][periodConfig.currentField] : null;
  const volumeRatio =
    current === null || previousValue === null ? null : calculateConversion(current, previousValue);
  const comparisons = metric ? buildStageComparisons(metric) : EMPTY_COMPARISONS;
  const funnel = viewMetrics
    ? buildPeriodFunnelReadings(viewMetrics, period)
    : CRM_STAGES.map((item) => ({
        key: item.key,
        label: item.label,
        value: null,
        conversion: null,
      }));
  return (
    <main className={styles.canvasMain}>
      <AnalyticsCanvas kind="stage">
        <PageHeader
          variant="compact"
          title={stage.label}
          description={stage.description}
          meta={<StageMetadata dashboard={dashboard} />}
        />

        <StageNavigation stage={stage} view={view} period={period} />

        <StageFilters stage={stage} view={view} period={period} authorizedViews={authorizedViews} />

        {!dashboard ? (
          <p className="sr-only" role="status">
            Ainda não existe snapshot comercial validado. Nenhum valor demonstrativo é exibido.
          </p>
        ) : !dashboard.goalsAvailable ? (
          <p className="sr-only" role="status">
            {GOALS_UNAVAILABLE_LABEL}. Realizados continuam visíveis; gauge, meta e gap ficam
            indisponíveis até existir uma fonte oficial segura.
          </p>
        ) : sourceGoal !== null && sourceGoal <= 0 ? (
          <p className="sr-only" role="status">
            Meta não definida para o período. O snapshot trouxe meta igual a zero; esse valor não é
            tratado como alvo válido nem como progresso zero.
          </p>
        ) : null}

        <section className={styles.stageOverviewGrid}>
          <AnalyticsCard density="compact" className={styles.stageRealizedCard}>
            <SectionHeading
              density="compact"
              kicker={`${DASHBOARD_VIEWS[view].label} · ${periodConfig.label}`}
              title={`Realizado de ${stage.label.toLocaleLowerCase("pt-BR")}`}
              description="A leitura usa somente o snapshot e os filtros suportados no servidor."
            />
            <div className={styles.stageRealized}>
              <div>
                <span className={styles.stageMetricLabel}>Total realizado</span>
                <strong className={styles.stageTotal}>
                  {current === null ? "—" : numberFormatter.format(current)}
                </strong>
                <p className={styles.stageGoal}>
                  {goal === null
                    ? "Meta indisponível ou não definida"
                    : `Meta oficial: ${numberFormatter.format(goal)}`}
                </p>
                <dl className={styles.stageMiniGrid}>
                  <div>
                    <dt>Gap matemático</dt>
                    <dd>
                      {gap === null ? (
                        <UnavailableValue reason="O gap exige realizado e meta oficial maior que zero." />
                      ) : (
                        numberFormatter.format(gap)
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Relação com etapa anterior</dt>
                    <dd>
                      {previousStage === null ? (
                        "Etapa de entrada"
                      ) : volumeRatio === null ? (
                        <UnavailableValue reason="A relação exige realizado e base anterior maior que zero." />
                      ) : (
                        percentFormatter.format(volumeRatio)
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <Gauge
                variant="compact"
                label="Atingimento da meta"
                value={progress === null ? "Indisponível" : percentFormatter.format(progress)}
                ratio={progress}
                accent={STAGE_ACCENTS[stage.key]}
              />
            </div>
          </AnalyticsCard>

          <AnalyticsCard density="compact" className={styles.stagePositionCard}>
            <div className={styles.stagePositionHeading}>
              <div>
                <p>Posição no funil</p>
                <span>Leitura do período</span>
              </div>
              <strong>
                {stageIndex + 1} de {CRM_STAGES.length}
              </strong>
            </div>
            <dl className={styles.stageFacts}>
              <div>
                <dt>Etapa</dt>
                <dd>{stage.label}</dd>
              </div>
              <div>
                <dt>Visão aplicada</dt>
                <dd>{DASHBOARD_VIEWS[view].label}</dd>
              </div>
              <div>
                <dt>Período aplicado</dt>
                <dd>{periodConfig.label}</dd>
              </div>
            </dl>
            <nav aria-label="Etapas adjacentes" className={styles.stageAdjacentNavigation}>
              {previousStage ? (
                <Link href={stageHref(previousStage.slug, view, period)} prefetch={false}>
                  ← {previousStage.label}
                </Link>
              ) : (
                <span>Início do funil</span>
              )}
              {nextStage ? (
                <Link href={stageHref(nextStage.slug, view, period)} prefetch={false}>
                  {nextStage.label} →
                </Link>
              ) : (
                <span>Fim do funil</span>
              )}
            </nav>
          </AnalyticsCard>
        </section>

        <div className={styles.stageDetailsGrid}>
          <section className={styles.stageFullFunnel} aria-labelledby="full-funnel-title">
            <AnalyticsCard density="compact">
              <SectionHeading
                id="full-funnel-title"
                density="compact"
                kicker="Contexto do período"
                title="Funil completo"
                description="As relações comparam volumes agregados; não acompanham o mesmo grupo ao longo do tempo."
              />
              <FunnelChart
                variant="compact"
                label={`${DASHBOARD_VIEWS[view].label}, ${periodConfig.label.toLocaleLowerCase("pt-BR")}`}
                stages={funnel}
                accent={STAGE_ACCENTS[stage.key]}
              />
            </AnalyticsCard>
          </section>

          <section className={styles.stageComparison} aria-labelledby="period-comparison-title">
            <AnalyticsCard density="compact">
              <SectionHeading
                id="period-comparison-title"
                density="compact"
                kicker="Evolução validada"
                title="Comparativo entre períodos"
                description="Ausência permanece ausência: nenhum valor é preenchido com zero ou reaproveitado de outra janela."
              />
              <AnalyticsTable
                density="compact"
                caption={`Comparações temporais de ${stage.label}`}
                rows={comparisons}
                columns={comparisonColumns(dashboard)}
                rowKey={(row) => row.label}
              />
            </AnalyticsCard>
          </section>
        </div>
      </AnalyticsCanvas>
    </main>
  );
}

export function generateStaticParams() {
  return CRM_STAGES.map((stage) => ({ stage: stage.slug }));
}

export default async function StagePage({
  params,
  searchParams,
}: {
  params: Promise<{ stage: string }>;
  searchParams: Promise<{ view?: string | string[]; period?: string | string[] }>;
}) {
  const authorization = await enforcePermission("crm.stages.view");
  const [{ stage: slug }, query] = await Promise.all([params, searchParams]);
  const stage = getCrmStage(slug);
  if (!stage) notFound();

  const authorizedViews = getAuthorizedDashboardViews(authorization.permissions);
  if (authorizedViews.length === 0) forbidden();
  if (isDashboardView(query.view) && !authorizedViews.includes(query.view)) forbidden();
  const view: DashboardViewKey = isDashboardView(query.view) ? query.view : authorizedViews[0]!;
  const period: DashboardPeriodKey = isDashboardPeriod(query.period) ? query.period : "month";
  const result = await loadDashboardReadModel([view]);

  return (
    <StageComposition
      stage={stage}
      view={view}
      period={period}
      dashboard={result.status === "ready" ? result.dashboard : null}
      authorizedViews={authorizedViews}
    />
  );
}
