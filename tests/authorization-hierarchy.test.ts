import { describe, expect, it } from "vitest";

import {
  canAssignRole,
  canGrantPermission,
  canManageTargetLevel,
  canManageTargetRole,
} from "@/lib/authorization/hierarchy";
import type { AuthorizationContext } from "@/lib/authorization/types";
import { ROLE_INHERITED_PERMISSIONS } from "@/lib/authorization/access-presentation";

function actor(overrides: Partial<AuthorizationContext>): AuthorizationContext {
  return {
    userId: "ad000000-0000-4000-8000-000000000001",
    roleKey: "admin",
    level: 80,
    permissions: ["permissions.manage"],
    ...overrides,
  };
}

describe("hierarquia de delegação de permissões", () => {
  it("mantém as duas marcas desativadas nos padrões dos papéis que não são Administrador ou Master", () => {
    for (const [role, permissions] of Object.entries(ROLE_INHERITED_PERMISSIONS)) {
      if (role === "admin" || role === "master") continue;
      expect(permissions).not.toContain("crm.inventory.riva.view");
      expect(permissions).not.toContain("crm.inventory.direcional.view");
    }
  });

  it("permite gerenciar marcas sem conceder acesso de consulta ao gestor", () => {
    for (const permission of [
      "crm.inventory.riva.view",
      "crm.inventory.direcional.view",
    ] as const) {
      expect(canGrantPermission(actor({}), permission)).toBe(true);
      expect(canGrantPermission(actor({ roleKey: "master", level: 100 }), permission)).toBe(true);
      expect(canGrantPermission(actor({ permissions: [] }), permission)).toBe(false);
      expect(canGrantPermission(actor({ level: 10 }), permission)).toBe(false);
    }
    expect(canGrantPermission(actor({}), "crm.simulators.view")).toBe(false);
  });

  it("permite ao Master delegar uma permissão que possui mesmo com minLevel 100", () => {
    expect(
      canGrantPermission(
        actor({
          roleKey: "master",
          level: 100,
          permissions: ["permissions.manage", "crm.commercial_policy.manage"],
        }),
        "crm.commercial_policy.manage",
      ),
    ).toBe(true);
  });

  it("não permite ao Administrador propagar uma permissão de nível Master", () => {
    expect(
      canGrantPermission(
        actor({ permissions: ["permissions.manage", "crm.commercial_policy.manage"] }),
        "crm.commercial_policy.manage",
      ),
    ).toBe(false);
  });

  it("não transforma o bypass de nível do Master em posse de permissão", () => {
    expect(
      canGrantPermission(actor({ roleKey: "master", level: 100 }), "crm.commercial_policy.manage"),
    ).toBe(false);
  });

  it("mantém a edição restrita a alvos estritamente abaixo do ator", () => {
    const master = actor({ roleKey: "master", level: 100 });

    expect(canManageTargetLevel(master, 80)).toBe(true);
    expect(canManageTargetLevel(master, 100)).toBe(false);
  });

  it("permite ao Administrador delegar os dois acessos aos simuladores que possui", () => {
    const admin = actor({
      permissions: ["permissions.manage", "crm.simulators.view", "crm.simulators.execute"],
    });
    expect(canGrantPermission(admin, "crm.simulators.view")).toBe(true);
    expect(canGrantPermission(admin, "crm.simulators.execute")).toBe(true);
  });

  it("protege Administradores mesmo quando outro Administrador recebe nível numérico maior", () => {
    const elevatedAdmin = actor({ level: 999 });

    expect(canManageTargetLevel(elevatedAdmin, 80)).toBe(true);
    expect(canManageTargetRole(elevatedAdmin, "admin", 80)).toBe(false);
    expect(canAssignRole(elevatedAdmin, "admin")).toBe(false);
  });

  it("permite somente ao Master gerenciar e atribuir o papel Administrador", () => {
    const master = actor({ roleKey: "master", level: 100 });

    expect(canManageTargetRole(master, "admin", 80)).toBe(true);
    expect(canAssignRole(master, "admin")).toBe(true);
  });
});
