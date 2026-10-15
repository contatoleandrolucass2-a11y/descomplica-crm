import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { canManageTargetRole } from "@/lib/authorization/hierarchy";
import type { AuthorizationContext } from "@/lib/authorization/types";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { ROLES, type RoleKey } from "@/lib/authorization/roles";

import type {
  LoadUsersPageInput,
  ManagedUser,
  UserDirectoryPage,
  UserDirectoryStatusFilter,
  UserDirectorySummary,
  UserPermissionOverride,
} from "./user-directory-types";

export const USER_DIRECTORY_PAGE_SIZE = 6;

const profileSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  access_status: z.enum(["pending", "approved", "suspended", "legacy_review"]),
});
const compactProfileSchema = profileSchema
  .extend({ access_status: z.enum(["approved", "suspended", "legacy_review"]) })
  .refine((profile) => (profile.access_status === "suspended") === !profile.is_active);
const compactPageSchema = z.object({
  profiles: z.array(compactProfileSchema).max(USER_DIRECTORY_PAGE_SIZE),
  total_count: z.number().int().nonnegative(),
  summary: z
    .object({
      total: z.number().int().nonnegative(),
      active: z.number().int().nonnegative(),
      pending: z.literal(0),
      revoked: z.number().int().nonnegative(),
    })
    .nullable(),
});
const roleAssignmentSchema = z.object({ user_id: z.string().uuid(), role_key: z.string() });
const overrideSchema = z.object({
  user_id: z.string().uuid(),
  permission_key: z.string(),
  effect: z.enum(["allow", "deny"]),
  reason: z.string().nullable(),
});

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface NormalizedLoadUsersPageInput {
  offset: number;
  search: string;
  status: UserDirectoryStatusFilter;
  includeSummary: boolean;
}

interface ProfilesPage {
  rows: z.infer<typeof profileSchema>[];
  count: number | null;
  onboardingFoundationAvailable: boolean;
  summary?: UserDirectorySummary;
}

export function isMissingOnboardingFoundation(code: string | undefined) {
  return code === "PGRST204" || code === "PGRST205" || code === "42703" || code === "42P01";
}

