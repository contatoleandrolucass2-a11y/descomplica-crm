export type PeriodComparisonRow = {
  label: string;
  previousLabel: string;
  previous: number | null;
  currentLabel: string;
  current: number;
  goal?: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100)}%`;
}

function variation(previous: number | null, current: number) {
  if (previous === null) return { label: "—", tone: "neutral" };
  if (previous === 0 && current > 0) return { label: "Novo", tone: "positive" };
  if (previous === 0) return { label: "0,0%", tone: "neutral" };
  const rate = (current - previous) / previous;
  return {
    label: `${rate > 0 ? "+" : ""}${formatPercent(rate)}`,
    tone: rate > 0 ? "positive" : rate < 0 ? "negative" : "neutral",
  };
}

export function PeriodComparisonTable({
  rows,
  label,
}: {
  rows: PeriodComparisonRow[];
  label: string;
}) {
  return (
    <div className="comparison-table-wrap">
      <div className="comparison-table" role="table" aria-label={label}>
        <div className="comparison-row comparison-head" role="row">
          <span role="columnheader">Comparativo</span>
          <span role="columnheader">Realizado anterior</span>
          <span role="columnheader">Realizado atual</span>
          <span role="columnheader">Variação</span>
          <span role="columnheader">Meta atual</span>
          <span role="columnheader">% da meta</span>
        </div>
        {rows.map((row) => {
          const delta = variation(row.previous, row.current);
          const goalRate = row.goal && row.goal > 0 ? row.current / row.goal : null;
          return (
            <div className="comparison-row" role="row" key={row.label}>
              <strong role="cell">{row.label}</strong>
              <span className="comparison-value" role="cell">
                <small>{row.previousLabel}</small>
                <b>{row.previous === null ? "—" : formatNumber(row.previous)}</b>
              </span>
              <span className="comparison-value current" role="cell">
                <small>{row.currentLabel}</small>
                <b>{formatNumber(row.current)}</b>
              </span>
              <span className={`comparison-delta ${delta.tone}`} role="cell">
                {delta.label}
              </span>
              <span role="cell">{row.goal && row.goal > 0 ? formatNumber(row.goal) : "—"}</span>
              <span className={goalRate === null ? "muted-rate" : "rate"} role="cell">
                {goalRate === null ? "—" : formatPercent(goalRate)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
