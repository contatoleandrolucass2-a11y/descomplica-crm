export interface TabelaoInventoryItem {
  id?: string;
  businessUnit?: string | null;
  project?: string | null;
  product?: string | null;
  identifier?: string | null;
  plant?: string | null;
  finalPrice?: number | null;
  finalWithKit?: number | null;
  unitBonus?: number | null;
  tableSlack?: number | null;
  privateArea?: number | null;
  neighborhood?: string | null;
  district?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

export interface TabelaoExclusiveFields {
  businessUnit: string;
  project: string;
  plant: string;
  minimumPrice: number;
  exclusiveKey: string;
  availableUnits: number;
  pricedUnits: number;
}

export function groupTabelaoInventoryByProject<T extends TabelaoInventoryItem>(
  items: readonly T[],
): Array<{
  key: string;
  businessUnit: T["businessUnit"];
  project: T["project"];
  startIndex: number;
  items: T[];
}>;

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

export function calculateTabelaoPrice(item: TabelaoInventoryItem): number | null;

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

export type TabelaoFilterDimension = "businessUnit" | "project" | "region" | "plant" | "price";
export type TabelaoFacetFilters = Record<TabelaoFilterDimension, string>;
export const TABELAO_FILTER_DEFAULTS: Readonly<TabelaoFacetFilters>;
export interface TabelaoFacet {
  total: number;
  options: Array<{ value: string; label: string; count: number }>;
}
export function matchesTabelaoFacets(
  item: TabelaoInventoryItem,
  filters: TabelaoFacetFilters,
  ignoredDimension?: TabelaoFilterDimension | null,
): boolean;
export function buildTabelaoFacets(
  items: readonly TabelaoInventoryItem[],
  filters: TabelaoFacetFilters,
): Record<TabelaoFilterDimension, TabelaoFacet>;
