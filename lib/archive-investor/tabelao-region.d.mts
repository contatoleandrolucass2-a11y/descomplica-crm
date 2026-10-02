export type TabelaoRegionName = "Centro" | "Zona Norte" | "Zona Sul" | "Zona Leste" | "Zona Oeste";

export type TabelaoRegionResolution = {
  postalCode: string;
  region: TabelaoRegionName | null;
  status: "confirmed" | "unconfirmed" | "outside-city";
  reason: string;
  municipality: string | null;
  state: string | null;
  districts: string[];
  checkedAt: string;
  source: "viacep+localizasampa+geosampa";
};

export interface TabelaoRegionItem {
  postalCode?: unknown;
  city?: unknown;
  state?: unknown;
  regionResolution?: unknown;
  regionLookupPending?: boolean;
}

export function normalizeTabelaoPostalCode(value: unknown): string | null;
export function parseTabelaoRegionResolution(
  value: unknown,
  expectedPostalCode: unknown,
): TabelaoRegionResolution | null;
export function resolveTabelaoRegion(
  item: TabelaoRegionItem | null | undefined,
):
  | TabelaoRegionName
  | "Fora de S\u00e3o Paulo"
  | "Localizando"
  | "Localiza\u00e7\u00e3o indispon\u00edvel";
export function formatTabelaoRegionTitle(item: TabelaoRegionItem | null | undefined): string;
export function fetchTabelaoRegion(
  postalCode: unknown,
  signal: AbortSignal,
): Promise<TabelaoRegionResolution>;
export function fetchTabelaoRegions(
  postalCodes: readonly unknown[],
  signal: AbortSignal,
): Promise<TabelaoRegionResolution[]>;
export function loadTabelaoRegions(
  postalCodes: readonly unknown[],
  signal: AbortSignal,
  onResolution: (postalCode: string, resolution: TabelaoRegionResolution | null) => void,
): Promise<void>;
