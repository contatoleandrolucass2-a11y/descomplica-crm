import Link from "next/link";

import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  FilterBar,
  FilterGroup,
  FilterLink,
  PageHeader,
  SectionHeading,
  UnavailableValue,
  type AnalyticsColumn,
} from "@/app/(protected)/app/_components/analytics";
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
import { buildRanking, type RankingLine } from "@/lib/crm/ranking/presentation";
import { DATA_UNAVAILABLE_LABEL } from "@/lib/crm/source-availability";

export const metadata = { title: "Ranking" };

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const METRIC_ACCENTS = [
  "bg-cyan-300",
  "bg-cyan-300",
  "bg-cyan-300",
  "bg-lime-300",
  "bg-cyan-300",
  "bg-lime-300",
  "bg-lime-300",
] as const;

const PODIUM_PRESENTATION = [
  {
    label: "Líder do ranking",
    cardClass: "border-lime-300/55 bg-lime-300/10 lg:col-start-2 lg:row-start-1 lg:min-h-[23rem]",
    markerClass: "bg-lime-300 text-[#082137] ring-lime-200/35",
    accentClass: "text-lime-300",
  },
  {
    label: "Vice-líder",
    cardClass: "border-cyan-200/35 bg-white/8 lg:col-start-1 lg:row-start-1 lg:min-h-[20.5rem]",
    markerClass: "bg-cyan-200 text-[#082137] ring-cyan-100/25",
    accentClass: "text-cyan-200",
  },
  {
    label: "Top 3",
    cardClass: "border-cyan-300/25 bg-cyan-300/6 lg:col-start-3 lg:row-start-1 lg:min-h-[20.5rem]",
    markerClass: "bg-cyan-700 text-white ring-cyan-300/20",
    accentClass: "text-cyan-300",
  },
] as const;

type RankingTableRow = {
  position: number;
  line: RankingLine;
};

type UnavailableRankingRow = { key: "unavailable" };

const unavailableRankingColumns: Array<AnalyticsColumn<UnavailableRankingRow>> = [
  "Posição",
  "Participante",
  "Agenda",
  "Visitas",
  "Pastas",
  "Vendas",
  "Conversão",
  "Produção",
  "Bônus",
  "Total",
].map((label, index) => ({
  key: `unavailable-${index}`,
  label,
  align: index > 1 ? "right" : "left",
  render: () => <UnavailableValue reason="Dado indisponível — integração pendente" />,
}));

function UnavailableRankingComposition({
  scope,
  period,
}: {
  scope: RankingScopeKey;
  period: RankingPeriodKey;
}) {
  return (
    <>
      <section aria-labelledby="ranking-podium-title">
        <SectionHeading
          id="ranking-podium-title"
          kicker="Top 3"
          title="Disputa pelo topo"
          description="A estrutura do pódio permanece visível sem inventar participantes ou pontuações."
        />
        <AnalyticsCard tone="navy" className="overflow-hidden">
          <ol className="grid list-none items-end gap-4 p-0 lg:grid-cols-3" role="list">
            {PODIUM_PRESENTATION.map((presentation, index) => (
              <li
                key={presentation.label}
                className={`flex min-h-72 flex-col items-center rounded-2xl border p-5 text-center ${presentation.cardClass}`}
              >
                <span
                  className={`grid size-16 place-items-center rounded-full text-xl font-bold ring-8 ${presentation.markerClass}`}
                  aria-label={`${index + 1}ª posição sem participante disponível`}
                >
                  {index + 1}º
                </span>
                <p
                  className={`mt-6 text-xs font-semibold tracking-[0.14em] uppercase ${presentation.accentClass}`}
                >
                  {presentation.label}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  <UnavailableValue reason="Dado indisponível — integração pendente" />
                </h3>
                <div className="mt-auto pt-7">
                  <UnavailableValue reason="Dado indisponível — integração pendente" />
                </div>
              </li>
            ))}
          </ol>
        </AnalyticsCard>
      </section>

      <section className="min-w-0" aria-labelledby="ranking-scoreboard-title">
        <SectionHeading
          id="ranking-scoreboard-title"
          kicker="Placar completo"
          title={`Desempenho por ${scope === "brokers" ? "corretor" : "gerente"}`}
          description="Colunas preservadas; ausência de fonte não é convertida em zero."
        />
        <AnalyticsTable
          caption={`Ranking de ${RANKING_SCOPES[scope].label.toLocaleLowerCase("pt-BR")} — ${RANKING_PERIODS[period].label}`}
          rows={[{ key: "unavailable" }]}
          columns={unavailableRankingColumns}
          rowKey={(row) => row.key}
        />
      </section>
    </>
  );
}

