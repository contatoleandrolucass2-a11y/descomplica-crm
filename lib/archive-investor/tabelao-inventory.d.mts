export interface TabelaoInventoryItem {
  id?: string;
  businessUnit?: string | null;
  project?: string | null;
  product?: string | null;
  identifier?: string | null;
  plant?: string | null;
  finalPrice?: number | null;
  neighborhood?: string | null;
  district?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

export interface TabelaoExclusiveFields {
  project: string;
  plant: string;
  exclusiveKey: string;
  availableUnits: number;
}

export interface TabelaoFilters {
  query?: string;
  businessUnit?: string;
  project?: string;
  plant?: string;
  region?: string;
  priceRange?: string;
}

export interface TabelaoOptions {
  businessUnits: string[];
  projects: string[];
  plants: string[];
  regions: string[];
}

export interface TabelaoSummary {
  exclusiveOptions: number;
  projects: number;
  plants: number;
  minimumPrice: number | null;
  maximumPrice: number | null;
}

export const TABELAO_PRICE_RANGES: ReadonlyArray<{ value: string; label: string }>;

export function buildTabelaoExclusiveInventory<T extends TabelaoInventoryItem>(
  items: readonly T[],
): Array<T & TabelaoExclusiveFields>;

export function matchesTabelaoFilters(
  item: TabelaoInventoryItem,
  filters?: TabelaoFilters,
): boolean;

export function sortTabelaoInventory<T extends TabelaoInventoryItem>(
  items: readonly T[],
  order?: string,
): T[];

export function buildTabelaoOptions(items: readonly TabelaoInventoryItem[]): TabelaoOptions;

export function summarizeTabelao(items: readonly TabelaoInventoryItem[]): TabelaoSummary;
