import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MetaAdsServiceCard,
  MetaAdsStatusDetails,
} from "@/app/(protected)/app/configuracoes/conectar-sistemas/MetaAdsIntegration";
import { SalesforceConsoleDialog } from "@/app/(protected)/app/configuracoes/conectar-sistemas/SalesforceConsoleDialog";
import {
  emptyMetaAdsConnectionSnapshot,
  META_ADS_MANAGER_URL,
} from "@/lib/crm/meta-ads/connection-contract";

describe("Meta Ads integration presentation", () => {
  it("distinguishes a connected account session from metric collection", () => {
    const markup = renderToStaticMarkup(
      <MetaAdsStatusDetails
        snapshot={{
          ...emptyMetaAdsConnectionSnapshot("connected"),
          checkedAt: "2026-10-16T15:00:00Z",
          receivedAt: "2026-10-16T15:00:01Z",
        }}
        checking={false}
        consoleAvailable={false}
        onConnect={() => {}}
        onVerify={() => {}}
      />,
    );
    expect(markup).toContain("Sessão conectada");
    expect(markup).toContain("Coleta de métricas");
    expect(markup).toContain("Não configurada");
    expect(markup).toContain("1080988750909489");
    expect(markup).toContain("310106776631136");
    expect(markup).toContain(META_ADS_MANAGER_URL.replaceAll("&", "&amp;"));
    expect(markup).not.toContain("redirect_session_id");
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('type="password"');
  });

  it.each([
    ["unconfigured", "Não configurado"],
    ["waiting", "Não verificado"],
    ["reauth_required", "Login necessário"],
    ["unavailable", "Não conectado"],
    ["stale", "Sem confirmação recente"],
    ["wrong_account", "Conta divergente"],
  ] as const)("renders %s without fabricating session dates", (state, label) => {
    const markup = renderToStaticMarkup(
      <MetaAdsServiceCard snapshot={emptyMetaAdsConnectionSnapshot(state)} />,
    );
    expect(markup).toContain(label);
    expect(markup).toContain("Sem verificação");
    expect(markup).not.toContain("<time");
    expect(markup).not.toContain("Sessão conectada");
  });

  it("gives the Meta console its own accessible title and viewport", () => {
    const markup = renderToStaticMarkup(
      <SalesforceConsoleDialog provider="meta-ads" onClose={() => {}} />,
    );
    expect(markup).toContain('aria-labelledby="meta-ads-console-title"');
    expect(markup).toContain("Meta Ads · Facebook Ads");
    expect(markup).toContain("data-meta-ads-console-screen");
    expect(markup).not.toContain("data-salesforce-console-screen");
    expect(markup).not.toContain('type="password"');
  });

  it("preserves the supplied vector contours and blue symbol across logo themes", () => {
    const light = readFileSync(
      new URL("../public/integrations/meta-light.svg", import.meta.url),
      "utf8",
    );
    const dark = readFileSync(
      new URL("../public/integrations/meta-dark.svg", import.meta.url),
      "utf8",
    );
    expect(light).toContain('<path fill="#001e29"');
    expect(dark).toContain('<path fill="#ffffff"');
    expect(dark).toBe(light.replace('fill="#001e29"', 'fill="#ffffff"'));
    expect(light).not.toMatch(/<image|<text|base64|font-family/i);
    expect(light).toContain('viewBox="0 0 350 360"');
  });
});