function rankingHref(period: RankingPeriodKey, scope: RankingScopeKey) {
  return `/app/ranking?period=${period}&scope=${scope}`;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[]; scope?: string | string[] }>;
}) {
  const authorization = await enforcePermission("crm.ranking.view");
  const canManagePoints = authorization.permissions.includes("crm.settings.manage");
  const query = await searchParams;
  const period: RankingPeriodKey = isRankingPeriod(query.period) ? query.period : "month";
  const scope: RankingScopeKey = isRankingScope(query.scope) ? query.scope : "brokers";
  const result = await loadRankingReadModel();

  if (result.status !== "ready") {
    const isEmpty = result.status === "empty";
    const policyPending = result.status === "policy_pending";

    return (
      <main className="px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-1 gap-7">
          <PageHeader
            eyebrow="Desempenho comercial"
            title="Ranking por pontos"
            description="A classificação comercial combina somente atividades reais do snapshot autorizado com a pontuação confirmada."
            footer={
              <p className="flex items-center gap-3 text-sm text-slate-200">
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${isEmpty ? "bg-amber-300" : "bg-cyan-300"}`}
                />
                {isEmpty
                  ? "Aguardando o primeiro snapshot"
                  : policyPending
                    ? "Política oficial pendente"
                    : "Pontuação ainda não configurada"}
              </p>
            }
          />

          <DataState
            variant={isEmpty ? "empty" : "unavailable"}
            title={
              isEmpty
                ? "Aguardando dados"
                : policyPending
                  ? "Ranking bloqueado por política"
                  : "Configuração necessária"
            }
            description={
              isEmpty
                ? "O read model está pronto, mas ainda não existe um snapshot real de atividades. Nenhum participante demonstrativo será exibido."
                : policyPending
                  ? "Existe configuração legada, mas ela não possui política versionada, owners, casos de ouro, aprovação, gate, coorte, grant, vigência e rollback. Nenhuma pontuação foi calculada."
                  : "Existe atividade para o ranking, mas ainda não há rascunho validado de pesos."
            }
            action={
              !isEmpty && canManagePoints ? (
                <Link
                  href="/app/configuracoes/metas/pontos"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-[#082137] hover:bg-cyan-200"
                >
                  Preparar rascunho de pontuação
                </Link>
              ) : undefined
            }
          />

          <section aria-labelledby="ranking-points-title">
            <AnalyticsCard tone="navy">
              <div className="border-b border-white/10 pb-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">
                  Regra vigente
                </p>
                <h2 id="ranking-points-title" className="mt-1 text-xl font-semibold text-white">
                  Pontos por ação
                </h2>
              </div>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {POINT_METRICS.map((metric, index) => (
                  <div
                    key={metric.key}
                    className="relative min-h-28 overflow-hidden rounded-xl border border-white/10 bg-white/8 p-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-0.5 ${METRIC_ACCENTS[index] ?? "bg-cyan-300"}`}
                    />
                    <dt className="min-h-9 text-xs leading-4 font-medium text-slate-300">
                      {metric.label}
                    </dt>
                    <dd className="mt-3">
                      <UnavailableValue reason="Dado indisponível — integração pendente" />
                    </dd>
                  </div>
                ))}
              </dl>
            </AnalyticsCard>
          </section>

          <FilterBar label="Filtros autorizados do ranking">
            <FilterGroup label="Visão do ranking">
              {(Object.keys(RANKING_SCOPES) as RankingScopeKey[]).map((scopeKey) => (
                <FilterLink
                  key={scopeKey}
                  href={rankingHref(period, scopeKey)}
                  active={scope === scopeKey}
                >
                  {RANKING_SCOPES[scopeKey].label}
                </FilterLink>
              ))}
            </FilterGroup>
            <FilterGroup label="Período">
              {(Object.keys(RANKING_PERIODS) as RankingPeriodKey[]).map((periodKey) => (
                <FilterLink
                  key={periodKey}
                  href={rankingHref(periodKey, scope)}
                  active={period === periodKey}
                >
                  {RANKING_PERIODS[periodKey].label}
                </FilterLink>
              ))}
            </FilterGroup>
          </FilterBar>

          <UnavailableRankingComposition period={period} scope={scope} />
        </div>
      </main>
    );
  }

  const ranking = buildRanking(
    result.activities,
    period,
    scope,
    result.weights.weights,
    result.rouletteAvailable,
  );
  const totalPoints = ranking.reduce((sum, line) => sum + line.total, 0);
  const averagePoints = ranking.length ? totalPoints / ranking.length : 0;
  const averageConversion = ranking.length
    ? ranking.reduce((sum, line) => sum + line.conversion, 0) / ranking.length
    : 0;
  const rankingRows: RankingTableRow[] = ranking.map((line, index) => ({
    position: index + 1,
    line,
  }));
  const rankingColumns: Array<AnalyticsColumn<RankingTableRow>> = [
    {
      key: "position",
      label: "Posição",
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--analytics-navy)] text-xs font-bold text-white">
            {row.position}º
          </span>
          <span className="sr-only">{row.line.name}</span>
        </span>
      ),
    },
    {
      key: "participant",
      label: "Participante",
      render: (row) => (
        <span className="block min-w-44">
          <strong className="block text-[var(--analytics-ink)]">{row.line.name}</strong>
          <span className="mt-0.5 block text-xs text-[var(--analytics-muted)]">
            {scope === "brokers"
              ? row.line.managerName
              : `${row.line.memberCount} ${row.line.memberCount === 1 ? "corretor" : "corretores"}`}
          </span>
        </span>
      ),
    },
    {
      key: "schedule",
      label: "Agenda",
      align: "right",
      render: (row) => numberFormatter.format(row.line.schedule),
    },
    {
      key: "visit",
      label: "Visitas",
      align: "right",
      render: (row) => numberFormatter.format(row.line.visit),
    },
    {
      key: "approved-folder",
      label: "Pastas",
      align: "right",
      render: (row) => numberFormatter.format(row.line.approvedFolder),
    },
    {
      key: "sale",
      label: "Vendas",
      align: "right",
      render: (row) => numberFormatter.format(row.line.sale),
    },
    {
      key: "conversion",
      label: "Conversão",
      align: "right",
      render: (row) => percentFormatter.format(row.line.conversion),
    },
    {
      key: "base-score",
      label: "Produção",
      align: "right",
      render: (row) => `${numberFormatter.format(row.line.baseScore)} pts`,
    },
    {
      key: "bonus",
      label: "Bônus",
      align: "right",
      render: (row) => `+${numberFormatter.format(row.line.bonus)} pts`,
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      render: (row) => (
        <strong className="whitespace-nowrap text-[var(--analytics-cyan-strong)]">
          {numberFormatter.format(row.line.total)} pts
        </strong>
      ),
    },
  ];

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-1 gap-7">
        <PageHeader
          eyebrow="Desempenho comercial"
          title="Ranking por pontos"
          description={`${RANKING_SCOPES[scope].description} em ${RANKING_PERIODS[
            period
          ].label.toLocaleLowerCase("pt-BR")}.`}
          meta={
            <dl className="grid gap-3">
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Atualizado em</dt>
                <dd className="mt-1 font-semibold text-white">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: result.timezone,
                  }).format(new Date(result.generatedAt))}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte</dt>
                <dd className="mt-1 break-words text-slate-100">{result.source}</dd>
              </div>
            </dl>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-lime-300" />
                Snapshot autorizado
              </span>
              <span className="text-slate-300">
                {RANKING_SCOPES[scope].label} · {RANKING_PERIODS[period].label}
              </span>
            </div>
          }
        />

        <section aria-labelledby="ranking-points-title">
          <AnalyticsCard tone="navy">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">
                  Regra vigente
                </p>
                <h2 id="ranking-points-title" className="mt-1 text-xl font-semibold text-white">
                  Pontos por ação
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-300">
                Os sete indicadores abaixo são os pesos confirmados usados no cálculo deste placar.
              </p>
            </div>

            <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {POINT_METRICS.map((metric, index) => {
                const rouletteUnavailable =
                  !result.rouletteAvailable && metric.key.startsWith("roulette");

                return (
                  <div
                    key={metric.key}
                    className="relative min-h-28 overflow-hidden rounded-xl border border-white/10 bg-white/8 p-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-0.5 ${
                        METRIC_ACCENTS[index] ?? "bg-cyan-300"
                      }`}
                    />
                    <dt className="min-h-9 text-xs leading-4 font-medium text-slate-300">
                      {metric.label}
                    </dt>
                    <dd className="mt-3">
                      {rouletteUnavailable ? (
                        <strong className="block text-sm leading-5 text-cyan-200">
                          {DATA_UNAVAILABLE_LABEL}
                        </strong>
                      ) : (
                        <>
                          <strong className="text-2xl leading-none font-semibold text-white">
                            {numberFormatter.format(result.weights.weights[metric.key])}
                          </strong>
                          <span className="ml-1.5 text-xs font-medium text-lime-300">
                            pts por ação
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </AnalyticsCard>
        </section>

        <FilterBar label="Filtros autorizados do ranking">
          <FilterGroup label="Visão do ranking">
            {(Object.keys(RANKING_SCOPES) as RankingScopeKey[]).map((scopeKey) => (
              <FilterLink
                key={scopeKey}
                href={rankingHref(period, scopeKey)}
                active={scope === scopeKey}
              >
                <span className="grid gap-0.5 text-left">
                  <strong>{RANKING_SCOPES[scopeKey].label}</strong>
                  <span className="text-[0.68rem] font-normal opacity-75">
                    {RANKING_SCOPES[scopeKey].description}
                  </span>
                </span>
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup label="Período">
            {(Object.keys(RANKING_PERIODS) as RankingPeriodKey[]).map((periodKey) => (
              <FilterLink
                key={periodKey}
                href={rankingHref(periodKey, scope)}
                active={period === periodKey}
              >
                {RANKING_PERIODS[periodKey].label}
              </FilterLink>
            ))}
          </FilterGroup>
        </FilterBar>

        {!result.rouletteAvailable ? (
          <DataState
            variant="unavailable"
            compact
            title={`Roleta: ${DATA_UNAVAILABLE_LABEL}`}
            description="A roleta não possui fonte oficial e não participa da pontuação deste snapshot. Agendamentos, visitas, pastas e vendas continuam calculados normalmente."
          />
        ) : null}

        {ranking.length === 0 ? (
          <>
            <DataState
              variant="empty"
              title="Nenhum resultado neste período"
              description="Altere o período ou aguarde a próxima sincronização. Nenhum participante demonstrativo será exibido."
            />
            <UnavailableRankingComposition period={period} scope={scope} />
          </>
        ) : (
          <>
            <section aria-labelledby="ranking-podium-title">
              <SectionHeading
                id="ranking-podium-title"
                kicker="Top 3"
                title="Disputa pelo topo"
                description={`Destaques reais de ${RANKING_SCOPES[scope].label.toLocaleLowerCase(
                  "pt-BR",
                )} no período selecionado.`}
              />
              <AnalyticsCard tone="navy" className="overflow-hidden">
                <ol className="grid list-none items-end gap-4 p-0 lg:grid-cols-3" role="list">
                  {ranking.slice(0, 3).map((line, index) => {
                    const presentation = PODIUM_PRESENTATION[index]!;

                    return (
                      <li
                        key={line.key}
                        className={`flex min-h-72 flex-col items-center rounded-2xl border p-5 text-center ${presentation.cardClass}`}
                      >
                        <span
                          className={`grid size-16 place-items-center rounded-full text-xl font-bold ring-8 ${presentation.markerClass}`}
                          aria-label={`${index + 1}º lugar`}
                        >
                          {index + 1}º
                        </span>
                        <p
                          className={`mt-6 text-xs font-semibold tracking-[0.14em] uppercase ${presentation.accentClass}`}
                        >
                          {presentation.label}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold break-words text-white">
                          {line.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          {scope === "brokers"
                            ? line.managerName
                            : `${line.memberCount} ${line.memberCount === 1 ? "corretor" : "corretores"}`}
                        </p>
                        <div className="mt-auto pt-7">
                          <strong className="block text-4xl font-semibold tracking-tight text-white">
                            {numberFormatter.format(line.total)}
                          </strong>
                          <span className={`text-sm font-semibold ${presentation.accentClass}`}>
                            pontos
                          </span>
                        </div>
                        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-300">
                          {numberFormatter.format(line.baseScore)} produção +{" "}
                          {numberFormatter.format(line.bonus)} bônus
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </AnalyticsCard>
            </section>

            <section className="min-w-0" aria-labelledby="ranking-scoreboard-title">
              <SectionHeading
                id="ranking-scoreboard-title"
                kicker="Placar completo"
                title={`Desempenho por ${scope === "brokers" ? "corretor" : "gerente"}`}
                description="Produção, bônus e conversão permanecem separados para tornar a pontuação auditável."
                action={
                  <dl className="grid w-full grid-cols-3 overflow-hidden rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-line)] sm:w-auto">
                    <div className="min-w-24 bg-[var(--analytics-surface)] px-3 py-2">
                      <dt className="text-[0.65rem] text-[var(--analytics-muted)]">
                        Participantes
                      </dt>
                      <dd className="mt-0.5 font-semibold text-[var(--analytics-ink)]">
                        {ranking.length}
                      </dd>
                    </div>
                    <div className="min-w-24 bg-[var(--analytics-surface)] px-3 py-2">
                      <dt className="text-[0.65rem] text-[var(--analytics-muted)]">
                        Média de pontos
                      </dt>
                      <dd className="mt-0.5 font-semibold text-[var(--analytics-ink)]">
                        {numberFormatter.format(averagePoints)}
                      </dd>
                    </div>
                    <div className="min-w-24 bg-[var(--analytics-surface)] px-3 py-2">
                      <dt className="text-[0.65rem] text-[var(--analytics-muted)]">
                        Conversão média
                      </dt>
                      <dd className="mt-0.5 font-semibold text-[var(--analytics-ink)]">
                        {percentFormatter.format(averageConversion)}
                      </dd>
                    </div>
                  </dl>
                }
              />
              <AnalyticsTable
                caption={`Ranking completo de ${RANKING_SCOPES[scope].label.toLocaleLowerCase(
                  "pt-BR",
                )} — ${RANKING_PERIODS[period].label}`}
                rows={rankingRows}
                columns={rankingColumns}
                rowKey={(row) => row.line.key}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
