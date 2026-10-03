import type { TabelaoInventoryItem } from "./tabelao-inventory.mjs";

export function formatTabelaoDescription(value?: string | null): string;
export function formatTabelaoPlant(value?: string | null): string;
export function formatTabelaoAddress(item: Readonly<TabelaoInventoryItem>): string;
export function buildTabelaoMapsUrl(item: Readonly<TabelaoInventoryItem>): string | null;
