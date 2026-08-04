import Link from "next/link";

import {
  GOAL_PROFILES,
  GOAL_RATE_FIELDS,
  GOAL_STAGES,
  getVisibleStageOffset,
  type GoalProfileKey,
} from "@/lib/crm/goals/catalog";
import { loadFunnelGoals, type FunnelGoals } from "@/lib/crm/goals/data";

import { saveFunnelGoalsAction } from "../actions";

const EMPTY_GOALS = {
  opportunities: 0,
  appointments: 0,
  visits: 0,
  folders: 0,
  approvedFolders: 0,
  sales: 0,
  opportunitiesRate: 0,
  appointmentsRate: 0,
  visitsRate: 0,
  foldersRate: 0,
  approvedFoldersRate: 0,
  brokerMinimumMonth1: 0,
  brokerMinimumMonth2: 0,
  brokerMinimumMonth3: 0,
  brokerMinimumMonth4Plus: 0,
  brokerWeeklyAppointments: 0,
  brokerWeeklyVisits: 0,
  brokerWeeklyFolders: 0,
  productiveTeamAppointments: 0,
  productiveTeamVisits: 0,
  productiveTeamFolders: 0,
  productiveTeamSales: 0,
} satisfies Omit<FunnelGoals, "profileKey" | "effectiveMonth" | "updatedAt">;

const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function numberInput(
  name: keyof typeof EMPTY_GOALS,
  label: string,
  value: number,
  options: { maximum?: number; suffix?: string } = {},
) {
  return (
    <label key={name} className="grid gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="flex items-center gap-2">
        <input
          required
          name={name}
          type="number"
          min="0"
          max={options.maximum ?? 100000}
          step="1"
          defaultValue={value}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
        />
        {options.suffix ? <small className="text-slate-500">{options.suffix}</small> : null}
      </span>
    </label>
  );
}

