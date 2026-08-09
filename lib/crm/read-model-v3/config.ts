import "server-only";

interface ReadModelV3Environment {
  CRM_READ_MODEL_V3_SHADOW_ENABLED?: string | undefined;
}

export function isReadModelV3ShadowEnabled(
  environment: ReadModelV3Environment = {
    CRM_READ_MODEL_V3_SHADOW_ENABLED: process.env.CRM_READ_MODEL_V3_SHADOW_ENABLED,
  },
): boolean {
  return environment.CRM_READ_MODEL_V3_SHADOW_ENABLED?.trim().toLowerCase() === "true";
}
