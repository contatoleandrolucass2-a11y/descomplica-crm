import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enforcePermission, loadRankingReadModel } = vi.hoisted(() => ({
  enforcePermission: vi.fn(),
  loadRankingReadModel: vi.fn(),
}));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission }));
vi.mock("@/lib/crm/ranking/data", () => ({ loadRankingReadModel }));
vi.mock("@/lib/crm/qlik/data-v2", () => ({
  loadQlikRankingV2: () => {
    throw new Error("House must never load partnership facts");
  },
}));
import RankingPage from "@/app/(protected)/app/ranking/page";

describe("House ranking remains separate from Canal de Parcerias", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enforcePermission.mockResolvedValue({ permissions: [] });
  });

  it.each(["empty", "unconfigured", "policy_pending"])(
    "keeps House identity and honest %s state",
    async (status) => {
      loadRankingReadModel.mockResolvedValue({ status, legacyConfigurationDetected: true });
      const html = renderToStaticMarkup(await RankingPage({ searchParams: Promise.resolve({}) }));
      expect(enforcePermission).toHaveBeenCalledExactlyOnceWith("crm.ranking.view");
      expect(loadRankingReadModel).toHaveBeenCalledExactlyOnceWith();
      expect(html).toContain("Ranking de corretores da House");
      expect(html).toContain("Desempenho por corretor");
      expect(html).not.toMatch(
        /Ranking das imobiliárias|CANAL IMOB|Publicação Qlik|Top 10 imobiliárias/,
      );
      expect(html).not.toMatch(/\b[0-9]+ pts\b/);
      if (status === "policy_pending") expect(html).toContain("Política oficial pendente");
    },
  );

  it("denies the request before reading House data", async () => {
    enforcePermission.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(RankingPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("FORBIDDEN");
    expect(loadRankingReadModel).not.toHaveBeenCalled();
  });

  it("keeps the existing manager view within House", async () => {
    loadRankingReadModel.mockResolvedValue({
      status: "policy_pending",
      legacyConfigurationDetected: true,
    });
    const html = renderToStaticMarkup(
      await RankingPage({ searchParams: Promise.resolve({ scope: "managers" }) }),
    );
    expect(html).toContain("Ranking de gerentes da House");
    expect(html).not.toContain("/app/canal-de-parcerias?");
  });
});
