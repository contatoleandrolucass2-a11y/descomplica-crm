export const WEEKEND_FORECAST_BROKERS = [
  "Guilherme",
  "Fabiana",
  "Miqueas",
  "Gislaine",
  "Andreia",
  "Ana",
  "Gian",
  "Vinicius",
  "Talita",
];

export const WEEKEND_FORECAST_GROUPS = {
  visits: {
    label: "Visitas",
    singular: "visita",
    developments: ["Marechal Tito", "Sapopemba", "Santana", "Raposo Shopping", "Cursino"],
  },
  sales: {
    label: "Vendas",
    singular: "venda",
    developments: [
      "Itaim Paulista",
      "Prisma - Sapopemba",
      "São Miguel",
      "Butantã",
      "Esmeraldas",
      "Sacomã",
      "Liveiro",
      "Raiz",
    ],
  },
};

export function normalizeWeekStart(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function forecastCellKey(metric, broker, development) {
  return `${metric}\u0000${broker}\u0000${development}`;
}

export function buildWeekendForecastEntries() {
  return Object.entries(WEEKEND_FORECAST_GROUPS).flatMap(([metric, group]) =>
    WEEKEND_FORECAST_BROKERS.flatMap((broker) =>
      group.developments.map((development) => ({
        metric,
        broker,
        development,
        forecast: 0,
        realized: 0,
      })),
    ),
  );
}

export function summarizeWeekendForecast(entries, metric) {
  return entries.reduce(
    (summary, entry) => {
      if (entry.metric !== metric) return summary;
      summary.forecast += Number(entry.forecast) || 0;
      summary.realized += Number(entry.realized) || 0;
      return summary;
    },
    { forecast: 0, realized: 0 },
  );
}
