import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authorization/guards", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/auth/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { saveFunnelGoalsAction } from "@/app/(protected)/app/configuracoes/metas/actions";

function validGoals() {
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    sales: 12,
    opportunitiesRate: 200,
    appointmentsRate: 180,
    visitsRate: 160,
    foldersRate: 140,
    approvedFoldersRate: 120,
    brokerMinimumMonth1: 1,
    brokerMinimumMonth2: 2,
    brokerMinimumMonth3: 3,
    brokerMinimumMonth4Plus: 4,
    brokerWeeklyAppointments: 5,
    brokerWeeklyVisits: 6,
    brokerWeeklyFolders: 7,
    productiveTeamAppointments: 8,
    productiveTeamVisits: 9,
    productiveTeamFolders: 10,
    productiveTeamSales: 11,
  })) {
    formData.set(key, String(value));
  }
  return formData;
}

describe("saveFunnelGoalsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({});
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
  });

  it("saves the Meta page through the authorized goals RPC", async () => {
    await expect(saveFunnelGoalsAction("dv", validGoals())).rejects.toThrow(
      "REDIRECT:/app/configuracoes/metas?saved=1",
    );

    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("crm.settings.manage");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "upsert_crm_funnel_goals",
      expect.objectContaining({
        p_profile_key: "dv",
        p_sales: 12,
        p_opportunities_rate: 200,
        p_productive_team_sales: 11,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith("/app/configuracoes/metas");
  });

  it("rejects invalid values before calling the database", async () => {
    const formData = validGoals();
    formData.set("sales", "");

    await expect(saveFunnelGoalsAction("dv", formData)).rejects.toThrow(
      "REDIRECT:/app/configuracoes/metas?error=validation",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not widen the action to another goals page", async () => {
    await expect(saveFunnelGoalsAction("partnerships", validGoals())).rejects.toThrow(
      "REDIRECT:/app/configuracoes/metas?error=validation",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
