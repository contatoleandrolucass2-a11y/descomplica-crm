import Link from "next/link";

import { enforcePermission } from "@/lib/authorization/enforce";
import { POINT_METRICS } from "@/lib/crm/points/catalog";
import {
  RANKING_PERIODS,
  RANKING_SCOPES,
  isRankingPeriod,
  isRankingScope,
  type RankingPeriodKey,
  type RankingScopeKey,
} from "@/lib/crm/ranking/catalog";
import { loadRankingReadModel } from "@/lib/crm/ranking/data";
import { buildRanking } from "@/lib/crm/ranking/presentation";

export const metadata = { title: "Ranking" };

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

function rankingHref(period: RankingPeriodKey, scope: RankingScopeKey) {
  return `/app/ranking?period=${period}&scope=${scope}`;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[]; scope?: string | string[] }>;
}) {
  await enforcePermission("crm.ranking.view");
  const query = await searchParams;
  const period: RankingPeriodKey = isRankingPeriod(query.period) ? query.period : "month";
  const scope: RankingScopeKey = isRankingScope(query.scope) ? query.scope : "brokers";
  const result = await loadRankingReadModel();

  if (result.status !== "ready") {
    return (
      <main className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
            {result.status === "empty" ? "Aguardando dados" : "Configuração necessária"}
          </span>
          <h1 className="mt-5 text-3xl font-semibold text-slate-950">Ranking comercial</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            {result.status === "empty"
              ? "O read model está pronto, mas ainda não existe um snapshot real de atividades. Nenhum participante demonstrativo será exibido."
              : "Existe atividade para o ranking, mas os pesos ainda não foram confirmados por um administrador."}
          </p>
          {result.status === "unconfigured" ? (
            <Link
              href="/app/configuracoes/metas/pontos"
              className="mt-7 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-medium text-white hover:bg-violet-800"
            >
              Configurar pontuação
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  const ranking = buildRanking(result.activities, period, scope, result.weights.weights);
  const totalPoints = ranking.reduce((sum, line) => sum + line.total, 0);
  const averagePoints = ranking.length ? totalPoints / ranking.length : 0;
  const averageConversion = ranking.length
    ? ranking.reduce((sum, line) => sum + line.conversion, 0) / ranking.length
    : 0;

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium tracking-wide text-violet-300 uppercase">
                Desempenho comercial
              </p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Ranking por pontos</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                {RANKING_SCOPES[scope].description} em {RANKING_PERIODS[period].label.toLowerCase()}
                .
              </p>
            </div>
            <div className="w-full rounded-2xl bg-white/10 px-5 py-4 text-sm ring-1 ring-white/15 sm:w-auto sm:text-right">
              <small className="block text-slate-400">Atualizado em</small>
              <strong>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: result.timezone,
                }).format(new Date(result.generatedAt))}
              </strong>
              <span className="mt-1 block text-xs text-slate-400">{result.source}</span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-[auto_1fr] lg:items-center lg:justify-between">
            <nav aria-label="Escopo do ranking" className="grid gap-2 sm:flex">
              {(Object.keys(RANKING_SCOPES) as RankingScopeKey[]).map((scopeKey) => (
                <Link
                  key={scopeKey}
                  href={rankingHref(period, scopeKey)}
                  aria-current={scope === scopeKey ? "page" : undefined}
                  className={`rounded-xl px-4 py-3 text-sm transition ${
                    scope === scopeKey
                      ? "bg-violet-300 text-slate-950"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <strong className="block">{RANKING_SCOPES[scopeKey].label}</strong>
                  <span className="text-xs opacity-75">{RANKING_SCOPES[scopeKey].description}</span>
                </Link>
              ))}
            </nav>
            <nav aria-label="Período do ranking" className="flex flex-wrap gap-2 lg:justify-end">
              {(Object.keys(RANKING_PERIODS) as RankingPeriodKey[]).map((periodKey) => (
                <Link
                  key={periodKey}
                  href={rankingHref(periodKey, scope)}
                  aria-current={period === periodKey ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    period === periodKey
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {RANKING_PERIODS[periodKey].label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        {ranking.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-xl font-semibold text-slate-950">Nenhum resultado neste período</h2>
            <p className="mt-2 text-slate-600">
              Altere o período ou aguarde a próxima sincronização.
            </p>
          </section>
        ) : (
          <>
            <section aria-label="Pódio do ranking" className="mt-6 grid gap-4 md:grid-cols-3">
              {ranking.slice(0, 3).map((line, index) => (
                <article
                  key={line.name}
                  className={`rounded-3xl p-6 shadow-sm ring-1 ${
                    index === 0 ? "bg-amber-50 ring-amber-200" : "bg-white ring-slate-200"
                  }`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 font-semibold text-white">
                    {index + 1}º
                  </span>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950">{line.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {scope === "brokers"
                      ? line.managerName
                      : `${line.memberCount} ${line.memberCount === 1 ? "corretor" : "corretores"}`}
                  </p>
                  <strong className="mt-5 block text-4xl text-violet-800">
                    {numberFormatter.format(line.total)}
                  </strong>
                  <span className="text-sm text-slate-500">pontos</span>
                  <p className="mt-4 text-xs text-slate-600">
                    {numberFormatter.format(line.baseScore)} produção +{" "}
                    {numberFormatter.format(line.bonus)} bônus
                  </p>
                </article>
              ))}
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <small className="text-slate-500">Participantes</small>
                <strong className="mt-2 block text-2xl text-slate-950">{ranking.length}</strong>
              </article>
              <article className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <small className="text-slate-500">Média de pontos</small>
                <strong className="mt-2 block text-2xl text-slate-950">
                  {numberFormatter.format(averagePoints)}
                </strong>
              </article>
              <article className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <small className="text-slate-500">Conversão média</small>
                <strong className="mt-2 block text-2xl text-slate-950">
                  {percentFormatter.format(averageConversion)}
                </strong>
              </article>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 p-6 sm:p-8">
                <p className="text-sm font-medium text-violet-700">Placar completo</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Desempenho por {scope === "brokers" ? "corretor" : "gerente"}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-4xl text-left text-sm">
                  <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-5 py-3">Posição</th>
                      <th className="px-5 py-3">Participante</th>
                      <th className="px-5 py-3 text-right">Agenda</th>
                      <th className="px-5 py-3 text-right">Visitas</th>
                      <th className="px-5 py-3 text-right">Pastas</th>
                      <th className="px-5 py-3 text-right">Vendas</th>
                      <th className="px-5 py-3 text-right">Conversão</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ranking.map((line, index) => (
                      <tr key={line.name}>
                        <td className="px-5 py-4 font-semibold text-slate-700">{index + 1}º</td>
                        <td className="px-5 py-4">
                          <strong className="block text-slate-950">{line.name}</strong>
                          <span className="text-xs text-slate-500">{line.managerName}</span>
                        </td>
                        <td className="px-5 py-4 text-right">{line.schedule}</td>
                        <td className="px-5 py-4 text-right">{line.visit}</td>
                        <td className="px-5 py-4 text-right">{line.approvedFolder}</td>
                        <td className="px-5 py-4 text-right">{line.sale}</td>
                        <td className="px-5 py-4 text-right">
                          {percentFormatter.format(line.conversion)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-violet-800">
                          {numberFormatter.format(line.total)} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <details className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <summary className="cursor-pointer font-medium text-slate-950">
                Pesos usados neste cálculo
              </summary>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {POINT_METRICS.map((metric) => (
                  <div key={metric.key} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{metric.label}</dt>
                    <dd className="mt-1 font-semibold text-slate-950">
                      {result.weights.weights[metric.key]} pts
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
