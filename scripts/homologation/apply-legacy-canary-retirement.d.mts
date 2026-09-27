export type RetirementCommandArguments = Readonly<{
  mode: "dry-run" | "apply" | "verify";
  expectedSha: string;
  backupManifest: string | null;
}>;

export function parseRetirementArguments(arguments_: readonly string[]): RetirementCommandArguments;