export async function FunnelGoalsPage({
  profile,
  notification,
}: {
  profile: GoalProfileKey;
  notification?: "saved" | "validation" | "save";
}) {
  const result = await loadFunnelGoals(profile);
  const values = result.status === "ready" ? result.goals : EMPTY_GOALS;
  const effectiveMonth =
    result.status === "ready" ? result.goals.effectiveMonth : result.effectiveMonth;
  const stageOffset = getVisibleStageOffset(profile);
  const visibleStages = GOAL_STAGES.slice(stageOffset);
  const visibleRates = GOAL_RATE_FIELDS.slice(stageOffset);
  const isPartnerships = profile === "partnerships";
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${effectiveMonth}T12:00:00Z`));
  const saveAction = saveFunnelGoalsAction.bind(null, profile);

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <p className="text-sm font-medium tracking-wide text-cyan-300 uppercase">
            Planejamento comercial
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">Metas do funil</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Configure o volume mensal e os parâmetros operacionais de {monthLabel}.
              </p>
            </div>
            {result.status === "ready" ? (
              <p className="text-sm text-slate-300">
                Atualizado em{" "}
                <strong className="text-white">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(result.goals.updatedAt))}
                </strong>
              </p>
            ) : null}
          </div>

          <nav aria-label="Canal das metas" className="mt-8 grid gap-2 sm:flex sm:flex-wrap">
            {(
              Object.entries(GOAL_PROFILES) as Array<
                [GoalProfileKey, (typeof GOAL_PROFILES)[GoalProfileKey]]
              >
            ).map(([key, item]) => (
              <Link
                key={key}
                href={item.href}
                aria-current={profile === key ? "page" : undefined}
                className={`rounded-xl px-4 py-3 text-sm transition ${
                  profile === key
                    ? "bg-cyan-300 text-slate-950"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <strong className="block">{item.label}</strong>
                <span className="text-xs opacity-75">{item.description}</span>
              </Link>
            ))}
          </nav>
        </section>

        {notification ? (
          <div
            role={notification === "saved" ? "status" : "alert"}
            className={`mt-5 rounded-2xl px-5 py-4 text-sm ring-1 ${
              notification === "saved"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-red-50 text-red-800 ring-red-200"
            }`}
          >
            {notification === "saved"
              ? "Metas salvas e registradas na auditoria."
              : notification === "validation"
                ? "Revise os campos: existem valores ausentes ou fora dos limites permitidos."
                : "Não foi possível salvar as metas. Tente novamente."}
          </div>
        ) : null}

        {result.status === "empty" ? (
          <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            Este canal ainda não tem metas configuradas para {monthLabel}. Os campos abaixo começam
            em zero; nenhum dado demonstrativo foi aplicado.
          </div>
        ) : null}

        <form action={saveAction} className="mt-6 grid gap-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-cyan-700">01 · Resultado mensal</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Meta e funil calculado
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  A RPC recalcula todas as etapas a partir das vendas e das taxas informadas.
                </p>
              </div>
              <label className="grid gap-2 rounded-2xl bg-cyan-50 p-4 ring-1 ring-cyan-200">
                <span className="text-sm font-medium text-cyan-900">Meta mensal de vendas</span>
                <input
                  required
                  name="sales"
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  defaultValue={values.sales}
                  className="w-44 rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xl font-semibold text-slate-950"
                />
              </label>
            </div>

            <div
              className={`mt-7 grid gap-3 sm:grid-cols-2 ${visibleStages.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}
            >
              {visibleStages.map((stage) => (
                <article key={stage.key} className="rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-xs text-slate-400">{stage.label}</p>
                  <strong className="mt-2 block text-2xl">
                    {integerFormatter.format(values[stage.key])}
                  </strong>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm font-medium text-cyan-700">02 · Conversões</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Volume da etapa anterior</h2>
            <p className="mt-2 text-sm text-slate-600">
              Exemplo: 250% representa 2,5 ocorrências da etapa anterior para cada avanço.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {visibleRates.map((rate) =>
                numberInput(rate.key, rate.label, values[rate.key], {
                  maximum: 10000,
                  suffix: "%",
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

          <section className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-medium text-cyan-700">03 · Capacidade</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {isPartnerships ? "Imobiliárias" : "Corretores"} por tempo de operação
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {numberInput("brokerMinimumMonth1", "1º mês", values.brokerMinimumMonth1)}
                {numberInput("brokerMinimumMonth2", "2º mês", values.brokerMinimumMonth2)}
                {numberInput("brokerMinimumMonth3", "3º mês", values.brokerMinimumMonth3)}
                {numberInput(
                  "brokerMinimumMonth4Plus",
                  "4º mês ou mais",
                  values.brokerMinimumMonth4Plus,
                )}
              </div>
            </article>

            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-medium text-cyan-700">04 · Ritmo semanal</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Produção por unidade</h2>
              <div className="mt-5 grid gap-3">
                {isPartnerships ? (
                  <input type="hidden" name="brokerWeeklyAppointments" value="0" />
                ) : (
                  numberInput(
                    "brokerWeeklyAppointments",
                    "Agendamentos",
                    values.brokerWeeklyAppointments,
                    { suffix: "/ semana" },
                  )
                )}
                {numberInput("brokerWeeklyVisits", "Visitas", values.brokerWeeklyVisits, {
                  suffix: "/ semana",
                })}
                {numberInput("brokerWeeklyFolders", "Pastas", values.brokerWeeklyFolders, {
                  suffix: "/ semana",
                })}
              </div>
            </article>

            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-medium text-cyan-700">05 · Time produtivo</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Cobertura mínima da equipe
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {isPartnerships ? (
                  <input type="hidden" name="productiveTeamAppointments" value="0" />
                ) : (
                  numberInput(
                    "productiveTeamAppointments",
                    "Agendamentos",
                    values.productiveTeamAppointments,
                    { maximum: 100, suffix: "%" },
                  )
                )}
                {numberInput("productiveTeamVisits", "Visitas", values.productiveTeamVisits, {
                  maximum: 100,
                  suffix: "%",
                })}
                {numberInput("productiveTeamFolders", "Pastas", values.productiveTeamFolders, {
                  maximum: 100,
                  suffix: "%",
                })}
                {numberInput("productiveTeamSales", "Vendas", values.productiveTeamSales, {
                  maximum: 100,
                  suffix: "%",
                })}
              </div>
            </article>
          </section>

          <div className="sticky bottom-4 flex justify-end">
            <button className="rounded-xl bg-blue-700 px-6 py-3 font-medium text-white shadow-lg hover:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
              Salvar metas de {monthLabel}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
