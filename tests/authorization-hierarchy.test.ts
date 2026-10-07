import { describe, expect, it } from "vitest";

import { canGrantPermission, canManageTargetLevel } from "@/lib/authorization/hierarchy";
import type { AuthorizationContext } from "@/lib/authorization/types";

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
  it("permite ao Master delegar uma permissão que possui mesmo com minLevel 100", () => {
    expect(
      canGrantPermission(
        actor({
          roleKey: "master",
          level: 100,
          permissions: ["permissions.manage", "crm.simulators.view"],
        }),
        "crm.simulators.view",
      ),
    ).toBe(true);
  });

  it("não permite ao Administrador propagar uma permissão de nível Master", () => {
    expect(
      canGrantPermission(
        actor({ permissions: ["permissions.manage", "crm.simulators.view"] }),
        "crm.simulators.view",
      ),
    ).toBe(false);
  });

  it("não transforma o bypass de nível do Master em posse de permissão", () => {
    expect(
      canGrantPermission(actor({ roleKey: "master", level: 100 }), "crm.simulators.view"),
    ).toBe(false);
  });

  it("mantém a edição restrita a alvos estritamente abaixo do ator", () => {
    const master = actor({ roleKey: "master", level: 100 });

    expect(canManageTargetLevel(master, 80)).toBe(true);
    expect(canManageTargetLevel(master, 100)).toBe(false);
  });
});
