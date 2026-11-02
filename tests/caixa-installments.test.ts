import { describe, expect, it } from "vitest";
import { calculateHousingSimulation } from "@/lib/crm/simulators/caixa";
import { installments } from "@/app/(protected)/app/simulacao/_components/CaixaInstallments";

describe("CAIXA monthly projection", () => {
  for (const system of ["sac", "price"] as const) {
    it(`reconciles ${system} principal, first payment and final balance`, () => {
      const result = calculateHousingSimulation({
        income: 15000,
        propertyValue: 500000,
        ownFunds: 150000,
        birthDate: "1990-01-01",
        city: "São Paulo",
        state: "SP",
        term: 360,
        product: "sbpe",
        system,
        nominalRate: 11.49,
        propertyCondition: "new",
        asOf: "2026-11-02",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rows = installments(result);
      expect(rows).toHaveLength(result.term);
      expect(rows[0]!.payment).toBeCloseTo(result.firstPayment, 2);
      expect(rows.at(-1)!.balance).toBe(0);
      expect(rows.reduce((sum, row) => sum + row.amortization, 0)).toBeCloseTo(result.financing, 2);
      expect(rows.every((row) => row.balance >= 0)).toBe(true);
    });
  }
});
