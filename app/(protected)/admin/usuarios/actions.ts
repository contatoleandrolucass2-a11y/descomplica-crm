"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import {
  requireCanAssignRole,
  requireCanGrantPermission,
  requireCanManageTargetLevel,
} from "@/lib/authorization/hierarchy";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { ROLES, type RoleKey } from "@/lib/authorization/roles";

const userIdSchema = z.string().uuid();
const optionalReasonSchema = z.string().trim().max(240).optional();
const requiredReasonSchema = z
  .string()
  .trim()
  .min(3, "Informe um motivo com pelo menos 3 caracteres.")
  .max(240);
const targetContextSchema = z.object({
  user_id: z.string().uuid(),
  role_key: z.string(),
  level: z.number().int(),
  permissions: z.array(z.string()),
});

export interface AdminActionState {
  status: "idle" | "success" | "error";
  message: string;
  sessionRefreshRecommended?: boolean;
}

function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

function isPermissionKey(value: string): value is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

function readOptionalReason(formData: FormData): string | null {
  return optionalReasonSchema.parse(formData.get("reason") || undefined) ?? null;
}

function readRequiredReason(formData: FormData): string {
  return requiredReasonSchema.parse(formData.get("reason"));
}

function refreshUsersAdmin() {
  revalidatePath("/admin/usuarios");
  revalidatePath("/", "layout");
}

function failure(message = "Não foi possível concluir a alteração solicitada."): AdminActionState {
  return { status: "error", message };
}

async function getTargetContext(targetUserId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_authorization_context", {
    user_uuid: targetUserId,
  });

  if (error) throw new Error("target_context_failed");
  const parsed = z.array(targetContextSchema).safeParse(data ?? []);
  if (!parsed.success || !parsed.data[0]) throw new Error("target_context_failed");

  return { supabase, target: parsed.data[0] };
}

export async function assignRoleAction(
  targetUserId: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("roles.manage");
    const userId = userIdSchema.parse(targetUserId);
    const roleKeyInput = z.string().parse(formData.get("roleKey"));

    if (!isRoleKey(roleKeyInput) || roleKeyInput === "master") {
      return failure("Esse papel não pode ser atribuído pela interface.");
    }
    if (userId === actor.userId) return failure("Você não pode alterar o próprio papel.");

    const { supabase, target } = await getTargetContext(userId);
    if (!isRoleKey(target.role_key)) return failure();
    if (target.role_key === roleKeyInput) return failure("Selecione um papel diferente do atual.");

    requireCanManageTargetLevel(actor, target.level);
    requireCanAssignRole(actor, roleKeyInput);

    const reason =
      ROLES[roleKeyInput].level > target.level
        ? readRequiredReason(formData)
        : readOptionalReason(formData);
    const { error } = await supabase.rpc("assign_user_role", {
      target_user_id: userId,
      target_role_key: roleKeyInput,
      reason,
    });

    if (error) return failure();
    refreshUsersAdmin();
    return {
      status: "success",
      message: "Papel atualizado. O novo acesso será verificado em cada requisição.",
      sessionRefreshRecommended: true,
    };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message);
    return failure("Operação não autorizada ou inválida.");
  }
}

export async function setPermissionOverrideAction(
  targetUserId: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("permissions.manage");
    const userId = userIdSchema.parse(targetUserId);
    const permissionKeyInput = z.string().parse(formData.get("permissionKey"));
    const effect = z.enum(["allow", "deny"]).parse(formData.get("effect"));
    const reason = readRequiredReason(formData);

    if (!isPermissionKey(permissionKeyInput)) return failure("Permissão inválida.");
    if (userId === actor.userId) return failure("Você não pode alterar o próprio acesso.");

    const { supabase, target } = await getTargetContext(userId);
    requireCanManageTargetLevel(actor, target.level);
    requireCanGrantPermission(actor, permissionKeyInput);

    const { error } = await supabase.rpc("set_user_permission_override", {
      target_user_id: userId,
      permission_key: permissionKeyInput,
      effect,
      reason,
    });

    if (error) return failure();
    refreshUsersAdmin();
    return { status: "success", message: "Exceção individual atualizada e auditada." };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message);
    return failure("Operação não autorizada ou inválida.");
  }
}

export async function removePermissionOverrideAction(
  targetUserId: string,
  permissionKeyInput: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("permissions.manage");
    const userId = userIdSchema.parse(targetUserId);
    const reason = readRequiredReason(formData);

    if (!isPermissionKey(permissionKeyInput)) return failure("Permissão inválida.");
    if (userId === actor.userId) return failure("Você não pode alterar o próprio acesso.");

    const { supabase, target } = await getTargetContext(userId);
    requireCanManageTargetLevel(actor, target.level);
    requireCanGrantPermission(actor, permissionKeyInput);

    const { error } = await supabase.rpc("remove_user_permission_override", {
      target_user_id: userId,
      permission_key: permissionKeyInput,
      reason,
    });

    if (error) return failure();
    refreshUsersAdmin();
    return { status: "success", message: "Exceção removida; voltou a valer a regra do papel." };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message);
    return failure("Operação não autorizada ou inválida.");
  }
}

export async function setUserActiveAction(
  targetUserId: string,
  nextActive: boolean,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("users.manage");
    const userId = userIdSchema.parse(targetUserId);
    if (userId === actor.userId) return failure("Você não pode alterar o próprio status.");

    const { supabase, target } = await getTargetContext(userId);
    requireCanManageTargetLevel(actor, target.level);

    const reason = nextActive ? readOptionalReason(formData) : readRequiredReason(formData);
    const { error } = await supabase.rpc("set_user_active", {
      target_user_id: userId,
      target_is_active: nextActive,
      reason,
    });

    if (error) return failure();
    refreshUsersAdmin();
    return {
      status: "success",
      message: nextActive ? "Usuário reativado." : "Usuário desativado e acesso suspenso.",
      sessionRefreshRecommended: true,
    };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message);
    return failure("Operação não autorizada ou inválida.");
  }
}
