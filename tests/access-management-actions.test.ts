import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  requireCanAssignRole: vi.fn(),
  requireCanGrantAllPermissions: vi.fn(),
  requireCanGrantPermission: vi.fn(),
  requireCanManageTargetRole: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/authorization/guards", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/authorization/hierarchy", () => ({
  requireCanAssignRole: mocks.requireCanAssignRole,
  requireCanGrantAllPermissions: mocks.requireCanGrantAllPermissions,
  requireCanGrantPermission: mocks.requireCanGrantPermission,
  requireCanManageTargetRole: mocks.requireCanManageTargetRole,
}));

import {
  approveUserAccessAction,
  assignRoleAction,
  setPermissionOverridesBulkAction,
} from "@/app/(protected)/admin/usuarios/actions";

const actor = {
  userId: "a5000000-0000-4000-8000-000000000001",
  roleKey: "admin",
  level: 80,
  permissions: ["permissions.manage", "roles.manage"],
};
const targetUserId = "a5000000-0000-4000-8000-000000000002";
const reportingScopeId = "a5000000-0000-4000-8000-000000000003";
const idleState = { status: "idle" as const, message: "" };

function approvalForm(roleKey: string) {
  const formData = new FormData();
  formData.set("roleKey", roleKey);
  formData.append("reportingScopeIds", reportingScopeId);
  formData.set("reason", "Aprovação sintética auditável");
  return formData;
}

describe("ações administrativas em lote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
    mocks.requirePermission.mockResolvedValue(actor);
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "get_user_authorization_context") {
        return Promise.resolve({
          data: [
            {
              user_id: targetUserId,
              role_key: "broker_house",
              level: 25,
              permissions: ["crm.dashboard.view"],
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
  });

  it("envia marcações, desmarcações e herança para uma única RPC atômica", async () => {
    const formData = new FormData();
    formData.append("allowPermissionKeys", "crm.dashboard.with_canal_imob.view");
    formData.append("denyPermissionKeys", "crm.dashboard.view");

    const result = await setPermissionOverridesBulkAction(targetUserId, idleState, formData);

    expect(result).toEqual({
      status: "success",
      message: "Permissões salvas.",
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith("permissions.manage");
    expect(mocks.requireCanManageTargetRole).toHaveBeenCalledWith(actor, "broker_house", 25);
    expect(mocks.requireCanGrantAllPermissions).toHaveBeenCalledWith(actor, [
      "crm.dashboard.with_canal_imob.view",
      "crm.dashboard.view",
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_user_permission_access_draft", {
      target_user_id: targetUserId,
      allow_permission_keys: ["crm.dashboard.with_canal_imob.view"],
      deny_permission_keys: ["crm.dashboard.view"],
      inherit_permission_keys: [],
      reason: "Alteração de permissões pelos controles de acesso da administração de usuários.",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("restaura a herança pelo mesmo contrato em lote", async () => {
    const formData = new FormData();
    formData.append("inheritPermissionKeys", "crm.dashboard.view");

    const result = await setPermissionOverridesBulkAction(targetUserId, idleState, formData);

    expect(result).toEqual({
      status: "success",
      message: "Permissões salvas.",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_user_permission_access_draft",
      expect.objectContaining({ inherit_permission_keys: ["crm.dashboard.view"] }),
    );
  });

  it("rejeita duplicatas antes de consultar ou alterar o alvo", async () => {
    const formData = new FormData();
    formData.append("allowPermissionKeys", "crm.dashboard.view");
    formData.append("denyPermissionKeys", "crm.dashboard.view");

    const result = await setPermissionOverridesBulkAction(targetUserId, idleState, formData);

    expect(result).toEqual({
      status: "error",
      message: "Selecione cada permissão apenas uma vez.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("bloqueia alteração do próprio acesso antes da RPC", async () => {
    const formData = new FormData();
    formData.append("denyPermissionKeys", "crm.dashboard.view");

    const result = await setPermissionOverridesBulkAction(actor.userId, idleState, formData);

    expect(result).toEqual({
      status: "error",
      message: "Você não pode alterar o próprio acesso.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("não permite reatribuir um papel legado pela interface", async () => {
    const formData = new FormData();
    formData.set("roleKey", "supervisor");
    formData.set("reason", "Tentativa sintética");

    const result = await assignRoleAction(targetUserId, idleState, formData);

    expect(result).toEqual({
      status: "error",
      message: "Esse papel não pode ser atribuído pela interface.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("atribui papel com restauração atômica sem exigir motivo", async () => {
    const formData = new FormData();
    formData.set("roleKey", "manager_house");
    const result = await assignRoleAction(targetUserId, idleState, formData);
    expect(result.status).toBe("success");
    expect(mocks.requirePermission).toHaveBeenCalledWith("permissions.manage");
    expect(mocks.rpc).toHaveBeenCalledWith("assign_user_role_defaults", {
      target_user_id: targetUserId,
      target_role_key: "manager_house",
    });
  });

  it("não grava permissões quando a hierarquia rejeita o alvo", async () => {
    mocks.requireCanManageTargetRole.mockImplementationOnce(() => {
      throw new Error("FORBIDDEN");
    });
    const formData = new FormData();
    formData.append("allowPermissionKeys", "crm.dashboard.view");
    const result = await setPermissionOverridesBulkAction(targetUserId, idleState, formData);
    expect(result.status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalledWith(
      "apply_user_permission_access_draft",
      expect.anything(),
    );
  });
  it("bloqueia aprovação como Administrador antes de criar cliente ou chamar RPC", async () => {
    mocks.requireCanAssignRole.mockImplementationOnce(() => {
      throw new Error("FORBIDDEN");
    });

    const result = await approveUserAccessAction(targetUserId, idleState, approvalForm("admin"));

    expect(result).toEqual({
      status: "error",
      message: "Operação não autorizada ou inválida.",
    });
    expect(mocks.requirePermission).toHaveBeenNthCalledWith(1, "users.manage");
    expect(mocks.requirePermission).toHaveBeenNthCalledWith(2, "roles.manage");
    expect(mocks.requireCanAssignRole).toHaveBeenCalledWith(actor, "admin");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("permite ao Master aprovar o papel Administrador pela RPC auditada", async () => {
    const master = { ...actor, roleKey: "master", level: 100 };
    mocks.requirePermission.mockResolvedValue(master);

    const result = await approveUserAccessAction(targetUserId, idleState, approvalForm("admin"));

    expect(result).toEqual({
      status: "success",
      message: "Acesso aprovado com papel e escopo auditados.",
      sessionRefreshRecommended: true,
    });
    expect(mocks.requireCanAssignRole).toHaveBeenCalledWith(master, "admin");
    expect(mocks.rpc).toHaveBeenCalledWith("approve_user_access", {
      target_user_id: targetUserId,
      target_role_key: "admin",
      reporting_scope_ids: [reportingScopeId],
      reason: "Aprovação de acesso com papel e escopo pela administração de usuários.",
    });
  });
});
