export const GOALS_UNAVAILABLE_LABEL = "Fonte não configurada";
export const DATA_UNAVAILABLE_LABEL = "Dados indisponíveis";

export function availableCommercialValue<T>(available: boolean, value: T): T | null {
  return available ? value : null;
}
