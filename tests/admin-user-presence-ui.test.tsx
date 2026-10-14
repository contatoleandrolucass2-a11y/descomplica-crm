import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserPresence } from "@/app/(protected)/admin/usuarios/useUserPresence";

const presence = vi.hoisted(() => ({
  values: new Map<string, { status: string; lastSeenAt: null }>(),
}));
vi.mock("@/app/(protected)/admin/usuarios/useUserPresence", () => ({
  useUserPresence: () => presence.values,
}));
vi.mock("@/app/(protected)/admin/usuarios/actions", () => ({
  assignRoleAction: vi.fn(),
  approveUserAccessAction: vi.fn(),
  setPermissionOverridesBulkAction: vi.fn(),
  setUserActiveAction: vi.fn(),
}));

import { UserAccessManager } from "@/app/(protected)/admin/usuarios/UserAccessManager";

const userId = "d4100000-0000-4000-8000-000000000001";

function markup() {
  return renderToStaticMarkup(
    createElement(UserAccessManager, {
      users: [
        {
          userId,
          email: "presenca@example.test",
          isActive: true,
          accessStatus: "approved",
          roleKey: "broker_house",
          isSelf: false,
          isManageable: false,
          overrides: [],
        },
      ],
      assignableRoles: [],
      manageablePermissions: [],
      canManageRoles: false,
      canManagePermissions: false,
      isMasterPermissionManager: false,
      canManageUsers: false,
      canApproveUsers: false,
      reportingScopes: [],
    }),
  );
}

beforeEach(() => presence.values.clear());

describe("admin presence labels", () => {
  it.each([
    ["online", "Online"],
    ["offline", "Offline"],
    ["unknown", "Presença indisponível"],
  ] as const)(
    "shows %s in both the directory and account header without changing active status",
    (status: UserPresence["status"], label) => {
      presence.values.set(userId, { status, lastSeenAt: null });
      const result = markup();
      expect(
        result.match(new RegExp(`class="admin-user-presence-label">${label}`, "g")),
      ).toHaveLength(2);
      expect(result).toContain('data-state="approved">Ativo');
      expect(result).toContain(
        "Online: sinal recebido nos últimos 2 minutos. Atualização a cada 30 segundos.",
      );
    },
  );

  it("starts unavailable and never invents an Offline result", () => {
    const result = markup();
    expect(result.match(/class="admin-user-presence-label">Presença indisponível/g)).toHaveLength(
      2,
    );
    expect(result).not.toContain('class="admin-user-presence-label">Offline');
  });
});
