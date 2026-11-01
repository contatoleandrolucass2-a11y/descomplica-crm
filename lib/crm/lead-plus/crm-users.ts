import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/auth/supabase/server";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";
import { PERMISSIONS } from "@/lib/authorization/permissions";
import { ROLES } from "@/lib/authorization/roles";
import type { AuthorizationContext, PermissionKey, RoleKey } from "@/lib/authorization/types";
import {
  loadUserDirectoryPage,
  USER_DIRECTORY_PAGE_SIZE,
} from "@/app/(protected)/admin/usuarios/user-directory";

const deny = () =>
  Object.assign(new Error("Usuário do CRM indisponível ou sem autorização."), { status: 403 });
const uuid = z.string().uuid();
export async function resolveLeadCrmUser(context: AuthorizationContext, id: string) {
  if (
    !uuid.safeParse(id).success ||
    (id !== context.userId && !context.permissions.includes("users.view"))
  )
    throw deny();
  const client = await createClient();
  const contract = await client.rpc("get_user_directory_contract");
  if (contract.error || !["compact", "scoped"].includes(contract.data)) throw deny();
  const compact = contract.data === "compact";
  const profile = await client
    .from("profiles")
    .select(compact ? "user_id,email,is_active" : "user_id,email,is_active,access_status")
    .eq("user_id", id)
    .maybeSingle();
  const parsedProfile = z
    .object({
      user_id: z.string().uuid(),
      email: z.string().min(1),
      is_active: z.boolean(),
      access_status: z.string().optional(),
    })
    .safeParse(profile.data);
  if (
    profile.error ||
    !parsedProfile.success ||
    parsedProfile.data.user_id !== id ||
    !parsedProfile.data.is_active
  )
    throw deny();
  const sourceProfile = parsedProfile.data;
  if (compact) {
    // Compact deployments do not store access_status on profiles. Only the protected
    // directory contract can establish approval; never infer it from is_active.
    const page = await client.rpc("get_compact_user_directory_page", {
      p_offset: 0,
      p_search: sourceProfile.email,
      p_status: "active",
      p_include_summary: false,
    });
    if (page.error || !page.data || !Array.isArray(page.data.profiles)) throw deny();
    const matches = page.data.profiles.filter((row: unknown) => {
      if (!row || typeof row !== "object") return false;
      const entry = row as Record<string, unknown>;
      return entry.user_id === id && entry.email === sourceProfile.email;
    });
    if (
      matches.length !== 1 ||
      matches[0].is_active !== true ||
      matches[0].access_status !== "approved"
    )
      throw deny();
  } else if (sourceProfile.access_status !== "approved") throw deny();
  const result = await client.rpc("get_user_authorization_context", { user_uuid: id });
  if (result.error || !Array.isArray(result.data) || result.data.length !== 1) throw deny();
  const row = result.data[0];
  if (
    !row ||
    typeof row !== "object" ||
    row.user_id !== id ||
    typeof row.role_key !== "string" ||
    !Object.hasOwn(ROLES, row.role_key) ||
    row.role_key === "pending" ||
    !Number.isInteger(row.level) ||
    row.level !== ROLES[row.role_key as RoleKey].level ||
    !Array.isArray(row.permissions) ||
    row.permissions.some(
      (value: unknown) => typeof value !== "string" || !Object.hasOwn(PERMISSIONS, value),
    )
  )
    throw deny();
  const target: AuthorizationContext = {
    userId: id,
    roleKey: row.role_key as RoleKey,
    level: row.level,
    permissions: row.permissions as PermissionKey[],
  };
  const pages = await getAuthorizedNavigation(target);
  if (
    !pages.some((page) => page.path === "/app/leads") ||
    !target.permissions.includes("crm.leads.view")
  )
    throw deny();
  return {
    id,
    email: sourceProfile.email,
    name: sourceProfile.email,
    authorizedPages: pages.map((page) => page.path),
    canonicalPermissions: target.permissions,
  };
}
export async function loadLeadCrmUsers(
  context: AuthorizationContext,
  search: string,
  offset: number,
) {
  if (!context.permissions.includes("users.view")) throw deny();
  if (
    typeof search !== "string" ||
    search.length > 160 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    throw Object.assign(Error("Consulta de usuários inválida."), { status: 422 });
  const page = await loadUserDirectoryPage(context, { search, offset, status: "active" });
  if (page.totalCount === null)
    throw Object.assign(Error("Diretório indisponível."), { status: 503 });
  return {
    data: page.users
      .filter((user) => user.isActive && user.accessStatus === "approved" && user.email)
      .map((user) => ({ id: user.userId, name: user.email!, email: user.email! })),
    total: page.totalCount,
    offset,
    limit: USER_DIRECTORY_PAGE_SIZE,
  };
}
