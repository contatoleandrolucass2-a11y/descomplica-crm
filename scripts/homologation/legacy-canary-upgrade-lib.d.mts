export interface LegacyCanaryMigrationRow {
  version: string;
  name?: string;
  statement_count?: number;
  sha256?: string | null;
}

export interface LegacyCanaryManifest {
  schemaVersion: 1;
  environment: "isolated-homologation";
  baselineVersions: readonly string[];
  nonDeployableRepositoryVersions: readonly string[];
  foundationCandidates: readonly Readonly<{ version: string; name: string; sha256: string }>[];
  candidate: Readonly<{ version: string; name: string; file: string; sha256: string }>;
}

export function validateLegacyCanaryAllowlist(value: unknown): LegacyCanaryManifest;
export function loadLegacyCanaryCandidate(
  repositoryRoot: string,
  manifest: LegacyCanaryManifest,
): Promise<LegacyCanaryManifest["candidate"] & { contents: Buffer }>;
export function validateLegacyCanaryHistory(
  manifest: LegacyCanaryManifest,
  mode: "dry-run" | "apply" | "verify",
  rows: LegacyCanaryMigrationRow[],
): { historyCount: number; pendingVersions: string[] };
export const legacyCanaryPostconditionsSql: string;
export function buildLegacyCanaryApplicationSql(
  manifest: LegacyCanaryManifest,
  candidate: LegacyCanaryManifest["candidate"] & { contents: Buffer },
): string;
