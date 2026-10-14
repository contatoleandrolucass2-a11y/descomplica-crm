export function transformProductionImageEnvironment(
  contents: string,
  expectedOldSha: string,
  newSha: string,
): string;

export type EnvironmentChange = Readonly<{
  backupId: string;
  beforeSha256: string;
  afterSha256: string;
}>;

export function readValidatedEnvironment(): Promise<string>;
export function verifyReleaseBoundary(boundarySha: string): Promise<void>;
export function verifyPromotableImage(sha: string, imageId: string): Promise<void>;
export function bindProductionImage(
  options: {
    expectedCurrentSha: string;
    targetSha: string;
    boundarySha: string;
    expectedImageId: string;
    environmentChange?: EnvironmentChange;
    restoreEnvironment?: true;
  },
  lock: object,
  beforeWrite: () => Promise<void>,
): Promise<void>;

export function parseProductionImageBindingArguments(arguments_: readonly string[]): Readonly<{
  operation: "bind" | "rollback";
  expectedCurrentSha: string;
  targetSha: string;
  boundarySha: string;
  expectedImageId: string;
}>;
