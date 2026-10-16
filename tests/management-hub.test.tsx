import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  gate: vi.fn(),
  forbidden: vi.fn(),
  navigation: vi.fn(),
}));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePageAccess: mocks.enforce }));
vi.mock("@/lib/authorization/page-gates", () => ({ getProtectedPageGate: mocks.gate }));
vi.mock("next/navigation", () => ({ forbidden: mocks.forbidden }));
vi.mock("@/lib/navigation/pages", () => ({ getAuthorizedNavigation: mocks.navigation }));

import ManagementHubPage from "@/app/(protected)/app/gestao/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforce.mockResolvedValue({});
  mocks.navigation.mockResolvedValue([{ path: "/app/gestao/rotina" }]);
  mocks.forbidden.mockImplementation(() => {
    throw new Error("Forbidden");
  });
});

describe("Gestão", () => {
  it("links to the released routine after the server permission guard", async () => {
    mocks.gate.mockReturnValue({ releaseEnabled: true });
    const markup = renderToStaticMarkup(await ManagementHubPage());
    expect(mocks.enforce).toHaveBeenCalledWith("/app/gestao");
    expect(markup).toContain('href="/app/gestao/rotina"');
    expect(markup).toContain("Rotina liberada");
  });

  it("keeps an unavailable routine visible without an actionable link", async () => {
    mocks.gate.mockImplementation((path: string) => ({ releaseEnabled: path === "/app/gestao" }));
    const markup = renderToStaticMarkup(await ManagementHubPage());
    expect(markup).toContain("Rotina indisponível");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toContain('href="/app/gestao/rotina"');
  });

  it("denies the management hub when its own release is unavailable", async () => {
    mocks.gate.mockReturnValue({ releaseEnabled: false });
    await expect(ManagementHubPage()).rejects.toThrow("Forbidden");
  });
  it("does not link a routine denied for the selected user", async () => {
    mocks.gate.mockReturnValue({ releaseEnabled: true });
    mocks.navigation.mockResolvedValue([]);
    const markup = renderToStaticMarkup(await ManagementHubPage());
    expect(markup).not.toContain('href="/app/gestao/rotina"');
    expect(markup).toContain("Rotina indisponível");
  });
});
