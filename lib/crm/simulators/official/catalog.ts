import type { CommercialEngineKey } from "@/lib/crm/commercial-engine/catalog";

export const OFFICIAL_SIMULATOR_KEYS = [
  "simulator.wf13",
  "simulator.wf16",
  "simulator.caixa",
  "simulator.wf14",
  "simulator.wf15",
] as const satisfies readonly CommercialEngineKey[];

export type OfficialSimulatorKey = (typeof OFFICIAL_SIMULATOR_KEYS)[number];

export const OFFICIAL_SIMULATOR_SLUGS = {
  "associativo-fluxo-linear": "simulator.wf13",
  "calcular-documentacao": "simulator.wf16",
  caixa: "simulator.caixa",
  "tabela-direta": "simulator.wf14",
  "tabela-investidor": "simulator.wf15",
} as const satisfies Record<string, OfficialSimulatorKey>;

export type OfficialSimulatorSlug = keyof typeof OFFICIAL_SIMULATOR_SLUGS;

export const IMPLEMENTED_OFFICIAL_SIMULATORS = [
  "associativo-fluxo-linear",
  "calcular-documentacao",
  "caixa",
  "tabela-direta",
  "tabela-investidor",
] as const satisfies readonly OfficialSimulatorSlug[];

export function isOfficialSimulatorKey(value: string): value is OfficialSimulatorKey {
  return (OFFICIAL_SIMULATOR_KEYS as readonly string[]).includes(value);
}

export function isOfficialSimulatorSlug(value: string): value is OfficialSimulatorSlug {
  return Object.prototype.hasOwnProperty.call(OFFICIAL_SIMULATOR_SLUGS, value);
}

export function officialSimulatorIsImplemented(slug: OfficialSimulatorSlug): boolean {
  return (IMPLEMENTED_OFFICIAL_SIMULATORS as readonly string[]).includes(slug);
}
