export interface SourcePin {
  readonly name: string;
  readonly sha256: string;
}
export interface LoadedSource extends SourcePin {
  bytes: Buffer;
}
/** query is one DO statement, safe to submit unchanged in autocommit; history is separate. */
export interface Activation {
  name: string;
  transactionOwner: "PostgreSQL single DO statement";
  query: string;
  sha256: string;
}
export const SOURCES: readonly SourcePin[];
export const TABLES: readonly string[];
export function digest(bytes: string | Buffer): string;
export function statements(sql: string): { start: number; end: number; tokens: string[] }[];
export function stripOuterTransaction(sql: string): string;
export function loadSources(directory?: string): Promise<LoadedSource[]>;
export function combineSources(loaded: unknown): string;
export const snapshotSql: string;
export function buildActivation(loaded: unknown, expectedSnapshot: unknown): Activation;
export const verificationPlan: Readonly<{
  authority: string;
  backupAndCas: string[];
  prechecks: string[];
  postchecks: string[];
  localRehearsal: string[];
  limitations: string;
}>;
export function buildRollbackRehearsal(
  loaded: unknown,
  expectedSnapshot: unknown,
): {
  fixtureSql: string;
  /** Execute unchanged in autocommit, with no outer BEGIN or ROLLBACK. */
  query: string;
  expectedSqlState: string;
  verifyRollbackSql: string;
  instructions: string;
};
