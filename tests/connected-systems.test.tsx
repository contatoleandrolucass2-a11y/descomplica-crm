import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  permission: vi.fn(),
  ingest: vi.fn(),
  refresh: vi.fn(),
  status: vi.fn(),
}));

vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission: mocks.enforce }));
vi.mock("@/lib/authorization/guards", () => ({ hasPermission: mocks.permission }));
vi.mock("@/lib/crm/salesforce/config", () => ({
  getSalesforceIngestConfiguration: mocks.ingest,
  getSalesforceRefreshConfiguration: mocks.refresh,
  getSalesforceStatusConfiguration: mocks.status,
}));

import ConnectedSystemsPage from "@/app/(protected)/app/configuracoes/conectar-sistemas/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforce.mockResolvedValue({});
  mocks.permission.mockReturnValue(false);
  mocks.ingest.mockReturnValue({ enabled: false, available: false });
  mocks.refresh.mockReturnValue({ enabled: false, available: false });
  mocks.status.mockReturnValue({ enabled: true, available: true });
});

describe("connected systems", () => {
  it("stops before reading configuration when management access is denied", async () => {
    mocks.enforce.mockRejectedValue(new Error("forbidden"));
    await expect(ConnectedSystemsPage()).rejects.toThrow("forbidden");
    expect(mocks.enforce).toHaveBeenCalledWith("crm.settings.manage");
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
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
    expect(markup).toContain("Não verificado");
    expect(markup).toContain("Configurada");
    expect(markup).not.toContain("private-");
    expect(markup).not.toContain("private.example.test");
    expect(markup).not.toContain("Atualizar Salesforce");
    expect(markup).not.toContain('type="password"');
    expect(markup).toContain("Autenticação manual com MFA");
    expect(markup).not.toContain("Login no navegador não autentica o coletor.");
  });

  it("keeps manual refresh disabled with incomplete configuration even with permission", async () => {
    mocks.permission.mockReturnValue(true);
    mocks.ingest.mockReturnValue({ enabled: true, available: false });
    mocks.refresh.mockReturnValue({ enabled: true, available: false });
    const markup = renderToStaticMarkup(await ConnectedSystemsPage());
    expect(markup).toContain("Configuração incompleta");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Atualização indisponível");
    expect(markup).toContain("Sem publicação confirmada");
  });

  it("allows the existing refresh control only with permission and complete configuration", async () => {
    mocks.permission.mockReturnValue(true);
    mocks.refresh.mockReturnValue({ enabled: true, available: true });
    const markup = renderToStaticMarkup(await ConnectedSystemsPage());
    expect(markup).toContain("Atualizar Salesforce");
    expect(markup).toContain('aria-live="polite"');
    expect(mocks.permission).toHaveBeenCalledWith({}, "crm.salesforce.refresh");
  });

  it("passes only presentation values to the client panel", async () => {
    mocks.status.mockReturnValue({
      enabled: true,
      available: true,
      statusSecret: "private-status",
    });
    expect((await ConnectedSystemsPage()).props).toEqual({
      ingestLabel: "Desativada",
      canRefresh: false,
      refreshAvailable: false,
      statusConfigured: true,
    });
  });

  it("renders seven report links without fabricating counts, dates or a schedule", async () => {
    mocks.status.mockReturnValue({ enabled: false, available: false });
    const markup = renderToStaticMarkup(await ConnectedSystemsPage());
    expect(markup).toContain("Não conectado");
    expect(markup.match(/lightning\/r\/Report\//g)).toHaveLength(7);
    expect(markup.match(/Sem dados/g)).toHaveLength(7);
    expect(markup).toContain("Sem agenda confirmada");
    expect(markup).not.toContain("<time");
    expect(markup).not.toContain("30 minutos");
    expect(markup).toContain('aria-label="Verificar conexão"');
    expect(markup).toContain('data-simulation-page-heading="true"');
  });
});
