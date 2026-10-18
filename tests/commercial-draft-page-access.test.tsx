import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/authorization/permissions";

const enforcePageAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authorization/enforce", () => ({ enforcePageAccess }));
vi.mock("@/app/(protected)/app/configuracoes/metas/_components/FunnelGoalsPage", () => ({
  FunnelGoalsPage: () => null,
}));
vi.mock("@/app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage", () => ({
  PointSettingsPage: () => null,
}));

import GoalsPage from "@/app/(protected)/app/configuracoes/metas/page";
import PartnershipGoalsPage from "@/app/(protected)/app/configuracoes/metas/parcerias/page";
import PointGoalsPage from "@/app/(protected)/app/configuracoes/metas/pontos/page";

describe.each([GoalsPage, PartnershipGoalsPage, PointGoalsPage])(
  "commercial draft page gate",
  (page) => {
    it.each([
      { roleKey: "admin", permissions: Object.keys(PERMISSIONS), expected: false },
      { roleKey: "master", permissions: ["crm.commercial_policy.manage"], expected: true },
      { roleKey: "master", permissions: [], expected: false },
    ])(
      "keeps the database restriction for $roleKey with expected access $expected",
      async ({ roleKey, permissions, expected }) => {
        enforcePageAccess.mockResolvedValue({ roleKey, permissions });
        const result = await page({ searchParams: Promise.resolve({ saved: "1" }) });
        expect(enforcePageAccess).toHaveBeenCalledWith(
          page === GoalsPage
            ? "/app/configuracoes/metas"
            : page === PartnershipGoalsPage
              ? "/app/configuracoes/metas/parcerias"
              : "/app/configuracoes/metas/pontos",
        );
        expect(result.props.canManageDraft).toBe(expected);
        expect(result.props.notification).toBe(expected ? "saved" : undefined);
      },
    );
  },
);