function isRoleKey(value: string | undefined): value is RoleKey {
  return value !== undefined && Object.prototype.hasOwnProperty.call(ROLES, value);
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

function normalizeInput(
  input: LoadUsersPageInput,
  includeSummary: boolean,
): NormalizedLoadUsersPageInput {
  return {
    offset: input.offset,
    search: input.search?.trim() ?? "",
    status: input.status ?? "all",
    includeSummary,
  };
}

function applySearch<T extends { ilike(column: string, pattern: string): T }>(
  query: T,
  search: string,
) {
  return search ? query.ilike("email", `%${search}%`) : query;
}

function applyCurrentStatusFilter<
  T extends {
    eq(column: string, value: string | boolean): T;
    neq(column: string, value: string | boolean): T;
    or(filters: string): T;
  },
>(query: T, status: UserDirectoryStatusFilter) {
  if (status === "active") return query.eq("is_active", true).eq("access_status", "approved");
  if (status === "inactive") {
    return query
      .neq("access_status", "pending")
      .or("is_active.eq.false,access_status.eq.suspended");
  }
  if (status === "pending") return query.eq("access_status", "pending");
  return query;
}

async function loadProfilesPage(
  supabase: SupabaseServerClient,
  input: NormalizedLoadUsersPageInput,
): Promise<ProfilesPage> {
  const contractResult = await supabase.rpc("get_user_directory_contract");
  if (contractResult.error && !["PGRST202", "42883", "55000"].includes(contractResult.error.code)) {
    throw new Error("user_directory_contract_failed");
  }
  if (!contractResult.error && contractResult.data === "compact") {
    const compactResult = await supabase.rpc("get_compact_user_directory_page", {
      p_offset: input.offset,
      p_search: input.search,
      p_status: input.status,
      p_include_summary: input.includeSummary,
    });
    if (compactResult.error) throw new Error("compact_profiles_page_failed");
    const compactPage = compactPageSchema.parse(compactResult.data);
    if (input.includeSummary && compactPage.summary === null) {
      throw new Error("compact_profiles_summary_failed");
    }
    return {
      rows: compactPage.profiles,
      count: compactPage.total_count,
      onboardingFoundationAvailable: false,
      ...(compactPage.summary ? { summary: compactPage.summary } : {}),
    };
  }
  if (!contractResult.error && contractResult.data === "scoped") {
    return loadScopedProfilesPage(supabase, input);
  }

  // Only the protected database contract can recognize compact accounts as
  // active. An absent, unknown, or partial contract remains in legacy review.
  return loadLegacyProfilesPage(supabase, input);
}

async function loadScopedProfilesPage(
  supabase: SupabaseServerClient,
  input: NormalizedLoadUsersPageInput,
): Promise<ProfilesPage> {
  let currentQuery = supabase
    .from("profiles")
    .select("user_id,email,is_active,created_at,access_status", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("user_id", { ascending: true });
  currentQuery = applySearch(currentQuery, input.search);
  currentQuery = applyCurrentStatusFilter(currentQuery, input.status);
  const currentResult = await currentQuery.range(
    input.offset,
    input.offset + USER_DIRECTORY_PAGE_SIZE - 1,
  );

  if (!currentResult.error) {
    return {
      rows: z.array(profileSchema).parse(currentResult.data ?? []),
      count: currentResult.count,
      onboardingFoundationAvailable: true,
    };
  }
  throw new Error("profiles_page_failed");
}

async function loadLegacyProfilesPage(
  supabase: SupabaseServerClient,
  input: NormalizedLoadUsersPageInput,
): Promise<ProfilesPage> {
  if (input.status === "active" || input.status === "pending") {
    return { rows: [], count: 0, onboardingFoundationAvailable: false };
  }

  let legacyQuery = supabase
    .from("profiles")
    .select("user_id,email,is_active,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("user_id", { ascending: true });
  legacyQuery = applySearch(legacyQuery, input.search);
  if (input.status === "inactive") legacyQuery = legacyQuery.eq("is_active", false);
  const legacyResult = await legacyQuery.range(
    input.offset,
    input.offset + USER_DIRECTORY_PAGE_SIZE - 1,
  );
  if (legacyResult.error) throw new Error("legacy_profiles_page_failed");

  return {
    rows: z.array(profileSchema).parse(
      (legacyResult.data ?? []).map((profile) => ({
        ...profile,
        access_status: "legacy_review" as const,
      })),
    ),
    count: legacyResult.count,
    onboardingFoundationAvailable: false,
  };
}

async function countCurrentProfiles(
  supabase: SupabaseServerClient,
  status: Exclude<UserDirectoryStatusFilter, "all">,
) {
  let query = supabase.from("profiles").select("user_id", { count: "exact", head: true });
  query = applyCurrentStatusFilter(query, status);
  const result = await query;
  if (result.error) throw new Error("profiles_summary_failed");
  return result.count;
}

async function loadSummary(
  supabase: SupabaseServerClient,
  profilesPage: ProfilesPage,
): Promise<UserDirectorySummary> {
  if (profilesPage.onboardingFoundationAvailable) {
    const active = await countCurrentProfiles(supabase, "active");
    const pending = await countCurrentProfiles(supabase, "pending");
    const revoked = await countCurrentProfiles(supabase, "inactive");
    return { total: profilesPage.count, active, pending, revoked };
  }

  const revokedResult = await supabase
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("is_active", false);
  if (revokedResult.error) throw new Error("legacy_profiles_summary_failed");
  return {
    total: profilesPage.count,
    active: 0,
    pending: 0,
    revoked: revokedResult.count,
  };
}

function groupOverrides(rows: z.infer<typeof overrideSchema>[]) {
  const byUser = new Map<string, UserPermissionOverride[]>();
  for (const row of rows) {
    if (!isPermissionKey(row.permission_key)) {
      throw new Error("permission_catalog_drift");
    }
    const current = byUser.get(row.user_id) ?? [];
    current.push({
      permissionKey: row.permission_key,
      effect: row.effect,
      reason: row.reason,
    });
    byUser.set(row.user_id, current);
  }
  return byUser;
}

export async function loadUserDirectoryPage(
  context: AuthorizationContext,
  input: LoadUsersPageInput,
  options: { includeSummary?: boolean } = {},
): Promise<UserDirectoryPage> {
  const normalizedInput = normalizeInput(input, options.includeSummary ?? false);
  const supabase = await createClient();
  const profilesPage = await loadProfilesPage(supabase, normalizedInput);
  const summary = normalizedInput.includeSummary
    ? (profilesPage.summary ?? (await loadSummary(supabase, profilesPage)))
    : null;
  const userIds = profilesPage.rows.map((profile) => profile.user_id);

  if (userIds.length === 0) {
    return {
      users: [],
      roleDefaults: {},
      nextOffset: null,
      hasMore: false,
      totalCount: profilesPage.count,
      onboardingFoundationAvailable: profilesPage.onboardingFoundationAvailable,
      summary,
    };
  }

  // Only authorization rows belonging to this profile page are read. The
  // session and RLS remain authoritative; defaults come from the protected RPC
  // rather than assuming that the database matches the client catalog.
  const rolesResult = await supabase
    .from("user_roles")
    .select("user_id,role_key")
    .in("user_id", userIds);
  if (rolesResult.error) throw new Error("user_roles_page_failed");
  const assignments = z.array(roleAssignmentSchema).parse(rolesResult.data ?? []);
  const roleDefaultsResult = await supabase.rpc("get_user_role_permission_defaults");
  if (roleDefaultsResult.error) throw new Error("role_permission_defaults_failed");
  const roleDefaults = z
    .array(z.object({ role_key: z.string(), permission_key: z.string() }))
    .parse(roleDefaultsResult.data ?? []);
  const permissionsByRole = new Map<RoleKey, PermissionKey[]>();
  for (const row of roleDefaults) {
    if (!isRoleKey(row.role_key) || !isPermissionKey(row.permission_key)) {
      throw new Error("permission_catalog_drift");
    }
    const permissions = permissionsByRole.get(row.role_key) ?? [];
    permissions.push(row.permission_key);
    permissionsByRole.set(row.role_key, permissions);
  }
  const overridesResult = await supabase
    .from("user_permission_overrides")
    .select("user_id,permission_key,effect,reason")
    .in("user_id", userIds);
  if (overridesResult.error) throw new Error("permission_overrides_page_failed");
  const overrideRows = z.array(overrideSchema).parse(overridesResult.data ?? []);

  const roleByUser = new Map(
    assignments.map((assignment) => [assignment.user_id, assignment.role_key]),
  );
  const overridesByUser = groupOverrides(overrideRows);
  const canViewAllOverrides = context.permissions.includes("permissions.view");

  const users: ManagedUser[] = profilesPage.rows.map((profile) => {
    const rawRoleKey = roleByUser.get(profile.user_id);
    if (rawRoleKey !== undefined && !isRoleKey(rawRoleKey)) {
      throw new Error("role_catalog_drift");
    }
    const roleKey = isRoleKey(rawRoleKey) ? rawRoleKey : null;
    const targetLevel = roleKey ? ROLES[roleKey].level : 0;

    return {
      userId: profile.user_id,
      email: profile.email,
      isActive: profile.is_active,
      accessStatus: profile.access_status,
      roleKey,
      isSelf: profile.user_id === context.userId,
      isManageable:
        profile.user_id !== context.userId &&
        (roleKey === null
          ? context.roleKey === "master"
          : canManageTargetRole(context, roleKey, targetLevel)),
      inheritedPermissions: roleKey ? (permissionsByRole.get(roleKey) ?? []) : [],
      overrides: overridesByUser.get(profile.user_id) ?? [],
      permissionDetailsAvailable: canViewAllOverrides || profile.user_id === context.userId,
    };
  });
  const loadedThrough = normalizedInput.offset + users.length;
  const hasMore =
    profilesPage.count === null
      ? users.length === USER_DIRECTORY_PAGE_SIZE
      : loadedThrough < profilesPage.count;

  return {
    users,
    roleDefaults: Object.fromEntries(permissionsByRole),
    nextOffset: hasMore ? loadedThrough : null,
    hasMore,
    totalCount: profilesPage.count,
    onboardingFoundationAvailable: profilesPage.onboardingFoundationAvailable,
    summary,
  };
}
