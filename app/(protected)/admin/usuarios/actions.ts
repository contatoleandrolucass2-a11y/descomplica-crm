"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/auth/supabase/server";
import { requirePermission } from "@/lib/authorization/guards";
import {
  requireCanAssignRole,
  requireCanGrantAllPermissions,
  requireCanGrantPermission,
  requireCanManageTargetLevel,
} from "@/lib/authorization/hierarchy";
import { PERMISSIONS, type PermissionKey } from "@/lib/authorization/permissions";
import { ROLES, type RoleKey } from "@/lib/authorization/roles";

const userIdSchema = z.string().uuid();
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

    if (!isRoleKey(roleKeyInput) || !ROLES[roleKeyInput].assignable) {
      return failure("Esse papel não pode ser atribuído pela interface.");
    }
    if (userId === actor.userId) return failure("Você não pode alterar o próprio papel.");

    const { supabase, target } = await getTargetContext(userId);
    if (!isRoleKey(target.role_key)) return failure();
    if (target.role_key === roleKeyInput) return failure("Selecione um papel diferente do atual.");

    requireCanManageTargetLevel(actor, target.level);
    requireCanAssignRole(actor, roleKeyInput);

    await requirePermission("permissions.manage");
    const { error } = await supabase.rpc("assign_user_role_defaults", {
      target_user_id: userId,
      target_role_key: roleKeyInput,
    });

    if (error) return failure();
    refreshUsersAdmin();
    return {
      status: "success",
      message: "Papel atualizado com as permissões padrão. Exceções anteriores removidas.",
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
    const reason = "Alteração individual de acesso pela administração de usuários.";

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

export async function setPermissionOverridesBulkAction(
  targetUserId: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("permissions.manage");
    const userId = userIdSchema.parse(targetUserId);
    const allowPermissionKeys = z.array(z.string()).parse(formData.getAll("allowPermissionKeys"));
    const denyPermissionKeys = z.array(z.string()).parse(formData.getAll("denyPermissionKeys"));
    const inheritPermissionKeys = z
      .array(z.string())
      .parse(formData.getAll("inheritPermissionKeys"));
    const permissionKeys = [
      ...allowPermissionKeys,
      ...denyPermissionKeys,
      ...inheritPermissionKeys,
    ];
    const reason =
      "Alteração de permissões pelos controles de acesso da administração de usuários.";
    if (permissionKeys.length < 1 || permissionKeys.length > 100) {
      return failure("Selecione entre 1 e 100 permissões.");
    }

    if (new Set(permissionKeys).size !== permissionKeys.length) {
      return failure("Selecione cada permissão apenas uma vez.");
    }
    if (!permissionKeys.every(isPermissionKey)) return failure("Permissão inválida.");
    if (userId === actor.userId) return failure("Você não pode alterar o próprio acesso.");

    const typedPermissionKeys = permissionKeys as PermissionKey[];
    const { supabase, target } = await getTargetContext(userId);
    requireCanManageTargetLevel(actor, target.level);
    requireCanGrantAllPermissions(actor, typedPermissionKeys);

    const { error } = await supabase.rpc("apply_user_permission_access_draft", {
      target_user_id: userId,
      allow_permission_keys: allowPermissionKeys,
      deny_permission_keys: denyPermissionKeys,
      inherit_permission_keys: inheritPermissionKeys,
      reason,
    });

    if (error) return failure();
    refreshUsersAdmin();
    return {
      status: "success",
      message: "Permissões salvas.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message);
    return failure("Operação não autorizada ou inválida.");
  }
}

export async function removePermissionOverrideAction(
  targetUserId: string,
  permissionKeyInput: string,
  _previousState: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  void _previousState;
  void _formData;
  try {
    const actor = await requirePermission("permissions.manage");
    const userId = userIdSchema.parse(targetUserId);
    const reason = "Restauração da permissão padrão pela administração de usuários.";

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
  _formData: FormData,
): Promise<AdminActionState> {
  void _previousState;
  void _formData;
  try {
    const actor = await requirePermission("users.manage");
    const userId = userIdSchema.parse(targetUserId);
    if (userId === actor.userId) return failure("Você não pode alterar o próprio status.");

    const { supabase, target } = await getTargetContext(userId);
    requireCanManageTargetLevel(actor, target.level);

    const reason = nextActive
      ? "Reativação de acesso pela administração de usuários."
      : "Desativação de acesso pela administração de usuários.";
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

export async function approveUserAccessAction(
  targetUserId: string,
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("users.manage");
    await requirePermission("roles.manage");
    const userId = userIdSchema.parse(targetUserId);
    const roleKeyInput = z.string().parse(formData.get("roleKey"));
    const reportingScopeIds = z
      .array(z.string().uuid())
      .min(1)
      .max(20)
      .parse(formData.getAll("reportingScopeIds"));
    const reason = "Aprovação de acesso com papel e escopo pela administração de usuários.";
    if (!isRoleKey(roleKeyInput) || !ROLES[roleKeyInput].assignable) {
      return failure("Esse papel não pode ser aprovado pela interface.");
    }
    if (userId === actor.userId) return failure("Você não pode aprovar a própria conta.");

    const supabase = await createClient();
    const { error } = await supabase.rpc("approve_user_access", {
      target_user_id: userId,
      target_role_key: roleKeyInput,
      reporting_scope_ids: reportingScopeIds,
      reason,
    });
    if (error) return failure("A aprovação foi rejeitada pela validação de papel e escopo.");

    refreshUsersAdmin();
    return {
      status: "success",
      message: "Acesso aprovado com papel e escopo auditados.",
      sessionRefreshRecommended: true,
    };
  } catch (error) {
    if (error instanceof z.ZodError) return failure(error.issues[0]?.message);
    return failure("Operação não autorizada ou inválida.");
  }
}
