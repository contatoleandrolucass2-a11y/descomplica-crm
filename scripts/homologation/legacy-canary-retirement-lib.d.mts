export type RetirementMode = "dry-run" | "apply" | "verify";

export type PinnedHistoryMigration = Readonly<{
  version: string;
  name: string;
  statementCount: 1;
  sha256: string;
}>;

export type RetirementCandidate = Readonly<{
  version: string;
  name: string;
  file: string;
  sha256: string;
}>;

export type RetirementAllowlist = Readonly<{
  schemaVersion: 1;
  environment: "isolated-homologation";
  scope: "legacy-canary-retirement";
  productionEligible: false;
  beforePageCount: 24;
  afterPageCount: 17;
  beforePageCatalogSha256: string;
  afterPageCatalogSha256: string;
  baselineVersions: readonly string[];
  pinnedHistory: readonly PinnedHistoryMigration[];
  candidate: RetirementCandidate;
}>;

export type LoadedRetirementCandidate = RetirementCandidate & { contents: Buffer };

export type RetirementHistoryRow = {
  version: string;
  name?: string;
  statement_count?: number;
  sha256?: string;
};

export function validateRetirementAllowlist(rawManifest: unknown): RetirementAllowlist;
export function requiresRetirementRuntimeShutdown(mode: RetirementMode): boolean;
export function validateRetirementRuntimeEnvironment(contents: string): Readonly<{
  runtimeMode: "off";
  enabledModules: readonly [];
}>;
export function validateStoppedRetirementAppInspection(output: string): Readonly<{
  name: "/descomplica-homologation-app";
  status: "exited";
}>;
export function loadRetirementCandidate(
  repositoryRoot: string,
  manifest: RetirementAllowlist,
): Promise<LoadedRetirementCandidate>;
export function expectedRetirementHistory(
  manifest: RetirementAllowlist,
  mode: RetirementMode,
): string[];
export function validateRetirementHistory(
  manifest: RetirementAllowlist,
  mode: RetirementMode,
  historyRows: RetirementHistoryRow[],
): { historyCount: number; pendingVersions: string[] };
export function validateRetirementBackupProof(
  rawProof: unknown,
  context: {
    expectedSha: string;
    expectedBackupId: string;
    expectedAllowlistSha256: string;
    manifest: RetirementAllowlist;
    now?: number;
  },
): { backupId: string; artifacts: readonly unknown[] };
export function buildRetirementPreconditionsSql(manifest: RetirementAllowlist): string;
export function buildRetirementPostconditionsSql(manifest: RetirementAllowlist): string;
export function buildRetirementApplicationSql(
  manifest: RetirementAllowlist,
  candidate: LoadedRetirementCandidate,
): string;
