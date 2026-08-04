export const RANKING_PERIODS = {
  month: { label: "Mês atual" },
  last_week: { label: "Semana passada" },
  week: { label: "Esta semana" },
  today: { label: "Hoje" },
} as const;

export const RANKING_SCOPES = {
  brokers: { label: "Corretores", description: "Desempenho individual" },
  managers: { label: "Gerentes", description: "Resultado consolidado das equipes" },
} as const;

export type RankingPeriodKey = keyof typeof RANKING_PERIODS;
export type RankingScopeKey = keyof typeof RANKING_SCOPES;

export function isRankingPeriod(value: unknown): value is RankingPeriodKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RANKING_PERIODS, value);
}

export function isRankingScope(value: unknown): value is RankingScopeKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RANKING_SCOPES, value);
}
