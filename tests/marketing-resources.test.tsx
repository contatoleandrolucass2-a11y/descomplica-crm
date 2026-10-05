import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketingResources } from "@/app/(protected)/app/configuracoes/recurso-mkt/MarketingResources";
import { calculateMarketingResources, parseMarketingMoney } from "@/lib/crm/marketing/resources";

describe("Recurso MKT", () => {
  it("preserves every amount and destination from the supplied reference", () => {
    expect(calculateMarketingResources(250_000, 100_000)).toEqual({
      allocations: [100_000, 75_000, 50_000, 25_000],
      expectedSales: 2,
    });
    const markup = renderToStaticMarkup(<MarketingResources />);
    for (const text of [
      "Recurso MKT",
      "Corretor",
      "Gerente",
      "Regional",
      "Diretor",
      "40%",
      "30%",
      "20%",
      "10%",
      "Anúncio exclusivo quem vendeu",
      "Anúncio distribuído equipe",
      "Anúncio plano de ação improdutivo",
      "Anúncio campeão:",
      "Melhor Conversão: Agendamento x Visita",
      "Melhor Conversão: Visita x Pasta",
      "Melhor Conversão: Pasta x Pasta Aprovada",
      "Melhor Conversão: Pasta Aprovada x Venda",
      "Melhor Conversão: Oportunidade x Venda",
      "TOTAL",
    ])
      expect(markup).toContain(text);
  });

  it("keeps cent allocations equal to the fund and counts only whole sales", () => {
    for (const cents of [0, 1, 2, 3, 9, 11, 101, 250_001, 123_456_789]) {
      const result = calculateMarketingResources(cents, 100_000);
      expect(result.allocations?.reduce((total, value) => total + value, 0)).toBe(cents);
      expect(result.allocations?.every(Number.isSafeInteger)).toBe(true);
    }
    expect(calculateMarketingResources(250_001, 100_000).allocations).toEqual([
      100_001, 75_000, 50_000, 25_000,
    ]);
    expect(calculateMarketingResources(99_999, 100_000).expectedSales).toBe(0);
  });

  it("distinguishes invalid or absent values from a real zero fund", () => {
    for (const value of ["", "-1", "NaN", "1.23", "2,001", "1,2,3", "1000000001"])
      expect(parseMarketingMoney(value)).toBeNull();
    expect(parseMarketingMoney("2.500,00")).toBe(250_000);
    expect(parseMarketingMoney("0,01")).toBe(1);
    expect(calculateMarketingResources(null, 100_000)).toEqual({
      allocations: null,
      expectedSales: null,
    });
    expect(calculateMarketingResources(250_000, 0).expectedSales).toBeNull();
    expect(calculateMarketingResources(0, 100_000)).toEqual({
      allocations: [0, 0, 0, 0],
      expectedSales: 0,
    });
  });

  it("guards the page on the server before rendering the marketing workspace", () => {
    const source = readFileSync("app/(protected)/app/configuracoes/recurso-mkt/page.tsx", "utf8");
    expect(source).toContain('await enforcePermission("crm.settings.manage")');
    expect(source).toContain(
      'getProtectedPageGate("/app/configuracoes/recurso-mkt")?.releaseEnabled',
    );
    expect(source).toContain("forbidden()");
  });
});
