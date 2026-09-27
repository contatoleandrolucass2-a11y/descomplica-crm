export type OfficialSimulatorRuntimeEnvironment = Readonly<{
  enabledKeys: string;
  mode: "active" | "off";
}>;

export function parseOfficialSimulatorRuntime(
  contents?: string,
): OfficialSimulatorRuntimeEnvironment;

export type LegacyMigrationRuntimeEnvironment = Readonly<{
  enabledModules: string;
  mode: "active" | "off";
}>;

export function parseLegacyMigrationRuntime(contents?: string): LegacyMigrationRuntimeEnvironment;
