export type OfficialSimulatorRuntimeEnvironment = Readonly<{
  enabledKeys: string;
  mode: "active" | "off";
}>;

export function parseOfficialSimulatorRuntime(
  contents?: string,
): OfficialSimulatorRuntimeEnvironment;
