import "server-only";

import { createClient } from "@/lib/auth/supabase/server";
import { PAGE_REGISTRY } from "@/lib/navigation/registry";
import { isDashboardProfileCatalogPageKey } from "./catalog";
import type { DashboardProfileCreate, DashboardProfilePatch } from "./schema";
import {
  dashboardProfileDeleteResultSchema,
  dashboardProfileRecordSchema,
  dashboardProfilesRecordSchema,
} from "./schema";

export interface DashboardProfileServiceResult<T> {
  data: T | null;
  error: { code?: string | null } | null;
}

export function dashboardPagePath(pageKey: string): string | null {
  if (!isDashboardProfileCatalogPageKey(pageKey)) return null;
  return (
    PAGE_REGISTRY.find((page) => page.releaseEnabled && page.pageKey === pageKey)?.path ?? null
  );
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  return supabase.rpc(name, args);
}

function invalidResult<T>(): DashboardProfileServiceResult<T> {
  return { data: null, error: { code: "INVALID_RPC_RESPONSE" } };
}

export async function listDashboardProfiles(
  pageKey: string,
  scopeKey: string | null,
): Promise<DashboardProfileServiceResult<ReturnType<typeof dashboardProfilesRecordSchema.parse>>> {
  const result = await rpc("get_dashboard_profiles", {
    p_page_key: pageKey,
    p_scope_key: scopeKey,
  });
  if (result.error) return { data: null, error: result.error };
  const parsed = dashboardProfilesRecordSchema.safeParse(result.data);
  return parsed.success ? { data: parsed.data, error: null } : invalidResult();
}

export async function getDashboardProfile(
  profileId: string,
): Promise<DashboardProfileServiceResult<ReturnType<typeof dashboardProfileRecordSchema.parse>>> {
  const result = await rpc("get_dashboard_profile", { p_profile_id: profileId });
  if (result.error) return { data: null, error: result.error };
  const parsed = dashboardProfileRecordSchema.safeParse(result.data);
  return parsed.success ? { data: parsed.data, error: null } : invalidResult();
}

export async function createDashboardProfile(
  input: DashboardProfileCreate,
): Promise<DashboardProfileServiceResult<ReturnType<typeof dashboardProfileRecordSchema.parse>>> {
  const result = await rpc("create_dashboard_profile", {
    p_page_key: input.pageKey,
    p_scope_key: input.scopeKey,
    p_name: input.name,
    p_cards: input.cards,
    p_schema_version: input.schemaVersion,
    p_is_default: input.isDefault,
  });
  if (result.error) return { data: null, error: result.error };
  const parsed = dashboardProfileRecordSchema.safeParse(result.data);
  return parsed.success ? { data: parsed.data, error: null } : invalidResult();
}

export async function updateDashboardProfile(
  profileId: string,
  input: DashboardProfilePatch,
): Promise<DashboardProfileServiceResult<ReturnType<typeof dashboardProfileRecordSchema.parse>>> {
  const result = await rpc("update_dashboard_profile", {
    p_profile_id: profileId,
    p_expected_version: input.version,
    p_name: input.name ?? null,
    p_cards: input.cards ?? null,
    p_schema_version: input.schemaVersion ?? null,
  });
  if (result.error) return { data: null, error: result.error };
  const parsed = dashboardProfileRecordSchema.safeParse(result.data);
  return parsed.success ? { data: parsed.data, error: null } : invalidResult();
}

export async function setDefaultDashboardProfile(
  profileId: string,
  version: number,
): Promise<DashboardProfileServiceResult<ReturnType<typeof dashboardProfileRecordSchema.parse>>> {
  const result = await rpc("set_default_dashboard_profile", {
    p_profile_id: profileId,
    p_expected_version: version,
  });
  if (result.error) return { data: null, error: result.error };
  const parsed = dashboardProfileRecordSchema.safeParse(result.data);
  return parsed.success ? { data: parsed.data, error: null } : invalidResult();
}

export async function deleteDashboardProfile(
  profileId: string,
  version: number,
): Promise<
  DashboardProfileServiceResult<ReturnType<typeof dashboardProfileDeleteResultSchema.parse>>
> {
  const result = await rpc("delete_dashboard_profile", {
    p_profile_id: profileId,
    p_expected_version: version,
  });
  if (result.error) return { data: null, error: result.error };
  const parsed = dashboardProfileDeleteResultSchema.safeParse(result.data);
  return parsed.success ? { data: parsed.data, error: null } : invalidResult();
}
