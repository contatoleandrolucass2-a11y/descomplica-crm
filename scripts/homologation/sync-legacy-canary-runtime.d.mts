export function buildLegacyCanaryRuntimeManifest(
  previous: unknown,
  sourceSha: string,
): {
  schemaVersion: 1;
  environment: "isolated-homologation";
  sourceSha: string;
  dataClassification: "synthetic-only";
};
