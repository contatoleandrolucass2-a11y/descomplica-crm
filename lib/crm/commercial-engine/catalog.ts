import type { PermissionKey } from "@/lib/authorization/permissions";

export const COMMERCIAL_ENGINE_KEYS = [
  "simulator.wf13",
  "simulator.wf14",
  "simulator.wf15",
  "simulator.wf16",
  "simulator.caixa",
  "goals.dv",
  "goals.partnerships",
  "points.ranking",
  "ranking.broker",
  "ranking.manager",
  "sla.loss",
  "roulette.eligibility",
  "campaign.eligibility",
  "awards.calculation",
] as const;

export type CommercialEngineKey = (typeof COMMERCIAL_ENGINE_KEYS)[number];
export type CommercialEngineDomain =
  | "simulator"
  | "goals"
  | "points"
  | "ranking"
  | "sla"
  | "roulette"
  | "campaign"
  | "awards";

export type CommercialEngineDescriptor = {
  domain: CommercialEngineDomain;
  requiredPermission: PermissionKey;
  interactive: boolean;
};

export const COMMERCIAL_ENGINE_CATALOG: Record<CommercialEngineKey, CommercialEngineDescriptor> = {
  "simulator.wf13": {
    domain: "simulator",
    requiredPermission: "crm.simulators.execute",
    interactive: true,
  },
  "simulator.wf14": {
    domain: "simulator",
    requiredPermission: "crm.simulators.execute",
    interactive: true,
  },
  "simulator.wf15": {
    domain: "simulator",
    requiredPermission: "crm.simulators.execute",
    interactive: true,
  },
  "simulator.wf16": {
    domain: "simulator",
    requiredPermission: "crm.simulators.execute",
    interactive: true,
  },
  "simulator.caixa": {
    domain: "simulator",
    requiredPermission: "crm.simulators.execute",
    interactive: true,
  },
  "goals.dv": {
    domain: "goals",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "goals.partnerships": {
    domain: "goals",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "points.ranking": {
    domain: "points",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "ranking.broker": {
    domain: "ranking",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "ranking.manager": {
    domain: "ranking",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "sla.loss": {
    domain: "sla",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "roulette.eligibility": {
    domain: "roulette",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "campaign.eligibility": {
    domain: "campaign",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
  "awards.calculation": {
    domain: "awards",
    requiredPermission: "crm.commercial_engine.execute",
    interactive: false,
  },
};

export function isCommercialEngineKey(value: string): value is CommercialEngineKey {
  return Object.prototype.hasOwnProperty.call(COMMERCIAL_ENGINE_CATALOG, value);
}

export const SIMULATOR_ENGINE_KEYS = {
  "associativo-fluxo-linear": "simulator.wf13",
  "calcular-documentacao": "simulator.wf16",
  caixa: "simulator.caixa",
  "tabela-direta": "simulator.wf14",
  "tabela-investidor": "simulator.wf15",
} as const satisfies Record<string, CommercialEngineKey>;
