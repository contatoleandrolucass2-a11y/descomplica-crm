import Link from "next/link";

import { enforcePermission } from "@/lib/authorization/enforce";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_STAGES,
  DASHBOARD_VIEWS,
  isDashboardPeriod,
  isDashboardView,
  type DashboardPeriodKey,
  type DashboardStageKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel, type DashboardMetric } from "@/lib/crm/dashboard/data";
import {
  calculateConversion,
  calculateProgress,
  clampPercentage,
} from "@/lib/crm/dashboard/presentation";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
} from "@/lib/crm/salesforce/config";
import {
  DATA_UNAVAILABLE_LABEL,
  GOALS_UNAVAILABLE_LABEL,
  availableCommercialValue,
} from "@/lib/crm/source-availability";

import { SalesforceRefreshButton } from "./_components/SalesforceRefreshButton";

export const metadata = { title: "Dashboard comercial" };

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function metricValue(metric: DashboardMetric, period: DashboardPeriodKey) {
  const config = DASHBOARD_PERIODS[period];
  return { current: metric[config.currentField], goal: metric[config.goalField] };
}

function dashboardHref(view: DashboardViewKey, period: DashboardPeriodKey) {
  return `/app?view=${encodeURIComponent(view)}&period=${encodeURIComponent(period)}`;
}

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; period?: string | string[] }>;
}) {
  const authorization = await enforcePermission("crm.dashboard.view");
  const canRefresh = authorization.permissions.includes("crm.salesforce.refresh");
  const ingestConfiguration = getSalesforceIngestConfiguration();
  const refreshConfiguration = getSalesforceRefreshConfiguration();
  const query = await searchParams;
  const selectedView: DashboardViewKey = isDashboardView(query.view) ? query.view : "all";
  const selectedPeriod: DashboardPeriodKey = isDashboardPeriod(query.period)
    ? query.period
    : "month";
  const result = await loadDashboardReadModel();

  if (result.status === "empty") {
    return (
      <main className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
            Aguardando dados
          </span>
          <h1 className="mt-5 text-3xl font-semibold text-slate-950">Dashboard comercial</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            A estrutura segura do dashboard está pronta, mas ainda não existe um snapshot real
            carregado. Nenhum dado demonstrativo é usado como substituto.
          </p>
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            {ingestConfiguration.available
              ? "A ingestão autenticada está pronta para receber o primeiro snapshot versionado."
              : "A integração de dados está indisponível neste ambiente."}
          </div>
          {canRefresh ? (
            <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
              <SalesforceRefreshButton available={refreshConfiguration.available} />
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  const { dashboard } = result;
  const metrics = dashboard.metrics[selectedView];
  const stages = Object.entries(DASHBOARD_STAGES) as Array<
    [DashboardStageKey, (typeof DASHBOARD_STAGES)[DashboardStageKey]]
  >;
  const salesValue = dashboard.salesValue[selectedView][selectedPeriod];

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium tracking-wide text-cyan-300 uppercase">
                Visão comercial
              </p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Dashboard do funil</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                {DASHBOARD_VIEWS[selectedView].description}
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-4 rounded-2xl bg-white/10 px-5 py-4 text-left ring-1 ring-white/15 sm:w-auto sm:text-right">
              <p className="text-xs tracking-wide text-slate-300 uppercase">Atualizado em</p>
              <strong className="mt-1 block text-sm">
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: dashboard.timezone,
                }).format(new Date(dashboard.generatedAt))}
              </strong>
              <span className="mt-1 block text-xs break-words text-slate-400">
                {dashboard.source}
              </span>
              {canRefresh ? (
                <SalesforceRefreshButton available={refreshConfiguration.available} />
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <nav
              aria-label="Visão do dashboard"
              className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap"
            >
              {(Object.keys(DASHBOARD_VIEWS) as DashboardViewKey[]).map((viewKey) => (
                <Link
                  key={viewKey}
                  href={dashboardHref(viewKey, selectedPeriod)}
                  aria-current={selectedView === viewKey ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-center text-sm font-medium transition ${
                    selectedView === viewKey
                      ? "bg-cyan-300 text-slate-950"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {DASHBOARD_VIEWS[viewKey].label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Período do dashboard" className="flex flex-wrap gap-2">
              {(Object.keys(DASHBOARD_PERIODS) as DashboardPeriodKey[]).map((periodKey) => (
                <Link
                  key={periodKey}
                  href={dashboardHref(selectedView, periodKey)}
                  aria-current={selectedPeriod === periodKey ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    selectedPeriod === periodKey
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {DASHBOARD_PERIODS[periodKey].label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        {!dashboard.goalsAvailable ? (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <strong className="block">{GOALS_UNAVAILABLE_LABEL}</strong>
            <span className="mt-1 block">
              Os resultados do funil são reais, mas metas, atingimento e progresso não são
              apresentados até existir uma fonte oficial.
            </span>
          </section>
        ) : null}

        <section aria-label="Indicadores do funil" className="mt-6 grid gap-4 md:grid-cols-5">
          {stages.map(([stageKey, stage]) => {
            const value = metricValue(metrics[stageKey], selectedPeriod);
            const goal = availableCommercialValue(dashboard.goalsAvailable, value.goal);
            const progress = goal === null ? null : calculateProgress(value.current, goal);

            return (
              <article
                key={stageKey}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <p className="text-sm font-medium text-slate-600">{stage.label}</p>
                <strong className="mt-3 block text-3xl font-semibold text-slate-950">
                  {numberFormatter.format(value.current)}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {goal === null
                    ? GOALS_UNAVAILABLE_LABEL
                    : `Meta: ${numberFormatter.format(goal)}`}
                </p>
                {goal === null ? (
                  <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                    {DATA_UNAVAILABLE_LABEL}
                  </p>
                ) : (
                  <>
                    <progress
                      className="mt-4 h-2 w-full accent-cyan-600"
                      max={100}
                      value={clampPercentage(progress)}
                      aria-label={`Progresso de ${stage.label}`}
                    />
                    <p className="mt-2 text-xs font-medium text-slate-600">
                      {progress === null ? "Meta não definida" : percentFormatter.format(progress)}
                    </p>
                  </>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-cyan-700">Conversão entre etapas</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Eficiência do funil</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Valor vendido no período</p>
                <strong className="text-xl text-slate-950">
                  {currencyFormatter.format(salesValue)}
                </strong>
              </div>
            </div>

            <ol className="mt-8 grid gap-3">
              {stages.map(([stageKey, stage], index) => {
                const current = metricValue(metrics[stageKey], selectedPeriod).current;
                const previousStage = stages[index - 1];
                const previous = previousStage
                  ? metricValue(metrics[previousStage[0]], selectedPeriod).current
                  : 0;
                const conversion = previousStage ? calculateConversion(current, previous) : null;

                return (
                  <li
                    key={stageKey}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-slate-50 px-5 py-4"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{stage.shortLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {previousStage
                          ? `Conversão desde ${previousStage[1].shortLabel.toLocaleLowerCase("pt-BR")}`
                          : "Entrada total do funil"}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="block text-lg text-slate-950">
                        {numberFormatter.format(current)}
                      </strong>
                      {conversion !== null ? (
                        <span className="text-xs font-medium text-cyan-700">
                          {percentFormatter.format(conversion)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>

          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm font-medium text-cyan-700">Empreendimentos</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Destaques</h2>
            {dashboard.topDevelopments[selectedView].length > 0 ? (
              <ol className="mt-6 grid gap-3">
                {dashboard.topDevelopments[selectedView].map((development) => (
                  <li
                    key={development.rank}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {development.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                      {development.name}
                    </span>
                    <strong className="text-sm text-slate-950">{development.total}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Nenhum empreendimento classificado neste snapshot.
              </p>
            )}
            <dl className="mt-6 border-t border-slate-200 pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Data de referência</dt>
                <dd className="font-medium text-slate-800">
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                    new Date(`${dashboard.referenceDate}T00:00:00Z`),
                  )}
                </dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>
    </main>
  );
}
