import "server-only";

import type { AuthorizationContext } from "@/lib/authorization/types";

import {
  OFFICIAL_SIMULATOR_SLUGS,
  isOfficialSimulatorKey,
  officialSimulatorIsImplemented,
  type OfficialSimulatorKey,
  type OfficialSimulatorSlug,
} from "./catalog";

export type OfficialSimulatorRuntimeConfiguration =
  | { mode: "off"; enabledKeys: readonly [] }
  | { mode: "active"; enabledKeys: readonly OfficialSimulatorKey[] };

type RuntimeEnvironment = {
  OFFICIAL_SIMULATOR_RUNTIME_MODE?: string;
  OFFICIAL_SIMULATOR_ENABLED_KEYS?: string;
};

function parseEnabledKeys(value: string | undefined): OfficialSimulatorKey[] | null {
  if (!value?.trim()) return [];

  const supplied = value.split(",").map((item) => item.trim());
  if (supplied.some((item) => !item) || new Set(supplied).size !== supplied.length) return null;
  if (supplied.some((item) => !isOfficialSimulatorKey(item))) return null;
  return supplied as OfficialSimulatorKey[];
}

export function getOfficialSimulatorRuntimeConfiguration(
  environment?: RuntimeEnvironment,
): OfficialSimulatorRuntimeConfiguration {
  const runtimeEnvironment = environment ?? process.env;
  if (runtimeEnvironment.OFFICIAL_SIMULATOR_RUNTIME_MODE?.trim() !== "active") {
    return { mode: "off", enabledKeys: [] };
  }

  const enabledKeys = parseEnabledKeys(runtimeEnvironment.OFFICIAL_SIMULATOR_ENABLED_KEYS);
  if (!enabledKeys?.length) return { mode: "off", enabledKeys: [] };
  return { mode: "active", enabledKeys };
}

export function officialSimulatorIsEnabled(
  configuration: OfficialSimulatorRuntimeConfiguration,
  engineKey: OfficialSimulatorKey,
): boolean {
  return configuration.mode === "active" && configuration.enabledKeys.includes(engineKey);
}

export function officialSimulatorRuntimeIsEnabled(
  configuration: OfficialSimulatorRuntimeConfiguration,
  slug: OfficialSimulatorSlug,
): boolean {
  return (
    officialSimulatorIsImplemented(slug) &&
    officialSimulatorIsEnabled(configuration, OFFICIAL_SIMULATOR_SLUGS[slug])
  );
}

export function officialSimulatorExecutionIsEnabled(
  configuration: OfficialSimulatorRuntimeConfiguration,
  slug: OfficialSimulatorSlug,
  authorization: AuthorizationContext,
): boolean {
  return (
    officialSimulatorRuntimeIsEnabled(configuration, slug) &&
    authorization.roleKey === "master" &&
    authorization.permissions.includes("crm.simulators.execute")
  );
}
