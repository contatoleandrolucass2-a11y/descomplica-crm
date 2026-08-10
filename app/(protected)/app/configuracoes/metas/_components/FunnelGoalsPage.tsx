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
  options: { maximum?: number; suffix?: string; accent?: "cyan" | "lime" } = {},
) {
  const focusClasses =
    options.accent === "lime"
      ? "focus-within:border-lime-400 focus-within:ring-lime-200"
      : "focus-within:border-cyan-400 focus-within:ring-cyan-200";

  return (
    <label
      key={name}
      className={`group grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 focus-within:ring-2 ${focusClasses}`}
    >
      <span className="text-xs leading-5 font-semibold text-slate-700">{label}</span>
      <span className="flex items-center gap-2">
        <input
          required
          name={name}
          type="number"
          min="0"
          max={options.maximum ?? 100000}
          step="1"
          defaultValue={value}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-950 tabular-nums shadow-sm"
        />
        {options.suffix ? (
          <small className="shrink-0 text-xs font-medium text-slate-500">{options.suffix}</small>
        ) : null}
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
  const funnelWidthClasses =
    visibleStages.length > 4
      ? ["w-full", "w-[94%]", "w-[88%]", "w-[82%]", "w-[76%]", "w-[70%]"]
      : ["w-full", "w-[90%]", "w-[80%]", "w-[70%]"];

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-xl">
          <div
            aria-hidden="true"
            className="absolute -top-28 -right-20 size-64 rounded-full border-[2rem] border-cyan-300/10"
          />
          <div
            aria-hidden="true"
            className="absolute -right-8 -bottom-24 size-44 rounded-full border-[1.35rem] border-lime-300/10"
          />

          <div className="relative grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold tracking-[0.16em] text-cyan-300 uppercase">
                  Planejamento comercial
                </p>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold tracking-wide uppercase ${
                    result.status === "ready"
                      ? "border-lime-300/30 bg-lime-300/10 text-lime-200"
                      : "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      result.status === "ready" ? "bg-lime-300" : "bg-cyan-300"
                    }`}
                  />
                  {result.status === "ready" ? "Metas carregadas" : "Primeira configuração"}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Metas do funil
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Configure o volume mensal e os parâmetros operacionais de {monthLabel}.
              </p>
            </div>

            <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              <div className="border-r border-white/10 px-4 py-3.5">
                <dt className="text-[0.68rem] font-semibold tracking-widest text-cyan-300 uppercase">
                  Competência
                </dt>
                <dd className="mt-1 text-sm font-semibold capitalize">{monthLabel}</dd>
              </div>
              <div className="px-4 py-3.5">
                <dt className="text-[0.68rem] font-semibold tracking-widest text-cyan-300 uppercase">
                  Atualização
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {result.status === "ready"
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(result.goals.updatedAt))
                    : "Ainda não salvo"}
                </dd>
              </div>
            </dl>
          </div>

          <nav
            aria-label="Canal das metas"
            className="relative flex flex-col gap-2 border-t border-white/10 px-5 py-3 sm:flex-row sm:px-7"
          >
            {(
              Object.entries(GOAL_PROFILES) as Array<
                [GoalProfileKey, (typeof GOAL_PROFILES)[GoalProfileKey]]
              >
            ).map(([key, item]) => (
              <Link
                key={key}
                href={item.href}
                aria-current={profile === key ? "page" : undefined}
                className={`group flex min-h-12 flex-1 items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-sm transition sm:max-w-sm ${
                  profile === key
                    ? "border-cyan-200 bg-cyan-300 text-[#082137] shadow-sm"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span>
                  <strong className="block leading-5">{item.label}</strong>
                  <span className="block text-xs">{item.description}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${
                    profile === key ? "bg-lime-400" : "bg-white/25 group-hover:bg-cyan-300"
                  }`}
                />
              </Link>
            ))}
          </nav>
        </header>

        {notification ? (
          <div
            role={notification === "saved" ? "status" : "alert"}
            className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${
              notification === "saved"
                ? "border-lime-300 bg-lime-100 text-[#082137]"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-1 size-2 shrink-0 rounded-full ${
                notification === "saved" ? "bg-lime-600" : "bg-red-500"
              }`}
            />
            <span>
              {notification === "saved"
                ? "Metas salvas e registradas na auditoria."
                : notification === "validation"
                  ? "Revise os campos: existem valores ausentes ou fora dos limites permitidos."
                  : "Não foi possível salvar as metas. Tente novamente."}
            </span>
          </div>
        ) : null}

        {result.status === "empty" ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50 px-4 py-3.5 text-sm text-cyan-900 shadow-sm">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-cyan-200 text-xs font-bold text-[#082137]"
            >
              i
            </span>
            <p>
              Este canal ainda não tem metas configuradas para {monthLabel}. Os campos abaixo
              começam em zero; nenhum dado demonstrativo foi aplicado.
            </p>
          </div>
        ) : null}

        <form action={saveAction} className="mt-5 grid gap-5">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(15rem,0.82fr)_minmax(25rem,1.5fr)_minmax(15rem,0.86fr)]">
            <section
              aria-labelledby="funnel-result-title"
              className="overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-xl xl:col-start-2 xl:row-start-1"
            >
              <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">
                      01 · Resultado mensal
                    </p>
                    <h2 id="funnel-result-title" className="mt-1 text-xl font-semibold">
                      {result.status === "ready"
                        ? "Último funil salvo"
                        : "Prévia da primeira configuração"}
                    </h2>
                    <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-300">
                      A RPC recalcula todas as etapas ao salvar vendas e taxas informadas.
                    </p>
                  </div>
                  <label className="grid shrink-0 gap-1.5 rounded-2xl border border-cyan-200/30 bg-cyan-300/10 p-3">
                    <span className="text-xs font-semibold text-cyan-100">
                      Meta mensal de vendas
                    </span>
                    <input
                      required
                      name="sales"
                      type="number"
                      min="0"
                      max="10000000"
                      step="1"
                      defaultValue={values.sales}
                      className="min-h-12 w-full rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xl font-semibold text-slate-950 tabular-nums shadow-sm sm:w-44"
                    />
                  </label>
                </div>
              </div>

              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-widest text-lime-300 uppercase">
                    Sequência do funil
                  </p>
                  <p className="text-[0.68rem] text-slate-400">
                    Larguras ilustrativas; volumes sem proporção visual.
                  </p>
                </div>

                <ol
                  className="mt-4 grid gap-2.5"
                  aria-label={
                    result.status === "ready"
                      ? `Último funil salvo de ${monthLabel}`
                      : `Prévia vazia da primeira configuração de ${monthLabel}`
                  }
                >
                  {visibleStages.map((stage, index) => {
                    const isFirstStage = index === 0;
                    const isSalesStage = stage.key === "sales";

                    return (
                      <li
                        key={stage.key}
                        className={`relative mx-auto ${funnelWidthClasses[index] ?? "w-full"} after:absolute after:-bottom-2.5 after:left-1/2 after:h-2.5 after:w-px after:bg-cyan-300/45 after:content-[''] last:after:hidden`}
                      >
                        <div
                          className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 [clip-path:polygon(2%_0,98%_0,94%_100%,6%_100%)] sm:px-7 ${
                            isSalesStage
                              ? "bg-lime-300 text-[#082137]"
                              : isFirstStage
                                ? "bg-cyan-300 text-[#082137]"
                                : "border border-white/10 bg-white/10 text-white"
                          }`}
                        >
                          <span className="min-w-0 text-xs font-semibold sm:text-sm">
                            {stage.label}
                          </span>
                          <strong className="text-base font-semibold tabular-nums sm:text-lg">
                            {integerFormatter.format(values[stage.key])}
                          </strong>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>

            <section
              aria-labelledby="conversion-title"
              className="rounded-[1.75rem] border border-[var(--analytics-line)] bg-[var(--analytics-surface)] p-5 shadow-[var(--analytics-shadow)] sm:p-6 xl:col-start-1 xl:row-start-1"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan-100 text-xs font-bold text-[#082137]"
                >
                  02
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-cyan-700 uppercase">
                    Conversões
                  </p>
                  <h2 id="conversion-title" className="mt-1 text-lg font-semibold text-slate-950">
                    Volume da etapa anterior
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Exemplo: 250% representa 2,5 ocorrências da etapa anterior para cada avanço.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
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

            <section
              aria-labelledby="capacity-title"
              className="rounded-[1.75rem] border border-lime-200 bg-[var(--analytics-surface)] p-5 shadow-[var(--analytics-shadow)] sm:p-6 xl:col-start-3 xl:row-start-1"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-lime-200 text-xs font-bold text-[#082137]"
                >
                  03
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-emerald-800 uppercase">
                    Capacidade
                  </p>
                  <h2 id="capacity-title" className="mt-1 text-lg font-semibold text-slate-950">
                    {isPartnerships ? "Imobiliárias" : "Corretores"} por tempo de operação
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {numberInput("brokerMinimumMonth1", "1º mês", values.brokerMinimumMonth1, {
                  accent: "lime",
                })}
                {numberInput("brokerMinimumMonth2", "2º mês", values.brokerMinimumMonth2, {
                  accent: "lime",
                })}
                {numberInput("brokerMinimumMonth3", "3º mês", values.brokerMinimumMonth3, {
                  accent: "lime",
                })}
                {numberInput(
                  "brokerMinimumMonth4Plus",
                  "4º mês ou mais",
                  values.brokerMinimumMonth4Plus,
                  { accent: "lime" },
                )}
              </div>
            </section>
          </div>

          <section className="grid gap-5 lg:grid-cols-2" aria-label="Parâmetros operacionais">
            <article className="rounded-[1.75rem] border border-[var(--analytics-line)] bg-[var(--analytics-surface)] p-5 shadow-[var(--analytics-shadow)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-cyan-700 uppercase">
                    04 · Ritmo semanal
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    Produção por unidade
                  </h2>
                </div>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                  Frequência semanal
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

            <article className="rounded-[1.75rem] border border-white/10 bg-slate-950 p-5 text-white shadow-xl sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-lime-300 uppercase">
                    05 · Time produtivo
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">Cobertura mínima da equipe</h2>
                </div>
                <span className="rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-xs font-semibold text-lime-200">
                  Participação mínima
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {isPartnerships ? (
                  <input type="hidden" name="productiveTeamAppointments" value="0" />
                ) : (
                  numberInput(
                    "productiveTeamAppointments",
                    "Agendamentos",
                    values.productiveTeamAppointments,
                    { maximum: 100, suffix: "%", accent: "lime" },
                  )
                )}
                {numberInput("productiveTeamVisits", "Visitas", values.productiveTeamVisits, {
                  maximum: 100,
                  suffix: "%",
                  accent: "lime",
                })}
                {numberInput("productiveTeamFolders", "Pastas", values.productiveTeamFolders, {
                  maximum: 100,
                  suffix: "%",
                  accent: "lime",
                })}
                {numberInput("productiveTeamSales", "Vendas", values.productiveTeamSales, {
                  maximum: 100,
                  suffix: "%",
                  accent: "lime",
                })}
              </div>
            </article>
          </section>

          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] p-3 shadow-xl sm:flex-row sm:items-center sm:justify-between sm:pl-5">
            <p className="text-xs leading-5 text-slate-600 sm:max-w-xl">
              Ao salvar, a meta e os parâmetros informados seguem para o cálculo oficial da RPC.
            </p>
            <button
              type="submit"
              className="min-h-12 rounded-xl bg-lime-300 px-6 py-3 text-sm font-semibold text-[#082137] shadow-lg shadow-lime-900/10 hover:bg-lime-200 focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 focus:outline-none"
            >
              Salvar metas de {monthLabel}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
