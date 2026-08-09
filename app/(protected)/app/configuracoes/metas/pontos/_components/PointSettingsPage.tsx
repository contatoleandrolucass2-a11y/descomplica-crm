import Link from "next/link";

import { GOAL_PROFILES } from "@/lib/crm/goals/catalog";
import { POINT_METRICS } from "@/lib/crm/points/catalog";
import { loadPointSettings } from "@/lib/crm/points/data";

import { savePointSettingsAction } from "../actions";

export async function PointSettingsPage({
  notification,
}: {
  notification?: "saved" | "validation" | "save";
}) {
  const result = await loadPointSettings();
  const weights = result.status === "ready" ? result.weights : null;
  const targets = result.status === "ready" ? result.targets : null;
  const updatedAt =
    result.status === "ready"
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(result.updatedAt))
      : null;

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-[var(--analytics-navy)] px-6 py-7 text-white shadow-[var(--analytics-shadow)] sm:px-8 sm:py-9 lg:px-10">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-20 size-72 rounded-full bg-cyan-300/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-36 left-1/3 size-80 rounded-full bg-lime-300/10 blur-3xl"
          />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--analytics-cyan)] uppercase">
                  Regras do ranking
                </p>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/15">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${
                      result.status === "ready" ? "bg-[var(--analytics-lime)]" : "bg-amber-300"
                    }`}
                  />
                  {result.status === "ready"
                    ? "Configuração ativa"
                    : "Primeiro salvamento pendente"}
                </span>
              </div>

              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Meta por pontos
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Defina quanto vale cada atividade e o objetivo usado nas comparações comerciais.
              </p>

              {updatedAt ? (
                <p className="mt-5 flex items-center gap-2 text-sm text-slate-300">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-[var(--analytics-cyan)]"
                  />
                  Última atualização: <strong className="text-white">{updatedAt}</strong>
                </p>
              ) : null}
            </div>

            <aside className="rounded-3xl border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-slate-950/20 backdrop-blur-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[var(--analytics-lime)] uppercase">
                    Prévia visual
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Estrutura do pódio</h2>
                </div>
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--analytics-lime)] text-[var(--analytics-navy)]"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor">
                    <path
                      d="M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5v1a4 4 0 0 0 4 4m7-5h3v1a4 4 0 0 1-4 4m-3 1v5m-4 3h8"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>

              <div
                role="img"
                aria-label="Composição estrutural de um pódio, sem nomes de participantes ou pontuações."
                className="mt-7 flex h-32 items-end justify-center gap-2 sm:gap-3"
              >
                <div className="flex w-1/3 flex-col items-center">
                  <span className="mb-2 size-8 rounded-full border border-cyan-200/30 bg-cyan-200/15" />
                  <span className="h-14 w-full rounded-t-xl border border-b-0 border-cyan-200/20 bg-cyan-200/10" />
                </div>
                <div className="flex w-1/3 flex-col items-center">
                  <span className="mb-2 size-10 rounded-full border border-lime-200/40 bg-lime-200/20 ring-4 ring-lime-200/5" />
                  <span className="h-24 w-full rounded-t-xl border border-b-0 border-lime-200/30 bg-lime-200/15" />
                </div>
                <div className="flex w-1/3 flex-col items-center">
                  <span className="mb-2 size-8 rounded-full border border-cyan-200/30 bg-cyan-200/15" />
                  <span className="h-10 w-full rounded-t-xl border border-b-0 border-cyan-200/20 bg-cyan-200/10" />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Sem nomes ou resultados demonstrativos.
              </p>
            </aside>
          </div>

          <nav
            aria-label="Tipo de meta"
            className="relative mt-8 grid gap-2 border-t border-white/10 pt-6 sm:grid-cols-3"
          >
            {Object.values(GOAL_PROFILES).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl bg-white/[0.07] px-4 py-3 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/15 hover:ring-white/20"
              >
                <span className="flex items-center justify-between gap-3">
                  <strong>{item.label}</strong>
                  <span
                    aria-hidden="true"
                    className="text-cyan-300 transition group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
                <span className="mt-1 block text-xs text-slate-400">{item.description}</span>
              </Link>
            ))}
            <Link
              href="/app/configuracoes/metas/pontos"
              aria-current="page"
              className="rounded-2xl bg-[var(--analytics-cyan)] px-4 py-3 text-sm text-[var(--analytics-navy)] shadow-lg ring-1 shadow-cyan-950/20 ring-cyan-100/50"
            >
              <span className="flex items-center justify-between gap-3">
                <strong>Meta por pontos</strong>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-[var(--analytics-lime)]"
                />
              </span>
              <span className="mt-1 block text-xs opacity-75">Pontuação comercial</span>
            </Link>
          </nav>
        </section>

        <section
          aria-label="Resumo da configuração"
          className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <article className="relative overflow-hidden rounded-2xl bg-[var(--analytics-surface)] p-5 shadow-sm ring-1 ring-[var(--analytics-line)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-[var(--analytics-cyan)]"
            />
            <p className="text-xs font-semibold tracking-wide text-[var(--analytics-muted)] uppercase">
              Atividades configuráveis
            </p>
            <strong className="mt-2 block text-3xl text-[var(--analytics-ink)]">
              {POINT_METRICS.length}
            </strong>
          </article>
          <article className="relative overflow-hidden rounded-2xl bg-[var(--analytics-surface)] p-5 shadow-sm ring-1 ring-[var(--analytics-line)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-[var(--analytics-lime)]"
            />
            <p className="text-xs font-semibold tracking-wide text-[var(--analytics-muted)] uppercase">
              Campos por atividade
            </p>
            <strong className="mt-2 block text-xl text-[var(--analytics-ink)]">
              Peso + objetivo
            </strong>
          </article>
          <article className="relative overflow-hidden rounded-2xl bg-[var(--analytics-surface)] p-5 shadow-sm ring-1 ring-[var(--analytics-line)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-[var(--analytics-cyan)]"
            />
            <p className="text-xs font-semibold tracking-wide text-[var(--analytics-muted)] uppercase">
              Estado da configuração
            </p>
            <strong className="mt-2 block text-xl text-[var(--analytics-ink)]">
              {result.status === "ready" ? "Persistida" : "Ainda não persistida"}
            </strong>
          </article>
          <article className="relative overflow-hidden rounded-2xl bg-[var(--analytics-surface)] p-5 shadow-sm ring-1 ring-[var(--analytics-line)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-[var(--analytics-lime)]"
            />
            <p className="text-xs font-semibold tracking-wide text-[var(--analytics-muted)] uppercase">
              Faixa aceita por campo
            </p>
            <strong className="mt-2 block text-xl text-[var(--analytics-ink)]">0 a 100.000</strong>
          </article>
        </section>

        {notification ? (
          <div
            role={notification === "saved" ? "status" : "alert"}
            className={`mt-5 flex items-start gap-3 rounded-2xl px-5 py-4 text-sm shadow-sm ring-1 ${
              notification === "saved"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-red-50 text-red-800 ring-red-200"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                notification === "saved"
                  ? "bg-emerald-200 text-emerald-900"
                  : "bg-red-200 text-red-900"
              }`}
            >
              {notification === "saved" ? "✓" : "!"}
            </span>
            <p>
              {notification === "saved"
                ? "Configuração salva e registrada na auditoria."
                : notification === "validation"
                  ? "Revise os valores: use somente inteiros entre 0 e 100.000."
                  : "Não foi possível salvar a configuração. Tente novamente."}
            </p>
          </div>
        ) : null}

        {result.status === "empty" ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-amber-200 font-bold text-amber-950"
            >
              i
            </span>
            <p>
              Ainda não existe configuração persistida. Os campos permanecem vazios para evitar
              sugerir uma regra comercial e somente passam a valer após o primeiro salvamento.
            </p>
          </div>
        ) : null}

        <form action={savePointSettingsAction} className="mt-6 grid gap-5">
          <section className="overflow-hidden rounded-[2rem] bg-[var(--analytics-surface)] shadow-[var(--analytics-shadow)] ring-1 ring-[var(--analytics-line)]">
            <div className="grid gap-5 border-b border-[var(--analytics-line)] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[var(--analytics-cyan-strong)] uppercase">
                  Matriz de pontuação
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--analytics-ink)] sm:text-3xl">
                  Pontos por atividade
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--analytics-muted)]">
                  Ajuste o valor de cada atividade e o objetivo usado como referência comercial.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 ring-1 ring-cyan-200">
                <span aria-hidden="true" className="size-2 rounded-full bg-cyan-500" />
                {POINT_METRICS.length} atividades
              </span>
            </div>

            <div className="grid gap-3 border-b border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] px-6 py-5 sm:grid-cols-2 sm:px-8">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--analytics-cyan)] font-bold text-[var(--analytics-navy)]"
                >
                  P
                </span>
                <p className="text-sm leading-6 text-[var(--analytics-muted)]">
                  <strong className="block text-[var(--analytics-ink)]">Peso</strong>
                  Quanto cada ocorrência vale na pontuação.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--analytics-lime)] font-bold text-[var(--analytics-navy)]"
                >
                  O
                </span>
                <p className="text-sm leading-6 text-[var(--analytics-muted)]">
                  <strong className="block text-[var(--analytics-ink)]">Objetivo</strong>
                  Valor de referência para as comparações comerciais.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_10rem_10rem] items-center gap-4 rounded-t-2xl bg-[var(--analytics-navy)] px-5 py-3 text-xs font-semibold tracking-[0.14em] text-slate-300 uppercase md:grid">
                <span aria-hidden="true">#</span>
                <span>Atividade</span>
                <span className="text-center">Peso</span>
                <span className="text-center">Objetivo</span>
              </div>

              <div className="grid gap-3 md:gap-0 md:divide-y md:divide-[var(--analytics-line)] md:overflow-hidden md:rounded-b-2xl md:border md:border-t-0 md:border-[var(--analytics-line)]">
                {POINT_METRICS.map((metric, index) => {
                  const isRoulette = metric.key.startsWith("roulette");

                  return (
                    <fieldset
                      key={metric.key}
                      className="grid gap-4 rounded-2xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] p-4 shadow-sm md:grid-cols-[3.5rem_minmax(0,1fr)_10rem_10rem] md:items-center md:gap-4 md:rounded-none md:border-0 md:px-5 md:py-4 md:shadow-none md:hover:bg-[var(--analytics-surface-muted)]"
                    >
                      <legend className="sr-only">{metric.label}</legend>

                      <div className="flex items-center gap-3 md:contents">
                        <span
                          aria-hidden="true"
                          className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            isRoulette ? "bg-cyan-100 text-cyan-900" : "bg-lime-100 text-lime-900"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <strong className="text-sm leading-5 text-[var(--analytics-ink)] sm:text-base">
                          {metric.label}
                        </strong>
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:contents">
                        <label className="grid gap-1.5 text-xs font-medium text-[var(--analytics-muted)] md:text-center">
                          <span className="md:sr-only">Peso</span>
                          <input
                            required
                            aria-label={`Peso de ${metric.label}`}
                            name={`weight.${metric.formKey}`}
                            type="number"
                            min="0"
                            max="100000"
                            step="1"
                            defaultValue={weights?.[metric.key]}
                            className="min-h-11 w-full rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-center text-base font-semibold text-[var(--analytics-ink)] shadow-inner focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100/70 focus:outline-none"
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-medium text-[var(--analytics-muted)] md:text-center">
                          <span className="md:sr-only">Objetivo</span>
                          <input
                            required
                            aria-label={`Objetivo de ${metric.label}`}
                            name={`target.${metric.formKey}`}
                            type="number"
                            min="0"
                            max="100000"
                            step="1"
                            defaultValue={targets?.[metric.key]}
                            className="min-h-11 w-full rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-center text-base font-semibold text-[var(--analytics-ink)] shadow-inner focus:border-lime-500 focus:ring-4 focus:ring-lime-100/70 focus:outline-none"
                          />
                        </label>
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-[var(--analytics-navy)] p-4 text-white shadow-2xl shadow-slate-950/20 sm:flex sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 size-2.5 shrink-0 rounded-full bg-[var(--analytics-lime)]"
              />
              <p className="text-sm leading-6 text-slate-300">
                O ranking usará estes pesos somente após a confirmação abaixo.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--analytics-lime)] px-6 py-3 font-semibold text-[var(--analytics-navy)] shadow-lg shadow-lime-950/20 transition hover:brightness-105 focus:ring-2 focus:ring-lime-200 focus:ring-offset-2 focus:ring-offset-slate-950 focus:outline-none sm:w-auto"
            >
              Salvar configuração
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
