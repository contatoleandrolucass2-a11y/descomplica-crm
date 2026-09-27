import type { FileHandle } from "node:fs/promises";

export type BackupSourceSpecification = Readonly<{
  file: string;
  symlinkTargetRoot?: string;
  expectedUid?: number;
  allowedGids?: readonly number[];
  expectedMode?: number;
}>;

export type BackupOwnerBoundary = Readonly<{
  expectedUid?: number;
  expectedGid?: number;
}>;

export type SerializedSecurityContract = Readonly<{
  serialized: string;
  sha256: string;
}>;

export function assertExactSecurityContract(
  expected: SerializedSecurityContract,
  actual: SerializedSecurityContract,
  label: string,
): string;

export function collectRequiredConfigurationSources(
  specifications?: readonly BackupSourceSpecification[],
  boundary?: BackupOwnerBoundary,
): Promise<readonly string[]>;

export function openPrivateBackupParent(
  directory: string,
  boundary?: BackupOwnerBoundary,
): Promise<FileHandle>;

export function finalizeBackupDurability(
  files: readonly string[],
  backupRoot: string,
  backupParentHandle: FileHandle,
): Promise<void>;

export function assertHeadBoundBytes(
  input: Readonly<{
    label: string;
    loaded: Buffer;
    committed: Buffer;
    expectedSha256?: string;
  }>,
): Readonly<{ bytes: number; sha256: string }>;

export function buildRestoreRolePreparationSql(
  contract: Readonly<{
    value: Readonly<{
      roles: readonly unknown[];
      memberships: readonly unknown[];
    }>;
    passwordVerifiers: readonly Readonly<{
      name: string;
      verifier: string | null;
    }>[];
  }>,
): string;

export function buildRestoreDatabaseBoundarySql(
  contract: Readonly<{
    value: Readonly<{
      database: unknown;
    }>;
  }>,
  databaseName: string,
): string;
