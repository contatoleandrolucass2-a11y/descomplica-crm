import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { ROLES, getAssignableRoleKeys, type RoleKey } from "@/lib/authorization/roles";

import { UserAccessManager, type ManagedUser } from "./UserAccessManager";

export const metadata = { title: "Usuários e acessos" };

const profileSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  access_status: z.enum(["pending", "approved", "suspended", "legacy_review"]),
});
const roleAssignmentSchema = z.object({ user_id: z.string().uuid(), role_key: z.string() });
const overrideSchema = z.object({
  user_id: z.string().uuid(),
  permission_key: z.string(),
  effect: z.enum(["allow", "deny"]),
  reason: z.string().nullable(),
});
const reportingScopeSchema = z.object({
  id: z.string().uuid(),
  scope_key: z.string(),
  scope_type: z.enum(["global", "organization", "team", "portfolio", "person"]),
  is_active: z.boolean(),
});

function isRoleKey(value: string | undefined): value is RoleKey {
  return value !== undefined && Object.prototype.hasOwnProperty.call(ROLES, value);
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

function isMissingOnboardingFoundation(code: string | undefined) {
  return code === "PGRST204" || code === "PGRST205" || code === "42703" || code === "42P01";
}

export default async function UsersAdminPage() {
  const context = await enforcePermission("users.view");
  const supabase = await createClient();
  const [profilesResult, rolesResult, overridesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,email,is_active,created_at,access_status")
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id,role_key"),
    supabase.from("user_permission_overrides").select("user_id,permission_key,effect,reason"),
  ]);

  // The approved app-first train must remain readable before the additive
  // onboarding foundation reaches production. Fall back only for the exact
  // missing-column/table states; all authorization and transport errors fail.
  let profileRows: unknown = profilesResult.data ?? [];
  let profileError = profilesResult.error;
  if (isMissingOnboardingFoundation(profilesResult.error?.code)) {
    const legacyProfilesResult = await supabase
      .from("profiles")
      .select("user_id,email,is_active,created_at")
      .order("created_at", { ascending: false });
    profileError = legacyProfilesResult.error;
    profileRows = (legacyProfilesResult.data ?? []).map((profile) => ({
      ...profile,
      access_status: "legacy_review",
    }));
  }

  if (profileError || rolesResult.error || overridesResult.error) {
    throw new Error("Não foi possível carregar a administração de usuários.");
  }

  const scopesResult =
    context.roleKey === "master"
      ? await supabase
          .from("crm_reporting_scopes")
          .select("id,scope_key,scope_type,is_active")
          .eq("is_active", true)
          .order("scope_type")
          .order("scope_key")
      : { data: [], error: null };
  if (scopesResult.error && !isMissingOnboardingFoundation(scopesResult.error.code)) {
    throw new Error("Não foi possível carregar os escopos oficiais para aprovação.");
  }

  const profiles = z.array(profileSchema).parse(profileRows);
  const assignments = z.array(roleAssignmentSchema).parse(rolesResult.data ?? []);
  const overrides = z.array(overrideSchema).parse(overridesResult.data ?? []);
  const reportingScopes = z
    .array(reportingScopeSchema)
    .parse(scopesResult.error ? [] : (scopesResult.data ?? []));
  const rolesByUser = new Map(assignments.map((row) => [row.user_id, row.role_key]));
  const assignableRoles = getAssignableRoleKeys(context.level);
  const manageablePermissions = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(
    (permissionKey) =>
      context.permissions.includes(permissionKey) &&
      PERMISSIONS[permissionKey].minLevel < context.level,
  );
  const canManageRoles = hasPermission(context, "roles.manage");
  const canManagePermissions = hasPermission(context, "permissions.manage");
  const canManageUsers = hasPermission(context, "users.manage");

  const users: ManagedUser[] = profiles.map((profile) => {
    const rawRoleKey = rolesByUser.get(profile.user_id);
    if (rawRoleKey !== undefined && !isRoleKey(rawRoleKey)) {
      throw new Error("O catálogo de papéis da aplicação está desatualizado.");
    }

    const roleKey = isRoleKey(rawRoleKey) ? rawRoleKey : null;
    const targetLevel = roleKey ? ROLES[roleKey].level : 0;
    const userOverrides = overrides
      .filter((row) => row.user_id === profile.user_id)
      .map((override) => {
        if (!isPermissionKey(override.permission_key)) {
          throw new Error("O catálogo de permissões da aplicação está desatualizado.");
        }
        return {
          permissionKey: override.permission_key,
          effect: override.effect,
          reason: override.reason,
        };
      });

    return {
      userId: profile.user_id,
      email: profile.email,
      isActive: profile.is_active,
      accessStatus: profile.access_status,
      roleKey,
      isSelf: profile.user_id === context.userId,
      isManageable: profile.user_id !== context.userId && targetLevel < context.level,
      overrides: userOverrides,
    };
  });

  return (
    <main className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold text-slate-950">Usuários e acessos</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Consulte acessos herdados e exceções separadamente. Alterações respeitam a hierarquia,
          impedem autoelevação e geram auditoria.
        </p>

        <UserAccessManager
          users={users}
          assignableRoles={assignableRoles}
          manageablePermissions={manageablePermissions}
          canManageRoles={canManageRoles}
          canManagePermissions={canManagePermissions}
          canManageUsers={canManageUsers}
          canApproveUsers={context.roleKey === "master" && canManageRoles && canManageUsers}
          reportingScopes={reportingScopes.map((scope) => ({
            id: scope.id,
            key: scope.scope_key,
            type: scope.scope_type,
          }))}
        />
      </div>
    </main>
  );
}
