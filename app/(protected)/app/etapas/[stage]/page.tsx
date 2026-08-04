import Link from "next/link";
import { notFound } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_VIEWS,
  isDashboardPeriod,
  isDashboardView,
  type DashboardPeriodKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel } from "@/lib/crm/dashboard/data";
import { calculateConversion, calculateProgress } from "@/lib/crm/dashboard/presentation";
import { CRM_STAGES, getCrmStage } from "@/lib/crm/stages/catalog";
import { buildStageComparisons, stageAttainment } from "@/lib/crm/stages/presentation";

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const STATUS_CLASSES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cyan: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
} as const;

function stageHref(slug: string, view: DashboardViewKey, period: DashboardPeriodKey) {
  return `/app/etapas/${slug}?view=${view}&period=${period}`;
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
    return (
      <main className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
            Aguardando dados
          </span>
          <h1 className="mt-5 text-3xl font-semibold text-slate-950">{stage.label}</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            O read model está pronto, mas o Salesforce ainda não enviou um snapshot real. Nenhum
            indicador demonstrativo será exibido.
          </p>
          <Link
            href="/app"
            className="mt-7 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </main>
    );
  }

  const dashboard = result.dashboard;
  const metric = dashboard.metrics[view][stage.key];
  const periodConfig = DASHBOARD_PERIODS[period];
  const current = metric[periodConfig.currentField];
  const goal = metric[periodConfig.goalField];
  const progress = calculateProgress(current, goal);
  const gap = goal > 0 ? Math.max(goal - current, 0) : null;
  const stageIndex = CRM_STAGES.findIndex((item) => item.slug === stage.slug);
  const previousStage = stageIndex > 0 ? CRM_STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < CRM_STAGES.length - 1 ? CRM_STAGES[stageIndex + 1] : null;
  const previousValue = previousStage
    ? dashboard.metrics[view][previousStage.key][periodConfig.currentField]
    : null;
  const conversion = previousValue === null ? null : calculateConversion(current, previousValue);
  const attainment = stageAttainment(progress);
  const comparisons = buildStageComparisons(metric);

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium tracking-wide text-cyan-300 uppercase">
                Etapa {String(stageIndex + 1).padStart(2, "0")} do funil
              </p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{stage.label}</h1>
              <p className="mt-3 max-w-2xl text-slate-300">{stage.description}</p>
            </div>
            <div className="w-full rounded-2xl bg-white/10 px-5 py-4 text-sm ring-1 ring-white/15 sm:w-auto sm:text-right">
              <small className="block text-slate-400">Atualizado em</small>
              <strong>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: dashboard.timezone,
                }).format(new Date(dashboard.generatedAt))}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">{dashboard.source}</span>
            </div>
          </div>

          <nav
            aria-label="Etapas do funil"
            className="mt-8 grid gap-2 border-t border-white/10 pt-6 sm:grid-cols-5"
          >
            {CRM_STAGES.map((item) => (
              <Link
                key={item.slug}
                href={stageHref(item.slug, view, period)}
                aria-current={item.slug === stage.slug ? "page" : undefined}
                className={`rounded-xl px-3 py-2 text-center text-sm transition ${
                  item.slug === stage.slug
                    ? "bg-cyan-300 font-medium text-slate-950"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <nav aria-label="Visão da etapa" className="grid gap-2 sm:flex sm:flex-wrap">
            {(Object.keys(DASHBOARD_VIEWS) as DashboardViewKey[]).map((viewKey) => (
              <Link
                key={viewKey}
                href={stageHref(stage.slug, viewKey, period)}
                aria-current={view === viewKey ? "page" : undefined}
                className={`rounded-xl px-4 py-3 text-sm ring-1 transition ${
                  view === viewKey
                    ? "bg-blue-700 text-white ring-blue-700"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {DASHBOARD_VIEWS[viewKey].label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Período da etapa" className="flex flex-wrap gap-2">
            {(Object.keys(DASHBOARD_PERIODS) as DashboardPeriodKey[]).map((periodKey) => (
              <Link
                key={periodKey}
                href={stageHref(stage.slug, view, periodKey)}
                aria-current={period === periodKey ? "page" : undefined}
                className={`rounded-lg px-4 py-3 text-sm ring-1 transition ${
                  period === periodKey
                    ? "bg-slate-950 text-white ring-slate-950"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {DASHBOARD_PERIODS[periodKey].label}
              </Link>
            ))}
          </nav>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-cyan-700">
                  {DASHBOARD_VIEWS[view].label} · {periodConfig.label}
                </p>
                <strong className="mt-2 block text-5xl font-semibold text-slate-950">
                  {numberFormatter.format(current)}
                </strong>
                <p className="mt-2 text-sm text-slate-500">
                  {goal > 0
                    ? `Meta de ${numberFormatter.format(goal)}`
                    : "Acompanhamento sem meta definida"}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${STATUS_CLASSES[attainment.tone]}`}
              >
                {attainment.label}
              </span>
            </div>
            <progress
              className="mt-8 h-3 w-full accent-cyan-600"
              max={100}
              value={progress === null ? 0 : Math.min(Math.max(progress * 100, 0), 100)}
              aria-label={`Progresso de ${stage.label}`}
            />
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <small className="text-slate-500">Atingimento</small>
                <strong className="mt-1 block text-xl text-slate-950">
                  {progress === null ? "—" : percentFormatter.format(progress)}
                </strong>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <small className="text-slate-500">Gap</small>
                <strong className="mt-1 block text-xl text-slate-950">
                  {gap === null ? "—" : numberFormatter.format(gap)}
                </strong>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <small className="text-slate-500">Conversão da etapa</small>
                <strong className="mt-1 block text-xl text-slate-950">
                  {conversion === null ? "Base" : percentFormatter.format(conversion)}
                </strong>
              </div>
            </div>
          </article>

          <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-sm font-medium text-cyan-300">Plano de ação</p>
            <h2 className="mt-2 text-2xl font-semibold">{attainment.label}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">{stage.action}</p>
            <div className="mt-8 grid gap-2 border-t border-white/10 pt-5 text-sm">
              {previousStage ? (
                <Link
                  href={stageHref(previousStage.slug, view, period)}
                  className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
                >
                  ← {previousStage.label}
                </Link>
              ) : (
                <span className="text-slate-500">Início do funil</span>
              )}
              {nextStage ? (
                <Link
                  href={stageHref(nextStage.slug, view, period)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-right hover:bg-white/20"
                >
                  {nextStage.label} →
                </Link>
              ) : (
                <span className="text-right text-slate-500">Fim do funil</span>
              )}
            </div>
          </aside>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-6 sm:p-8">
            <p className="text-sm font-medium text-cyan-700">Evolução</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Comparativo entre períodos
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Janela</th>
                  <th className="px-5 py-3">Anterior</th>
                  <th className="px-5 py-3 text-right">Valor anterior</th>
                  <th className="px-5 py-3">Atual</th>
                  <th className="px-5 py-3 text-right">Valor atual</th>
                  <th className="px-5 py-3 text-right">Variação</th>
                  <th className="px-5 py-3 text-right">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisons.map((row) => {
                  const variation =
                    row.previous !== null && row.previous > 0
                      ? (row.current - row.previous) / row.previous
                      : null;
                  return (
                    <tr key={row.label}>
                      <th className="px-5 py-4 font-medium text-slate-950">{row.label}</th>
                      <td className="px-5 py-4 text-slate-500">{row.previousLabel}</td>
                      <td className="px-5 py-4 text-right">
                        {row.previous === null ? "—" : numberFormatter.format(row.previous)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{row.currentLabel}</td>
                      <td className="px-5 py-4 text-right font-medium text-slate-950">
                        {numberFormatter.format(row.current)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {variation === null ? "—" : percentFormatter.format(variation)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {row.goal === null ? "—" : numberFormatter.format(row.goal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
