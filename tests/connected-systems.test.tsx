import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  permission: vi.fn(),
  ingest: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission: mocks.enforce }));
vi.mock("@/lib/authorization/guards", () => ({ hasPermission: mocks.permission }));
vi.mock("@/lib/crm/salesforce/config", () => ({
  getSalesforceIngestConfiguration: mocks.ingest,
  getSalesforceRefreshConfiguration: mocks.refresh,
}));

import ConnectedSystemsPage from "@/app/(protected)/app/configuracoes/conectar-sistemas/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforce.mockResolvedValue({});
  mocks.permission.mockReturnValue(false);
  mocks.ingest.mockReturnValue({ enabled: false, available: false });
  mocks.refresh.mockReturnValue({ enabled: false, available: false });
});

describe("connected systems", () => {
  it("stops before reading configuration when management access is denied", async () => {
    mocks.enforce.mockRejectedValue(new Error("forbidden"));
    await expect(ConnectedSystemsPage()).rejects.toThrow("forbidden");
    expect(mocks.enforce).toHaveBeenCalledWith("crm.settings.manage");
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("does not expose secrets or imply a connected session from configuration alone", async () => {
    mocks.ingest.mockReturnValue({
      enabled: true,
      available: true,
      ingestSecret: "private-ingest",
    });
    mocks.refresh.mockReturnValue({
      enabled: true,
      available: true,
      refreshSecret: "private-refresh",
      refreshUrl: new URL("https://private.example.test/webhook"),
    });
    const markup = renderToStaticMarkup(await ConnectedSystemsPage());
    expect(markup).toContain("Sessão não verificada");
    expect(markup).toContain("Configurada");
    expect(markup).not.toContain("private-");
    expect(markup).not.toContain("private.example.test");
    expect(markup).not.toContain("Atualizar Salesforce");
    expect(markup).not.toContain('type="password"');
  });

  it("keeps manual refresh disabled with incomplete configuration even with permission", async () => {
    mocks.permission.mockReturnValue(true);
    mocks.refresh.mockReturnValue({ enabled: true, available: false });
    const markup = renderToStaticMarkup(await ConnectedSystemsPage());
    expect(markup).toContain("Configuração incompleta");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Atualização indisponível");
    expect(markup).toContain('class="max-w-xs text-xs text-[var(--analytics-muted)]"');
  });

  it("allows the existing refresh control only with permission and complete configuration", async () => {
    mocks.permission.mockReturnValue(true);
    mocks.refresh.mockReturnValue({ enabled: true, available: true });
    const markup = renderToStaticMarkup(await ConnectedSystemsPage());
    expect(markup).toContain("Atualizar Salesforce");
    expect(markup).toContain(
      'aria-live="polite" class="max-w-xs text-xs text-[var(--analytics-muted)]"',
    );
    expect(mocks.permission).toHaveBeenCalledWith({}, "crm.salesforce.refresh");
  });
});
