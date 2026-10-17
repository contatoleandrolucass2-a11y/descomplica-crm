import { ArrowDown, ArrowUp, Building2, Check, Medal, Minus, Package, Search } from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
} from "@/app/(protected)/_components/ManagementCanvas";
import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  SectionHeading,
  type AnalyticsColumn,
} from "@/app/(protected)/app/_components/analytics";
import type { QlikRankingV2 } from "@/lib/crm/qlik/contracts-v2";
import type { QlikRankingV2Data } from "@/lib/crm/qlik/data-v2";
import {
  buildQlikRankingPresentation,
  type QlikRankingRow,
  type QlikRankingView,
} from "@/lib/crm/qlik/ranking-presentation";

import styles from "./PartnershipsRanking.module.css";

const PERIODS = {
  latest: "Último mês disponível",
  previous: "Mês anterior",
  year: "Ano até a última competência",
  custom: "Personalizado",
  q1: "1º trimestre",
  q2: "2º trimestre",
  q3: "3º trimestre",
  q4: "4º trimestre",
} as const;
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const SOURCE_STALE_AFTER_MS = 3 * 60 * 60 * 1000;
export type RankingFilters = {
  year: number | null;
  period: keyof typeof PERIODS;
  start: string | null;
  end: string | null;
  query: string;
  kind: "imobs" | "developments";
};

export function parseRankingFilters(
  params: Record<string, string | string[] | undefined>,
): RankingFilters | null {
  const { year, period = "latest", start, end, query = "", kind = "imobs" } = params;
  if ([year, period, start, end, query, kind].some(Array.isArray)) return null;
  if (
    typeof period !== "string" ||
    !Object.hasOwn(PERIODS, period) ||
    typeof query !== "string" ||
    query.length > 256 ||
    (kind !== "imobs" && kind !== "developments")
  )
    return null;
  if (year !== undefined && (typeof year !== "string" || !/^(20[2-9]\d|2100)$/.test(year)))
    return null;
  if (
    [start, end].some(
      (month) =>
        month !== undefined && (typeof month !== "string" || !/^(0[1-9]|1[0-2])$/.test(month)),
    )
  )
    return null;
  return {
    year: year === undefined ? null : Number(year),
    period: period as RankingFilters["period"],
    start: (start as string | undefined) ?? null,
    end: (end as string | undefined) ?? null,
    query: query.trim(),
    kind,
  };
}

function presentation(snapshot: QlikRankingV2, startMonth: string, endMonth: string, query = "") {
  const businessUnit = snapshot.scope.businessUnit;
  const months = snapshot.months.map((month) => month.periodMonth);
  // Adapt validated v2 facts to the pure presenter, never to the v1 ingestion path.
  return buildQlikRankingPresentation(
    {
      schemaVersion: 1,
      requestId: snapshot.requestId,
      referenceYear: Number(months[0]!.slice(0, 4)),
      generatedAt: snapshot.completedAt,
      sourceUpdatedAt: snapshot.source.reloadTimestamp,
      entries: snapshot.months.flatMap((month) =>
        month.imobs.rows.map((row) => ({
          periodMonth: month.periodMonth,
          imobKey: row.key,
          imobName: row.name,
          vgv: row.vgv,
          contracts: row.contracts,
        })),
      ),
      developments: snapshot.months.flatMap((month) =>
        month.developments.rows.map((row) => ({
          periodMonth: month.periodMonth,
          developmentKey: row.key,
          developmentName: row.name,
          businessUnit,
          vgv: row.vgv,
          contracts: row.contracts,
        })),
      ),
    },
    {
      startMonth,
      endMonth,
      businessUnit,
      query,
      coverage: {
        requestId: snapshot.requestId,
        businessUnit,
        imobMonths: months,
        developmentMonths: months,
      },
    },
  );
}

type Movement = { state: "new" } | { state: "compared"; delta: number };
export type RankingSelection = {
  startMonth: string | null;
  endMonth: string | null;
  view: QlikRankingView;
  movement: Map<string, Movement>;
};

