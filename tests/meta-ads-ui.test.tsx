import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetaAdsServiceCard } from "@/app/(protected)/app/configuracoes/conectar-sistemas/MetaAdsIntegration";
import { emptyMetaAdsConnectionSnapshot } from "@/lib/crm/meta-ads/connection-contract";

describe("Meta Ads integration presentation", () => {
  it("keeps only the official read-only API status card", () => {
    const markup = renderToStaticMarkup(
      <MetaAdsServiceCard
        snapshot={{
          ...emptyMetaAdsConnectionSnapshot("connected"),
          checkedAt: "2026-10-16T15:00:00Z",
          receivedAt: "2026-10-16T15:00:01Z",
        }}
      />,
    );
    expect(markup).toContain("Conectado");
    expect(markup).toContain("API oficial somente leitura");
    expect(markup).not.toContain("Conectar Meta Ads");
    expect(markup).not.toContain("Verificar Meta Ads");
    expect(markup).not.toContain("console");
  });

  it.each([
    ["unconfigured", "Não configurado"],
    ["waiting", "Verificando"],
    ["reauth_required", "Autorização necessária"],
    ["unavailable", "Indisponível"],
    ["stale", "Sem verificação recente"],
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
