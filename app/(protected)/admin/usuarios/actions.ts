"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { ROLES, type RoleKey } from "@/lib/authorization/roles";

const userIdSchema = z.string().uuid();
const reasonSchema = z.string().trim().max(240).optional();

function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

function readReason(formData: FormData): string | null {
  return reasonSchema.parse(formData.get("reason") || undefined) ?? null;
}

function refreshUsersAdmin() {
  revalidatePath("/admin/usuarios");
  revalidatePath("/", "layout");
}

export async function assignRoleAction(targetUserId: string, formData: FormData): Promise<void> {
  await requirePermission("roles.manage");
  const userId = userIdSchema.parse(targetUserId);
  const roleKey = z.string().parse(formData.get("roleKey"));

  if (!isRoleKey(roleKey)) throw new Error("Papel inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_user_role", {
    target_user_id: userId,
    target_role_key: roleKey,
    reason: readReason(formData),
  });

  if (error) throw new Error("Não foi possível atribuir o papel solicitado.");
  refreshUsersAdmin();
}

export async function setPermissionOverrideAction(
  targetUserId: string,
  formData: FormData,
): Promise<void> {
  await requirePermission("permissions.manage");
  const userId = userIdSchema.parse(targetUserId);
  const permissionKey = z.string().parse(formData.get("permissionKey"));
  const effect = z.enum(["allow", "deny"]).parse(formData.get("effect"));

  if (!isPermissionKey(permissionKey)) throw new Error("Permissão inválida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_permission_override", {
    target_user_id: userId,
    permission_key: permissionKey,
    effect,
    reason: readReason(formData),
  });

  if (error) throw new Error("Não foi possível configurar a exceção de permissão.");
  refreshUsersAdmin();
}

export async function removePermissionOverrideAction(
  targetUserId: string,
  permissionKeyInput: string,
  formData: FormData,
): Promise<void> {
  await requirePermission("permissions.manage");
  const userId = userIdSchema.parse(targetUserId);

  if (!isPermissionKey(permissionKeyInput)) throw new Error("Permissão inválida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_user_permission_override", {
    target_user_id: userId,
    permission_key: permissionKeyInput,
    reason: readReason(formData),
  });

  if (error) throw new Error("Não foi possível remover a exceção de permissão.");
  refreshUsersAdmin();
}

export async function setUserActiveAction(
  targetUserId: string,
  nextActive: boolean,
  formData: FormData,
): Promise<void> {
  await requirePermission("users.manage");
  const userId = userIdSchema.parse(targetUserId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", {
    target_user_id: userId,
    target_is_active: nextActive,
    reason: readReason(formData),
  });

  if (error) throw new Error("Não foi possível alterar o status do usuário.");
  refreshUsersAdmin();
}
