import Link from "next/link";
import { notFound } from "next/navigation";

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
import { loadDashboardReadModel } from "@/lib/crm/dashboard/data";
import {
  buildPeriodFunnelReadings,
  calculateConversion,
  calculateProgress,
} from "@/lib/crm/dashboard/presentation";
import { GOALS_UNAVAILABLE_LABEL, availableCommercialValue } from "@/lib/crm/source-availability";
import { CRM_STAGES, getCrmStage, type CrmStage } from "@/lib/crm/stages/catalog";
import { buildStageComparisons, type StageComparison } from "@/lib/crm/stages/presentation";

import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
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

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const STAGE_ACCENTS: Record<DashboardStageKey, ChartAccent> = {
  opportunities: "cyan",
  appointments: "blue",
  visits: "violet",
  folders: "teal",
  sales: "emerald",
};

const INTEGRATION_PENDING_LABEL = "Dado indisponível — integração pendente";

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
    <nav aria-label="Etapas do funil" className="grid gap-2 sm:grid-cols-5">
      {CRM_STAGES.map((item) => (
        <Link
          key={item.slug}
          href={stageHref(item.slug, view, period)}
          aria-current={item.slug === stage.slug ? "page" : undefined}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-center text-sm font-medium ring-1 ring-white/15 ${
            item.slug === stage.slug
              ? "bg-cyan-300 text-[#082137]"
              : "bg-white/8 text-white hover:bg-white/15"
          }`}
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
}: {
  stage: CrmStage;
  view: DashboardViewKey;
  period: DashboardPeriodKey;
}) {
  return (
    <FilterBar
      label={`Filtros autorizados de ${stage.label}`}
      unavailableDimensions={["Canal de vendas", "Gerente", "Responsável", "Empresa"]}
    >
      <FilterGroup label="Visão">
        {(Object.keys(DASHBOARD_VIEWS) as DashboardViewKey[]).map((viewKey) => (
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

function EmptyStagePage({
  stage,
  view,
  period,
}: {
  stage: CrmStage;
  view: DashboardViewKey;
  period: DashboardPeriodKey;
}) {
  const periodConfig = DASHBOARD_PERIODS[period];
  const stageIndex = CRM_STAGES.findIndex((item) => item.slug === stage.slug);
  const previousStage = stageIndex > 0 ? CRM_STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < CRM_STAGES.length - 1 ? CRM_STAGES[stageIndex + 1] : null;
  const emptyFunnel = CRM_STAGES.map((item) => ({
    key: item.key,
    label: item.label,
    value: null,
    conversion: null,
  }));
  const unavailableColumns: Array<AnalyticsColumn<StageComparison>> = [
    { key: "window", label: "Janela", render: (row) => row.label },
    { key: "previous-label", label: "Referência anterior", render: (row) => row.previousLabel },
    {
      key: "previous",
      label: "Valor anterior",
      align: "right",
      render: () => <UnavailableValue reason={INTEGRATION_PENDING_LABEL} />,
    },
    { key: "current-label", label: "Referência atual", render: (row) => row.currentLabel },
    {
      key: "current",
      label: "Valor atual",
      align: "right",
      render: () => <UnavailableValue reason={INTEGRATION_PENDING_LABEL} />,
    },
    {
      key: "variation",
      label: "Variação",
      align: "right",
      render: () => <UnavailableValue reason={INTEGRATION_PENDING_LABEL} />,
    },
    {
      key: "goal",
      label: "Meta",
      align: "right",
      render: () => <UnavailableValue reason={INTEGRATION_PENDING_LABEL} />,
    },
  ];

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
        <PageHeader
          eyebrow={`Etapa ${String(stageIndex + 1).padStart(2, "0")} do funil`}
          title={stage.label}
          description={stage.description}
          meta={
            <dl className="grid gap-3">
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte</dt>
                <dd className="mt-1 font-semibold text-white">Nenhum snapshot validado</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Situação</dt>
                <dd className="mt-1 text-slate-100">{INTEGRATION_PENDING_LABEL}</dd>
              </div>
            </dl>
          }
          footer={<StageNavigation stage={stage} view={view} period={period} />}
        />

        <StageFilters stage={stage} view={view} period={period} />

        <DataState
          variant="unavailable"
          compact
          title={INTEGRATION_PENDING_LABEL}
          description="A composição analítica permanece visível, mas nenhum valor é inferido enquanto o snapshot real e validado não estiver disponível."
        />

        <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <AnalyticsCard>
            <SectionHeading
              kicker={`${DASHBOARD_VIEWS[view].label} · ${periodConfig.label}`}
              title={`Realizado de ${stage.label.toLocaleLowerCase("pt-BR")}`}
              description="Realizado, meta e gap dependem do snapshot validado."
            />
            <div className="grid min-w-0 items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.9fr)]">
              <div className="min-w-0">
                <strong className="block text-xl font-semibold text-slate-950">
                  {INTEGRATION_PENDING_LABEL}
                </strong>
                <p className="mt-2 text-sm text-slate-600">
                  Nenhum realizado ou alvo é preenchido com valor demonstrativo.
                </p>
                <dl className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">Gap matemático</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      <UnavailableValue reason={INTEGRATION_PENDING_LABEL} />
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">Relação com etapa anterior</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      <UnavailableValue reason={INTEGRATION_PENDING_LABEL} />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="min-w-0">
                <Gauge
                  label="Atingimento da meta"
                  value="Indisponível"
                  ratio={null}
                  accent={STAGE_ACCENTS[stage.key]}
                />
                <p className="mt-2 text-center text-xs text-slate-500">
                  {INTEGRATION_PENDING_LABEL}
                </p>
              </div>
            </div>
          </AnalyticsCard>

          <AnalyticsCard tone="navy">
            <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
              Leitura factual
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Posição no funil</h2>
            <dl className="mt-6 grid gap-4 text-sm">
              <div className="border-b border-white/10 pb-4">
                <dt className="text-slate-400">Etapa</dt>
                <dd className="mt-1 font-semibold text-white">
                  {stageIndex + 1} de {CRM_STAGES.length}
                </dd>
              </div>
              <div className="border-b border-white/10 pb-4">
                <dt className="text-slate-400">Visão selecionada</dt>
                <dd className="mt-1 font-semibold text-white">{DASHBOARD_VIEWS[view].label}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Período selecionado</dt>
                <dd className="mt-1 font-semibold text-white">{periodConfig.label}</dd>
              </div>
            </dl>
            <nav
              aria-label="Etapas adjacentes"
              className="mt-7 grid gap-2 border-t border-white/10 pt-5"
            >
              {previousStage ? (
                <Link
                  href={stageHref(previousStage.slug, view, period)}
                  className="inline-flex min-h-11 items-center rounded-lg bg-white/8 px-3 py-2 text-sm text-white hover:bg-white/15"
                >
                  ← {previousStage.label}
                </Link>
              ) : (
                <span className="text-sm text-slate-400">Início do funil</span>
              )}
              {nextStage ? (
                <Link
                  href={stageHref(nextStage.slug, view, period)}
                  className="inline-flex min-h-11 items-center justify-end rounded-lg bg-white/8 px-3 py-2 text-sm text-white hover:bg-white/15"
                >
                  {nextStage.label} →
                </Link>
              ) : (
                <span className="text-right text-sm text-slate-400">Fim do funil</span>
              )}
            </nav>
          </AnalyticsCard>
        </section>

        <section className="min-w-0">
          <SectionHeading
            kicker="Contexto do período"
            title="Funil completo"
            description="Todas as etapas permanecem explícitas; volumes e conversões aguardam integração segura."
          />
          <AnalyticsCard>
            <FunnelChart
              label={`${DASHBOARD_VIEWS[view].label}, ${periodConfig.label.toLocaleLowerCase("pt-BR")}`}
              stages={emptyFunnel}
              accent={STAGE_ACCENTS[stage.key]}
            />
          </AnalyticsCard>
        </section>

        <section className="min-w-0">
          <SectionHeading
            kicker="Evolução validada"
            title="Comparativo entre períodos"
            description="As janelas são exibidas sem preencher ausências com zero ou reaproveitar outro período."
          />
          <AnalyticsTable
            caption={`Comparações temporais de ${stage.label} — ${INTEGRATION_PENDING_LABEL}`}
            rows={EMPTY_COMPARISONS}
            columns={unavailableColumns}
            rowKey={(row) => row.label}
          />
        </section>
      </div>
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
  await enforcePermission("crm.stages.view");
  const [{ stage: slug }, query] = await Promise.all([params, searchParams]);
  const stage = getCrmStage(slug);
  if (!stage) notFound();

  const view: DashboardViewKey = isDashboardView(query.view) ? query.view : "all";
  const period: DashboardPeriodKey = isDashboardPeriod(query.period) ? query.period : "month";
  const result = await loadDashboardReadModel();

  if (result.status === "empty") {
    return <EmptyStagePage stage={stage} view={view} period={period} />;
  }

  const { dashboard } = result;
  const metric = dashboard.metrics[view][stage.key];
  const periodConfig = DASHBOARD_PERIODS[period];
  const current = metric[periodConfig.currentField];
  const sourceGoal = availableCommercialValue(
    dashboard.goalsAvailable,
    metric[periodConfig.goalField],
  );
  const goal = sourceGoal !== null && sourceGoal > 0 ? sourceGoal : null;
  const progress = goal === null ? null : calculateProgress(current, goal);
  const gap = goal === null ? null : Math.max(goal - current, 0);
  const stageIndex = CRM_STAGES.findIndex((item) => item.slug === stage.slug);
  const previousStage = stageIndex > 0 ? CRM_STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < CRM_STAGES.length - 1 ? CRM_STAGES[stageIndex + 1] : null;
  const previousValue = previousStage
    ? dashboard.metrics[view][previousStage.key][periodConfig.currentField]
    : null;
  const volumeRatio = previousValue === null ? null : calculateConversion(current, previousValue);
  const comparisons = buildStageComparisons(metric);
  const selectedFunnel = buildPeriodFunnelReadings(dashboard.metrics[view], period);
  const unavailableReason = "A janela não existe no snapshot validado atual.";
  const comparisonColumns: Array<AnalyticsColumn<StageComparison>> = [
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

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-[minmax(0,1fr)] gap-7">
        <PageHeader
          eyebrow={`Etapa ${String(stageIndex + 1).padStart(2, "0")} do funil`}
          title={stage.label}
          description={stage.description}
          meta={
            <dl className="grid gap-3">
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Atualizado em</dt>
                <dd className="mt-1 font-semibold text-white">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: dashboard.timezone,
                  }).format(new Date(dashboard.generatedAt))}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte</dt>
                <dd className="mt-1 break-words text-slate-100">{dashboard.source}</dd>
              </div>
            </dl>
          }
          footer={<StageNavigation stage={stage} view={view} period={period} />}
        />

        <StageFilters stage={stage} view={view} period={period} />

        {!dashboard.goalsAvailable ? (
          <DataState
            variant="unavailable"
            compact
            title={GOALS_UNAVAILABLE_LABEL}
            description="Realizados continuam visíveis. Gauge, meta e gap ficam indisponíveis até existir uma fonte oficial segura."
          />
        ) : sourceGoal !== null && sourceGoal <= 0 ? (
          <DataState
            variant="unavailable"
            compact
            title="Meta não definida para o período"
            description="O snapshot trouxe valor de meta igual a zero; ele não é tratado como progresso zero nem como alvo válido."
          />
        ) : null}

        <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <AnalyticsCard>
            <SectionHeading
              kicker={`${DASHBOARD_VIEWS[view].label} · ${periodConfig.label}`}
              title={`Realizado de ${stage.label.toLocaleLowerCase("pt-BR")}`}
              description="A leitura usa somente o snapshot e o filtro suportado no servidor."
            />
            <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.9fr)]">
              <div>
                <strong className="block text-5xl font-semibold tracking-tight text-slate-950">
                  {numberFormatter.format(current)}
                </strong>
                <p className="mt-2 text-sm text-slate-600">
                  {goal === null
                    ? "Meta indisponível ou não definida"
                    : `Meta oficial: ${numberFormatter.format(goal)}`}
                </p>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">Gap matemático</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {gap === null ? (
                        <UnavailableValue reason="O gap exige meta oficial maior que zero." />
                      ) : (
                        numberFormatter.format(gap)
                      )}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs text-slate-500">Relação com etapa anterior</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {previousStage === null ? (
                        "Etapa de entrada"
                      ) : volumeRatio === null ? (
                        <UnavailableValue reason="A base anterior é nula ou igual a zero." />
                      ) : (
                        percentFormatter.format(volumeRatio)
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <Gauge
                label="Atingimento da meta"
                value={progress === null ? "Indisponível" : percentFormatter.format(progress)}
                ratio={progress}
                accent={STAGE_ACCENTS[stage.key]}
              />
            </div>
          </AnalyticsCard>

          <AnalyticsCard tone="navy">
            <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
              Leitura factual
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Posição no funil</h2>
            <dl className="mt-6 grid gap-4 text-sm">
              <div className="border-b border-white/10 pb-4">
                <dt className="text-slate-400">Etapa</dt>
                <dd className="mt-1 font-semibold text-white">
                  {stageIndex + 1} de {CRM_STAGES.length}
                </dd>
              </div>
              <div className="border-b border-white/10 pb-4">
                <dt className="text-slate-400">Visão aplicada</dt>
                <dd className="mt-1 font-semibold text-white">{DASHBOARD_VIEWS[view].label}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Período aplicado</dt>
                <dd className="mt-1 font-semibold text-white">{periodConfig.label}</dd>
              </div>
            </dl>
            <nav
              aria-label="Etapas adjacentes"
              className="mt-7 grid gap-2 border-t border-white/10 pt-5"
            >
              {previousStage ? (
                <Link
                  href={stageHref(previousStage.slug, view, period)}
                  className="inline-flex min-h-11 items-center rounded-lg bg-white/8 px-3 py-2 text-sm text-white hover:bg-white/15"
                >
                  ← {previousStage.label}
                </Link>
              ) : (
                <span className="text-sm text-slate-400">Início do funil</span>
              )}
              {nextStage ? (
                <Link
                  href={stageHref(nextStage.slug, view, period)}
                  className="inline-flex min-h-11 items-center justify-end rounded-lg bg-white/8 px-3 py-2 text-sm text-white hover:bg-white/15"
                >
                  {nextStage.label} →
                </Link>
              ) : (
                <span className="text-right text-sm text-slate-400">Fim do funil</span>
              )}
            </nav>
          </AnalyticsCard>
        </section>

        <section className="min-w-0">
          <SectionHeading
            kicker="Contexto do período"
            title="Funil completo"
            description="As relações comparam volumes agregados; não são conversões de coorte."
          />
          <AnalyticsCard>
            <FunnelChart
              label={`${DASHBOARD_VIEWS[view].label}, ${periodConfig.label.toLocaleLowerCase("pt-BR")}`}
              stages={selectedFunnel}
              accent={STAGE_ACCENTS[stage.key]}
            />
          </AnalyticsCard>
        </section>

        <section className="min-w-0">
          <SectionHeading
            kicker="Evolução validada"
            title="Comparativo entre períodos"
            description="Ausência permanece ausência: nenhum valor é preenchido com zero ou reaproveitado de outra janela."
          />
          <AnalyticsTable
            caption={`Comparações temporais de ${stage.label}`}
            rows={comparisons}
            columns={comparisonColumns}
            rowKey={(row) => row.label}
          />
        </section>
      </div>
    </main>
  );
}
