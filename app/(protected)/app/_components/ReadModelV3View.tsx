import Link from "next/link";

import { DASHBOARD_STAGES, type DashboardStageKey } from "@/lib/crm/dashboard/catalog";
import type { ReadModelV3Dataset, ReadModelV3Response } from "@/lib/crm/read-model-v3/contracts";
import {
  buildReadModelV3Href,
  createEmptyReadModelV3Selection,
  readModelV3FilterStateKey,
  type ReadModelV3FilterSelection,
} from "@/lib/crm/read-model-v3/filters";
import type { ReadModelV3LoadResult } from "@/lib/crm/read-model-v3/data";

import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  FunnelChart,
  MetricCard,
  PageHeader,
  RankingList,
  SectionHeading,
  UnavailableValue,
  type AnalyticsColumn,
  type ChartAccent,
} from "./analytics";
import { ReadModelV3Filters } from "./ReadModelV3Filters";

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const currencyIntegerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function formatBrlCurrency(value: string) {
  const [integer, fraction = ""] = value.split(".");
  return `R$ ${currencyIntegerFormatter.format(BigInt(integer!))},${fraction.padEnd(2, "0")}`;
}

const STAGE_ACCENTS: Record<DashboardStageKey, ChartAccent> = {
  opportunities: "cyan",
  appointments: "blue",
  visits: "violet",
  folders: "teal",
  sales: "emerald",
};

const STATUS_COPY = {
  stale: {
    title: "Fonte atrasada",
    description:
      "Os últimos dados oficialmente publicados continuam visíveis, identificados pelo watermark da fonte.",
  },
  unavailable: {
    title: "Dado indisponível — integração pendente",
    description:
      "A fonte oficial ainda não publicou este conjunto. Nenhum valor demonstrativo é exibido.",
  },
  error: {
    title: "Falha na fonte oficial",
    description:
      "O read model registrou o erro sem reaproveitar valores anteriores como se fossem atuais.",
  },
} as const;

const OPTION_LABELS: Record<ReadModelV3Response["truncatedOptions"][number], string> = {
  organizations: "organizações",
  teams: "equipes",
  portfolios: "carteiras",
  coordinators: "coordenadores",
  managers: "gestores",
  brokers: "corretores",
  origins: "origens",
  developments: "empreendimentos",
  locations: "regiões/stands",
};

type MonthlyRow = {
  monthStart: string;
  stages: Record<DashboardStageKey, number>;
};

function fallbackSelection(result: ReadModelV3LoadResult): ReadModelV3FilterSelection {
  const selection = createEmptyReadModelV3Selection();
  if (result.status === "scope_required" && result.scopes.length === 1) {
    selection.scopeId = result.scopes[0]!.scope_id;
  }
  return selection;
}