export function buildRankingV2Selection(
  data: QlikRankingV2Data,
  filters: RankingFilters,
): RankingSelection {
  const unavailable: RankingSelection = {
    startMonth: null,
    endMonth: null,
    view: { status: "unavailable", reason: "coverage_missing" },
    movement: new Map(),
  };
  if (data.status !== "ready") return unavailable;
  const snapshot = data.current;
  const last = snapshot.months.at(-1)!.periodMonth;
  const year = last.slice(0, 4);
  let start = last.slice(5, 7);
  let end = start;
  if (filters.period === "previous") start = end = String(Number(start) - 1).padStart(2, "0");
  if (filters.period === "year") {
    start = "01";
    end = last.slice(5, 7);
  }
  if (filters.period === "custom") {
    start = filters.start ?? "";
    end = filters.end ?? "";
  }
  if (filters.period.startsWith("q")) {
    const quarter = Number(filters.period.slice(1));
    start = String(quarter * 3 - 2).padStart(2, "0");
    end = String(quarter * 3).padStart(2, "0");
  }
  if (!/^(0[1-9]|1[0-2])$/.test(start) || !/^(0[1-9]|1[0-2])$/.test(end) || start > end)
    return unavailable;
  const startMonth = `${year}-${start}-01`;
  const endMonth = `${year}-${end}-01`;
  try {
    const view = presentation(snapshot, startMonth, endMonth, filters.query)[filters.kind];
    const movement = new Map<string, Movement>();
    const previous = data.previous;
    if (
      view.status !== "unavailable" &&
      previous &&
      previous.source.mappingSha256 === snapshot.source.mappingSha256 &&
      previous.source.appId === snapshot.source.appId &&
      previous.source.sheetId === snapshot.source.sheetId &&
      previous.scope.businessUnit === snapshot.scope.businessUnit &&
      previous.scope.regional === snapshot.scope.regional &&
      previous.scope.channel === snapshot.scope.channel &&
      previous.months[0]!.periodMonth.slice(0, 4) === year &&
      previous.batchId !== snapshot.batchId &&
      previous.requestId !== snapshot.requestId
    ) {
      try {
        const prior = presentation(previous, startMonth, endMonth)[filters.kind];
        if (prior.status !== "unavailable") {
          const identities = new Map(
            previous.months
              .filter((month) => month.periodMonth >= startMonth && month.periodMonth <= endMonth)
              .flatMap((month) =>
                month[filters.kind].rows.map((row) => [row.key, row.name] as const),
              ),
          );
          for (const row of view.rows.slice(0, 10)) {
            const name = identities.get(row.key);
            if (name === undefined) {
              movement.set(row.key, { state: "new" });
              continue;
            }
            // Searching the previous name retains positions below its displayed top ten.
            const searched = presentation(previous, startMonth, endMonth, name)[filters.kind];
            const oldRow =
              searched.status === "unavailable"
                ? undefined
                : searched.rows.find((item) => item.key === row.key);
            if (oldRow)
              movement.set(row.key, { state: "compared", delta: oldRow.position - row.position });
          }
        }
      } catch {
        /* Invalid history does not invalidate the current publication. */
      }
    }
    return { startMonth, endMonth, view, movement };
  } catch {
    return { ...unavailable, startMonth, endMonth };
  }
}

