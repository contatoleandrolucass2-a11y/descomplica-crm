import Link from "next/link";

import { GOAL_PROFILES } from "@/lib/crm/goals/catalog";
import {
  DEFAULT_POINT_WEIGHTS,
  EMPTY_POINT_TARGETS,
  POINT_METRICS,
} from "@/lib/crm/points/catalog";
import { loadPointSettings } from "@/lib/crm/points/data";

import { savePointSettingsAction } from "../actions";

export async function PointSettingsPage({
  notification,
}: {
  notification?: "saved" | "validation" | "save";
}) {
  const result = await loadPointSettings();
  const weights = result.status === "ready" ? result.weights : DEFAULT_POINT_WEIGHTS;
  const targets = result.status === "ready" ? result.targets : EMPTY_POINT_TARGETS;

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <p className="text-sm font-medium tracking-wide text-violet-300 uppercase">
            Regras do ranking
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">Meta por pontos</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Defina quanto vale cada atividade e o objetivo usado nas comparações comerciais.
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
                  }).format(new Date(result.updatedAt))}
                </strong>
              </p>
            ) : null}
          </div>

          <nav aria-label="Tipo de meta" className="mt-8 grid gap-2 sm:flex sm:flex-wrap">
            {Object.values(GOAL_PROFILES).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/20"
              >
                <strong className="block">{item.label}</strong>
                <span className="text-xs text-slate-300">{item.description}</span>
              </Link>
            ))}
            <Link
              href="/app/configuracoes/metas/pontos"
              aria-current="page"
              className="rounded-xl bg-violet-300 px-4 py-3 text-sm text-slate-950"
            >
              <strong className="block">Meta por pontos</strong>
              <span className="text-xs opacity-75">Pontuação comercial</span>
            </Link>
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
              ? "Configuração salva e registrada na auditoria."
              : notification === "validation"
                ? "Revise os valores: use somente inteiros entre 0 e 100.000."
                : "Não foi possível salvar a configuração. Tente novamente."}
          </div>
        ) : null}

        {result.status === "empty" ? (
          <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            Ainda não existe configuração persistida. Os pesos sugeridos preservam o contrato
            original e somente passam a valer após o primeiro salvamento.
          </div>
        ) : null}

        <form action={savePointSettingsAction} className="mt-6 grid gap-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
            <div className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-end">
              <div>
                <p className="text-sm font-medium text-violet-700">Configuração normalizada</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Pontos por atividade</h2>
              </div>
              <span className="hidden text-center text-xs font-medium tracking-wide text-slate-500 uppercase sm:block">
                Peso
              </span>
              <span className="hidden text-center text-xs font-medium tracking-wide text-slate-500 uppercase sm:block">
                Objetivo
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {POINT_METRICS.map((metric) => (
                <fieldset
                  key={metric.key}
                  className="grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-center"
                >
                  <legend className="sr-only">{metric.label}</legend>
                  <strong className="text-slate-800">{metric.label}</strong>
                  <label className="grid gap-1 text-xs text-slate-500 sm:text-center">
                    <span className="sm:hidden">Peso</span>
                    <input
                      required
                      aria-label={`Peso de ${metric.label}`}
                      name={`weight.${metric.formKey}`}
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      defaultValue={weights[metric.key]}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-base font-medium text-slate-950"
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-500 sm:text-center">
                    <span className="sm:hidden">Objetivo</span>
                    <input
                      required
                      aria-label={`Objetivo de ${metric.label}`}
                      name={`target.${metric.formKey}`}
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      defaultValue={targets[metric.key]}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-base font-medium text-slate-950"
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
            <p className="text-sm text-violet-900">
              O ranking usará estes pesos somente após a confirmação abaixo.
            </p>
            <button className="rounded-xl bg-violet-700 px-6 py-3 font-medium text-white shadow-sm hover:bg-violet-800 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:outline-none">
              Salvar configuração
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
