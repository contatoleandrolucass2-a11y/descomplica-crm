export const LEGACY_MIGRATION_MODULE_KEYS = [
  "simulator.wf16",
  "simulator.caixa",
  "simulator.wf14",
  "simulator.wf15",
  "simulator.tabelao",
  "dialer",
  "dialer.weekend-forecast",
] as const;

export type LegacyMigrationModuleKey = (typeof LEGACY_MIGRATION_MODULE_KEYS)[number];

type RuntimeEnvironment = {
  [key: string]: string | undefined;
  LEGACY_MIGRATION_RUNTIME_MODE?: string;
  LEGACY_MIGRATION_ENABLED_MODULES?: string;
};

export type LegacyMigrationRuntimeConfiguration =
  | { mode: "off"; enabledModules: readonly [] }
  | { mode: "active"; enabledModules: readonly LegacyMigrationModuleKey[] };

function isModuleKey(value: string): value is LegacyMigrationModuleKey {
  return (LEGACY_MIGRATION_MODULE_KEYS as readonly string[]).includes(value);
}

export function getLegacyMigrationRuntimeConfiguration(
  environment: RuntimeEnvironment = process.env,
): LegacyMigrationRuntimeConfiguration {
  if (environment.LEGACY_MIGRATION_RUNTIME_MODE?.trim() !== "active") {
    return { mode: "off", enabledModules: [] };
  }

  const supplied = (environment.LEGACY_MIGRATION_ENABLED_MODULES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    supplied.length === 0 ||
    new Set(supplied).size !== supplied.length ||
    supplied.some((value) => !isModuleKey(value))
  ) {
    return { mode: "off", enabledModules: [] };
  }

  return { mode: "active", enabledModules: supplied as LegacyMigrationModuleKey[] };
}

export function legacyMigrationModuleIsEnabled(
  moduleKey: LegacyMigrationModuleKey,
  environment: RuntimeEnvironment = process.env,
): boolean {
  const configuration = getLegacyMigrationRuntimeConfiguration(environment);
  return configuration.mode === "active" && configuration.enabledModules.includes(moduleKey);
}
