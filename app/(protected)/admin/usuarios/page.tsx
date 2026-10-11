import { z } from "zod";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
} from "@/app/(protected)/_components/ManagementCanvas";
import { createClient } from "@/lib/auth/supabase/server";
import { enforcePermission } from "@/lib/authorization/enforce";
import { hasPermission } from "@/lib/authorization/guards";
import { canGrantPermission } from "@/lib/authorization/hierarchy";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { getAssignableRoleKeys } from "@/lib/authorization/roles";

import { UserAccessManager } from "./UserAccessManager";
import { isMissingOnboardingFoundation, loadUserDirectoryPage } from "./user-directory";

export const metadata = { title: "Usuários e acessos" };

const reportingScopeSchema = z.object({
  id: z.string().uuid(),
  scope_key: z.string(),
  scope_type: z.enum(["global", "organization", "team", "portfolio", "person"]),
  is_active: z.boolean(),
});

export default async function UsersAdminPage() {
  const context = await enforcePermission("users.view");
  const initialPage = await loadUserDirectoryPage(
    context,
    { offset: 0, search: "", status: "all" },
    { includeSummary: true },
  );
  const supabase = await createClient();
  // The paged loader keeps the pre-foundation fallback fail-closed by mapping
  // legacy rows to `access_status: "legacy_review"`; other database errors fail.
  const onboardingFoundationAvailable = initialPage.onboardingFoundationAvailable;

  const canManageRoles = hasPermission(context, "roles.manage");
  const canManagePermissions = hasPermission(context, "permissions.manage");
  const canManageUsers = hasPermission(context, "users.manage");
  const canAttemptApproval = onboardingFoundationAvailable && canManageRoles && canManageUsers;
  const scopesResult = canAttemptApproval
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
  const canApproveUsers = canAttemptApproval && !scopesResult.error;

  const reportingScopes = z
    .array(reportingScopeSchema)
    .parse(scopesResult.error ? [] : (scopesResult.data ?? []));
  const assignableRoles = getAssignableRoleKeys(context.level);
  const manageablePermissions = (Object.keys(PERMISSIONS) as PermissionKey[]).filter(
    (permissionKey) => canGrantPermission(context, permissionKey),
  );

  return (
    <ManagementPage className="admin-canvas admin-users-page">
      <ManagementPageHeader
        title="Usuários e acessos"
        description="Consulte acessos herdados e exceções separadamente. Alterações respeitam a hierarquia, impedem autoelevação e geram auditoria."
        status={<ManagementStatusBadge>Acesso protegido</ManagementStatusBadge>}
      />
      <UserAccessManager
        users={initialPage.users}
        initialHasMore={initialPage.hasMore}
        initialNextOffset={initialPage.nextOffset}
        initialTotalCount={initialPage.totalCount}
        summary={initialPage.summary}
        assignableRoles={assignableRoles}
        manageablePermissions={manageablePermissions}
        canManageRoles={canManageRoles}
        canManagePermissions={canManagePermissions}
        isMasterPermissionManager={context.roleKey === "master"}
        canManageUsers={canManageUsers}
        canApproveUsers={canApproveUsers}
        reportingScopes={reportingScopes.map((scope) => ({
          id: scope.id,
          key: scope.scope_key,
          type: scope.scope_type,
        }))}
      />
    </ManagementPage>
  );
}
