import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  requireCanAssignRole: vi.fn(),
  requireCanGrantAllPermissions: vi.fn(),
  requireCanGrantPermission: vi.fn(),
  requireCanManageTargetLevel: vi.fn(),
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
  requireCanManageTargetLevel: mocks.requireCanManageTargetLevel,
}));

import {
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
const idleState = { status: "idle" as const, message: "" };

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

  it("envia todas as permissões selecionadas para uma única RPC atômica", async () => {
    const formData = new FormData();
    formData.append("permissionKeys", "crm.dashboard.view");
    formData.append("permissionKeys", "crm.dashboard.with_canal_imob.view");
    formData.set("effect", "deny");
    formData.set("reason", "Restrição sintética em lote");

    const result = await setPermissionOverridesBulkAction(targetUserId, idleState, formData);

    expect(result).toEqual({
      status: "success",
      message: "Exceções individuais atualizadas e auditadas.",
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith("permissions.manage");
    expect(mocks.requireCanManageTargetLevel).toHaveBeenCalledWith(actor, 25);
    expect(mocks.requireCanGrantAllPermissions).toHaveBeenCalledWith(actor, [
      "crm.dashboard.view",
      "crm.dashboard.with_canal_imob.view",
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("set_user_permission_overrides_bulk", {
      target_user_id: targetUserId,
      permission_keys: ["crm.dashboard.view", "crm.dashboard.with_canal_imob.view"],
      effect: "deny",
      reason: "Restrição sintética em lote",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("restaura a herança pelo mesmo contrato em lote", async () => {
    const formData = new FormData();
    formData.append("permissionKeys", "crm.dashboard.view");
    formData.set("effect", "inherit");
    formData.set("reason", "Retorno à matriz do papel");

    const result = await setPermissionOverridesBulkAction(targetUserId, idleState, formData);

    expect(result).toEqual({
      status: "success",
      message: "Exceções removidas; voltou a valer a regra de cada papel.",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "set_user_permission_overrides_bulk",
      expect.objectContaining({ effect: "inherit" }),
    );
  });

  it("rejeita duplicatas antes de consultar ou alterar o alvo", async () => {
    const formData = new FormData();
    formData.append("permissionKeys", "crm.dashboard.view");
    formData.append("permissionKeys", "crm.dashboard.view");
    formData.set("effect", "allow");
    formData.set("reason", "Duplicata sintética");

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
    formData.append("permissionKeys", "crm.dashboard.view");
    formData.set("effect", "deny");
    formData.set("reason", "Autoalteração sintética");

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
});