export function formatRankingMoney(cents: bigint) {
  return `R$ ${(cents / 100n).toLocaleString("pt-BR")},${(cents % 100n).toString().padStart(2, "0")}`;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function MovementValue({ value }: { value: Movement | undefined }) {
  if (!value) return <span>Não comparável</span>;
  if (value.state === "new") return <span>Nova entrada</span>;
  const Icon = value.delta > 0 ? ArrowUp : value.delta < 0 ? ArrowDown : Minus;
  return (
    <span className={styles.movement}>
      <Icon size={15} aria-hidden="true" />
      {value.delta === 0
        ? "Estável"
        : `${value.delta > 0 ? "Subiu" : "Caiu"} ${Math.abs(value.delta)}`}
    </span>
  );
}

export function RankingDashboard({
  data,
  filters,
  now = new Date(),
}: {
  data: QlikRankingV2Data;
  filters: RankingFilters | null;
  now?: Date;
}) {
  const active = filters ?? parseRankingFilters({})!;
  const selection = buildRankingV2Selection(data, active);
  const view = selection.view;
  const ready = data.status === "ready";
  const stale =
    ready &&
    now.getTime() - Date.parse(data.current.source.reloadTimestamp) >= SOURCE_STALE_AFTER_MS;
  const years = data.status === "unavailable" ? [] : data.availableYears;
  const year =
    active.year ?? (ready ? Number(data.current.months[0]!.periodMonth.slice(0, 4)) : years[0]);
  const isImob = active.kind === "imobs";
  const kindLabel = isImob ? "imobiliárias" : "empreendimentos";
  const title = active.query ? `Resultados: ${kindLabel}` : `Top 10 ${kindLabel}`;
  const available = view.status !== "unavailable";
  const columns: AnalyticsColumn<QlikRankingRow>[] = [
    { key: "position", label: "Posição", render: (row) => row.position },
    {
      key: "movement",
      label: "Variação",
      render: (row) => <MovementValue value={selection.movement.get(row.key)} />,
    },
    { key: "name", label: isImob ? "Imobiliária" : "Empreendimento", render: (row) => row.name },
    { key: "vgv", label: "VGV", align: "right", render: (row) => formatRankingMoney(row.vgvCents) },
    {
      key: "contracts",
      label: "Total de contratos",
      align: "right",
      render: (row) => row.contracts.toLocaleString("pt-BR"),
    },
  ];
  const stateTitle = !filters
    ? "Filtros inválidos"
    : data.status === "unavailable"
      ? "Dados indisponíveis"
      : data.status === "empty"
        ? "Nenhuma publicação disponível"
        : !available
          ? "Período sem cobertura completa"
          : view.status === "empty"
            ? "Nenhum registro no período"
            : null;

  return (
    <ManagementPage className={styles.canvas ?? ""}>
      <ManagementPageHeader
        eyebrow="Canal de Parcerias"
        title="Ranking das imobiliárias"
        description="Direcional · SP CAPITAL · CANAL IMOB"
        status={
          <ManagementStatusBadge tone={ready && !stale ? "positive" : "warning"}>
            {stale
              ? "Fonte desatualizada"
              : ready
                ? "Publicação Qlik disponível"
                : data.status === "empty"
                  ? "Sem publicação"
                  : "Integração indisponível"}
          </ManagementStatusBadge>
        }
      />
      <section aria-label="Estado da fonte">
        {stale && (
          <DataState
            variant="stale"
            title="Fonte desatualizada"
            description="A última recarga da fonte tem pelo menos 3 horas. A última base válida foi preservada."
            compact
          />
        )}
        {stateTitle && (
          <DataState
            variant={data.status === "empty" || view.status === "empty" ? "empty" : "unavailable"}
            title={stateTitle}
            description={
              data.status === "unavailable"
                ? "A leitura da fonte Qlik não pôde ser confirmada."
                : "Não há resultados completos para esta seleção."
            }
            compact
          />
        )}
        <dl className={styles.sourceMeta}>
          <div>
            <dt>Atualização da fonte</dt>
            <dd>
              {ready ? (
                <time dateTime={data.current.source.reloadTimestamp}>
                  {timeLabel(data.current.source.reloadTimestamp)}
                </time>
              ) : (
                "Indisponível"
              )}
            </dd>
          </div>
          <div>
            <dt>Processamento</dt>
            <dd>
              {ready ? (
                <time dateTime={data.current.completedAt}>
                  {timeLabel(data.current.completedAt)}
                </time>
              ) : (
                "Indisponível"
              )}
            </dd>
          </div>
          <div>
            <dt>Publicação</dt>
            <dd>
              {ready ? (
                <time dateTime={data.publishedAt}>{timeLabel(data.publishedAt)}</time>
              ) : (
                "Indisponível"
              )}
            </dd>
          </div>
        </dl>
      </section>
      <form
        action="/app/canal-de-parcerias"
        method="get"
        className={styles.filters}
        aria-label="Filtros do ranking de parcerias"
      >
        <label>
          Ano
          <select
            aria-label="Ano"
            name="year"
            defaultValue={year ?? ""}
            disabled={years.length === 0}
          >
            {year !== undefined && !years.includes(year) && <option value={year}>{year}</option>}
            {years.length === 0 && <option value="">Indisponível</option>}
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Período
          <select aria-label="Período" name="period" defaultValue={active.period} disabled={!ready}>
            {Object.entries(PERIODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mês inicial
          <select
            name="start"
            aria-label="Mês inicial"
            defaultValue={active.start ?? selection.startMonth?.slice(5, 7) ?? "01"}
            disabled={!ready}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={String(index + 1).padStart(2, "0")}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mês final
          <select
            name="end"
            aria-label="Mês final"
            defaultValue={active.end ?? selection.endMonth?.slice(5, 7) ?? "12"}
            disabled={!ready}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={String(index + 1).padStart(2, "0")}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.search}>
          <span>
            <Search size={15} aria-hidden="true" /> Buscar imobiliária ou produto
          </span>
          <input
            name="query"
            type="search"
            maxLength={256}
            defaultValue={active.query}
            disabled={!ready}
          />
        </label>
        <fieldset className={styles.viewSwitch} disabled={!ready}>
          <legend>Ranking</legend>
          <label>
            <input type="radio" name="kind" value="imobs" defaultChecked={isImob} />
            <span>
              <Building2 size={17} aria-hidden="true" /> Imobiliárias
            </span>
          </label>
          <label>
            <input type="radio" name="kind" value="developments" defaultChecked={!isImob} />
            <span>
              <Package size={17} aria-hidden="true" /> Produtos
            </span>
          </label>
        </fieldset>
        <button type="submit" disabled={data.status === "empty" && years.length === 0}>
          <Check size={17} aria-hidden="true" />
          {data.status === "unavailable" ? "Tentar novamente" : "Aplicar filtros"}
        </button>
      </form>
      <p className={styles.pendingNote}>
        Período selecionado:{" "}
        {selection.startMonth && selection.endMonth
          ? `${selection.startMonth.slice(5, 7)}/${selection.startMonth.slice(0, 4)} a ${selection.endMonth.slice(5, 7)}/${selection.endMonth.slice(0, 4)}`
          : "Indisponível"}
      </p>
      <section className={styles.podium} aria-labelledby="ranking-podium-title">
        <SectionHeading
          id="ranking-podium-title"
          title={`Pódio de ${kindLabel}`}
          density="compact"
        />
        <div className={styles.podiumGrid}>
          {[
            { index: 1, label: "Prata" },
            { index: 0, label: "Ouro" },
            { index: 2, label: "Bronze" },
          ].map(({ index, label }) => {
            const row = available ? view.podium[index] : undefined;
            const target = available && index > 0 ? view.podium[index - 1] : undefined;
            return (
              <AnalyticsCard
                key={label}
                className={styles.podiumEntry}
                density="compact"
                aria-label={`${label}: ${row?.name ?? (available ? "Sem posição" : "Indisponível")}`}
              >
                <h3>
                  <Medal size={22} aria-hidden="true" />
                  {label}
                </h3>
                <strong>{row?.name ?? (available ? "Sem posição" : "Indisponível")}</strong>
                <dl>
                  <div>
                    <dt>VGV</dt>
                    <dd>{row ? formatRankingMoney(row.vgvCents) : "Indisponível"}</dd>
                  </div>
                  <div>
                    <dt>Contratos</dt>
                    <dd>{row ? row.contracts.toLocaleString("pt-BR") : "Indisponível"}</dd>
                  </div>
                  <div>
                    <dt>Próximo alvo</dt>
                    <dd>{row ? (target?.name ?? "Liderança") : "Indisponível"}</dd>
                  </div>
                  <div>
                    <dt>Diferença ao alvo</dt>
                    <dd>
                      {row?.gapToPreviousCents !== undefined && row.gapToPreviousCents !== null
                        ? formatRankingMoney(row.gapToPreviousCents)
                        : row
                          ? "Não se aplica"
                          : "Indisponível"}
                    </dd>
                  </div>
                </dl>
              </AnalyticsCard>
            );
          })}
        </div>
      </section>
      <section className={styles.rankingSection} aria-labelledby="ranking-table-title">
        <SectionHeading id="ranking-table-title" title={title} density="compact" />
        <AnalyticsTable
          caption={title}
          captionVisible={false}
          rows={available ? view.rows.slice(0, 10) : []}
          columns={columns}
          rowKey={(row) => row.key}
          density="compact"
          emptyState={
            <p className={styles.tableState}>
              {!available
                ? "Resultados indisponíveis."
                : view.status === "empty"
                  ? "Nenhum registro no período."
                  : "Nenhum resultado para a busca."}
            </p>
          }
        />
        <dl className={styles.summary} aria-label={`Resumo de ${kindLabel}`}>
          <div>
            <dt>VGV total</dt>
            <dd>{available ? formatRankingMoney(view.totals.vgvCents) : "Indisponível"}</dd>
          </div>
          <div>
            <dt>Total de contratos</dt>
            <dd>{available ? view.totals.contracts.toLocaleString("pt-BR") : "Indisponível"}</dd>
          </div>
          <div>
            <dt>{isImob ? "Imobiliárias representadas" : "Empreendimentos representados"}</dt>
            <dd>{available ? view.totals.entities.toLocaleString("pt-BR") : "Indisponível"}</dd>
          </div>
        </dl>
      </section>
    </ManagementPage>
  );
}
