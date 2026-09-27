export type RuntimeReleaseManifest = Readonly<{
  dataClassification: "synthetic-only";
  environment: "isolated-homologation";
  schemaVersion: 1;
  sourceSha: string;
  [key: string]: unknown;
}>;

export function transformRuntimeReleaseManifest(contents: string, expectedSha: string): string;