export function ReadModelV3View({
  action,
  backHref,
  eyebrow,
  title,
  description,
  dataset,
  result,
  focusStage,
  breakdown = "brokers",
  policyNotice,
}: {
  action: string;
  backHref?: string;
  eyebrow: string;
  title: string;
  description: string;
  dataset: ReadModelV3Dataset;
  result: ReadModelV3LoadResult;
  focusStage?: DashboardStageKey;
  breakdown?: "organizations" | "brokers" | "managers" | "developments";
  policyNotice?: string;
}) {
  if (result.status === "invalid" || result.status === "error") {
    return (
      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto grid max-w-7xl gap-7">
          <PageHeader eyebrow={eyebrow} title={title} description={description} />
          <DataState
            variant="error"
            title={result.status === "invalid" ? "Filtros rejeitados" : "Falha na leitura segura"}
            description={
              result.status === "invalid"
                ? "Um parâmetro não pertence ao escopo autorizado ou possui formato inválido. A consulta não foi ampliada."
                : "Não foi possível validar a resposta do read model. Nenhum dado parcial foi exibido."
            }
            action={
              <Link
                href={action}
                className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-5 py-2.5 font-semibold text-[#082137]"
              >
                Limpar filtros
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  if (result.status === "scope_required") {
    return (
      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto grid max-w-7xl gap-7">
          <PageHeader eyebrow={eyebrow} title={title} description={description} />
          <ReadModelV3Filters
            action={action}
            scopes={result.scopes}
            selection={fallbackSelection(result)}
          />
          <DataState
            variant="unavailable"
            title="Selecione um escopo autorizado"
            description="A leitura exige exatamente um escopo. Nenhuma união implícita de grants é realizada."
          />
        </div>
      </main>
    );
  }

  const { model, scopes, selection } = result;
  const metrics = model.metrics;
  const stages =
    metrics?.stageTotals ??
    (Object.keys(DASHBOARD_STAGES) as DashboardStageKey[]).map((stageKey) => ({
      stageKey,
      value: null,
      conversion: null,
      closedMonthsAverage: null,
    }));
  const displayedStages = focusStage
    ? stages.filter((stage) => stage.stageKey === focusStage)
    : stages;
  const source = model.source;
  const statusCopy =
    model.dataStatus === "unavailable" &&
    ["scope_coverage_not_proven", "period_coverage_not_proven"].includes(model.reasonCode ?? "")
      ? model.reasonCode === "scope_coverage_not_proven"
        ? {
            title: "Cobertura do escopo não comprovada",
            description:
              "O manifesto do snapshot não certificou este escopo. A ausência não foi convertida em zero.",
          }
        : {
            title: "Cobertura do período não comprovada",
            description:
              "O período solicitado extrapola os limites certificados da fonte. Nenhuma métrica parcial foi exibida como completa.",
          }
      : model.dataStatus === "ready" || model.dataStatus === "empty"
        ? null
        : STATUS_COPY[model.dataStatus];
  const selectedBreakdown = model.breakdowns?.[breakdown] ?? [];
  const datasetHasOfficialPresentation = dataset === "funnel";
  const periodLabel =
    selection.period === "month"
      ? "Mês até a referência"
      : selection.period === "week"
        ? "Semana até a referência"
        : selection.period === "today"
          ? "Data de referência"
          : "Intervalo personalizado";
  const monthlyRows = metrics?.monthlySeries ?? [];
  const monthlyColumns: Array<AnalyticsColumn<MonthlyRow>> = [
    {
      key: "month",
      label: "Mês fechado",
      render: (row) =>
        new Intl.DateTimeFormat("pt-BR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${row.monthStart}T00:00:00Z`)),
    },
    ...(Object.keys(DASHBOARD_STAGES) as DashboardStageKey[]).map((stageKey) => ({
      key: stageKey,
      label: DASHBOARD_STAGES[stageKey].label,
      align: "right" as const,
      render: (row: MonthlyRow) => numberFormatter.format(row.stages[stageKey]),
    })),
  ];

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-1 gap-7">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          meta={
            <dl className="grid gap-3">
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte</dt>
                <dd className="mt-1 font-semibold text-white">
                  {source?.sourceKey ?? "Indisponível"}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide text-slate-300 uppercase">
                  Última sincronização
                </dt>
                <dd className="mt-1 text-slate-100">
                  {source?.sourceUpdatedAt
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: source.timezone,
                      }).format(new Date(source.sourceUpdatedAt))
                    : "Indisponível"}
                </dd>
              </div>
            </dl>
          }
          footer={
            backHref ? (
              <Link
                className="text-sm font-semibold text-cyan-200 hover:text-white"
                href={buildReadModelV3Href(backHref, selection)}
              >
                ← Voltar ao dashboard
              </Link>
            ) : undefined
          }
        />

        <ReadModelV3Filters
          key={readModelV3FilterStateKey(selection)}
          action={action}
          scopes={scopes}
          selection={selection}
          options={model.options}
        />

        {model.truncatedOptions.length > 0 ? (
          <DataState
            compact
            variant="warning"
            title="Opções de filtro limitadas"
            description={`A fonte possui mais de 100 opções em: ${model.truncatedOptions.map((dimension) => OPTION_LABELS[dimension]).join(", ")}. Refine o escopo; a lista exibida não representa um catálogo completo.`}
          />
        ) : null}

        {model.dataStatus === "empty" ? (
          <DataState
            compact
            variant="empty"
            title="Nenhum registro no recorte"
            description="A fonte está pronta e o zero é real para esta combinação autorizada de filtros."
          />
        ) : model.dataStatus !== "ready" ? (
          <DataState
            compact
            variant={
              model.dataStatus === "error"
                ? "error"
                : model.dataStatus === "stale"
                  ? "stale"
                  : "unavailable"
            }
            title={statusCopy!.title}
            description={statusCopy!.description}
          />
        ) : null}

        {source?.qualityStatus === "warning" ? (
          <DataState
            compact
            variant="warning"
            title="Qualidade da fonte com ressalvas"
            description={`A fonte publicou os códigos: ${source.qualityIssues.join(", ") || "não informados"}. Os valores não são apresentados como qualidade verificada.`}
          />
        ) : null}

        {source && source.coverageStatus !== "complete" ? (
          <DataState
            compact
            variant="warning"
            title={
              source.coverageStatus === "partial"
                ? "Cobertura parcial declarada"
                : "Cobertura temporal desconhecida"
            }
            description={
              source.coverageStatus === "partial"
                ? "O recorte pode não representar todo o período. Os limites declarados permanecem visíveis na resposta da fonte."
                : "A fonte não certificou limites de cobertura; nenhuma completude é inferida."
            }
          />
        ) : null}

        {!datasetHasOfficialPresentation ? (
          <DataState
            variant="unavailable"
            title="Contrato analítico específico ainda bloqueado"
            description={
              policyNotice ??
              "Este dataset ainda não possui semântica oficial aprovada para apresentação. A interface não reutiliza o funil como se fosse ranking, parceria ou estoque."
            }
          />
        ) : (
          <>
            <section aria-labelledby={`${dataset}-stage-metrics`} className="min-w-0">
              <SectionHeading
                id={`${dataset}-stage-metrics`}
                kicker={periodLabel}
                title={focusStage ? DASHBOARD_STAGES[focusStage].label : "Etapas do funil"}
                description="Contagens reproduzíveis do snapshot oficial, sempre limitadas ao escopo e aos filtros selecionados."
              />
              <div
                className={
                  focusStage
                    ? "grid max-w-md min-w-0 grid-cols-1 gap-4"
                    : "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5"
                }
              >
                {displayedStages.map((stage) => {
                  const highlighted = !focusStage || focusStage === stage.stageKey;
                  return (
                    <MetricCard
                      key={stage.stageKey}
                      label={DASHBOARD_STAGES[stage.stageKey].label}
                      value={
                        stage.value === null ? "Indisponível" : numberFormatter.format(stage.value)
                      }
                      detail={
                        highlighted
                          ? `Média fechada: ${stage.closedMonthsAverage === null ? "indisponível" : numberFormatter.format(stage.closedMonthsAverage)}`
                          : "Etapa contextual do funil"
                      }
                      ratio={stage.conversion}
                      ratioLabel={
                        stage.conversion === null
                          ? "Indisponível"
                          : new Intl.NumberFormat("pt-BR", {
                              style: "percent",
                              maximumFractionDigits: 1,
                            }).format(stage.conversion)
                      }
                      ratioAriaLabel={`Conversão da etapa ${DASHBOARD_STAGES[stage.stageKey].label}`}
                      accent={STAGE_ACCENTS[stage.stageKey]}
                    />
                  );
                })}
              </div>
            </section>

            <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
              <AnalyticsCard>
                <SectionHeading
                  kicker="Conversão estrutural"
                  title="Funil do período"
                  description="A conversão é a razão entre volumes adjacentes; nenhuma política comercial é inferida."
                />
                <FunnelChart
                  label={`${title} — ${periodLabel}`}
                  stages={stages.map((stage) => ({
                    key: stage.stageKey,
                    label: DASHBOARD_STAGES[stage.stageKey].label,
                    value: stage.value,
                    conversion: stage.conversion,
                  }))}
                />
              </AnalyticsCard>

              <div className="grid gap-5">
                <AnalyticsCard tone="navy">
                  <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
                    Valor vendido
                  </p>
                  <div className="mt-4 text-2xl font-semibold text-white">
                    {metrics?.salesAmount === null || metrics?.salesAmount === undefined ? (
                      <UnavailableValue reason="A fonte não declarou a medida sales_amount." />
                    ) : (
                      formatBrlCurrency(metrics.salesAmount)
                    )}
                  </div>
                </AnalyticsCard>
                <AnalyticsCard>
                  <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
                    Metas e planejamento
                  </p>
                  <div className="mt-3">
                    <UnavailableValue reason="Fórmula ou política oficial ainda não aprovada." />
                  </div>
                </AnalyticsCard>
              </div>
            </section>

            {policyNotice ? (
              <DataState
                compact
                variant="unavailable"
                title="Motor comercial bloqueado"
                description={policyNotice}
              />
            ) : null}

            <section aria-labelledby={`${dataset}-breakdown`} className="min-w-0">
              <SectionHeading
                id={`${dataset}-breakdown`}
                kicker="Dimensão canônica"
                title="Distribuição do recorte"
                description="Agrupamento por ID estável; nomes são usados somente como rótulos de apresentação."
              />
              <AnalyticsCard>
                {selectedBreakdown.length > 0 ? (
                  <RankingList
                    items={selectedBreakdown.slice(0, 10).map((item, index) => ({
                      id: item.id,
                      rank: index + 1,
                      name: item.label,
                      value: numberFormatter.format(item.total),
                    }))}
                  />
                ) : (
                  <DataState
                    compact
                    variant={
                      model.dataStatus === "ready" || model.dataStatus === "empty"
                        ? "empty"
                        : "unavailable"
                    }
                    title="Dimensão sem registros"
                    description="Não há valores oficiais para esta dimensão dentro do recorte autorizado."
                  />
                )}
              </AnalyticsCard>
            </section>

            <section aria-labelledby={`${dataset}-history`} className="min-w-0">
              <SectionHeading
                id={`${dataset}-history`}
                kicker="Cobertura certificada"
                title="Histórico de meses fechados"
                description="Somente meses explicitamente certificados como completos entram na série e nas médias."
              />
              {monthlyRows.length > 0 ? (
                <AnalyticsTable
                  caption="Histórico oficial de meses fechados"
                  rows={monthlyRows}
                  columns={monthlyColumns}
                  rowKey={(row) => row.monthStart}
                />
              ) : (
                <DataState
                  compact
                  variant="unavailable"
                  title="Histórico indisponível"
                  description="A fonte não certificou meses completos. Ausência não é convertida em zero."
                />
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
