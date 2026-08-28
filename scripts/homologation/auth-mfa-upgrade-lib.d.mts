export type UpgradeMode = "dry-run" | "apply" | "verify";

export type MigrationCandidate = Readonly<{
  version: string;
  name: string;
  file: string;
  sha256: string;
}>;

export type UpgradeAllowlist = Readonly<{
  schemaVersion: 1;
  environment: "isolated-homologation";
  baselineVersions: readonly string[];
  nonDeployableRepositoryVersions: readonly string[];
  candidates: readonly MigrationCandidate[];
}>;

export type LoadedMigrationCandidate = MigrationCandidate & {
  contents: Buffer;
};

export type MigrationHistoryRow = {
  version: string;
  name?: string;
  statement_count?: number;
  sha256?: string;
};

export type BackupArtifactKind = "database" | "migration-history" | "configuration" | "image";

export type BackupArtifact = Readonly<{
  file: string;
  kind: BackupArtifactKind;
  bytes: number;
  sha256: string;
}>;

export type ValidatedBackupProof = Readonly<{
  backupId: string;
  artifacts: readonly BackupArtifact[];
}>;

export function sha256(contents: string | Buffer): string;
export function sha256File(filePath: string): Promise<string>;
export function validateBackupProof(
  rawProof: unknown,
  context: {
    expectedSha: string;
    expectedBackupId: string;
    expectedHistoryCount: number;
    now?: number;
  },
): ValidatedBackupProof;
export function validateAllowlist(rawManifest: unknown): UpgradeAllowlist;
export function loadCandidateFiles(
  repositoryRoot: string,
  manifest: UpgradeAllowlist,
): Promise<LoadedMigrationCandidate[]>;
export function expectedHistoryForMode(manifest: UpgradeAllowlist, mode: UpgradeMode): string[];
export function validateHistoryState(
  manifest: UpgradeAllowlist,
  mode: UpgradeMode,
  historyRows: MigrationHistoryRow[],
): { historyCount: number; pendingVersions: string[] };
export const postconditionsSql: string;
export function buildApplicationSql(
  manifest: UpgradeAllowlist,
  loadedCandidates: LoadedMigrationCandidate[],
): string;
