import { describe, expect, it } from "vitest";

import {
  CAIXA_FORMULA,
  calculateCaixa,
  caixaInputSchema,
  caixaResultSchema,
} from "@/lib/crm/simulators/official/caixa";
import {
  calculateWf14,
  WF14_FORMULA,
  wf14InputSchema,
  wf14ResultSchema,
} from "@/lib/crm/simulators/official/wf14";
import {
  calculateWf15,
  WF15_FORMULA,
  wf15InputSchema,
  wf15ResultSchema,
} from "@/lib/crm/simulators/official/wf15";
import {
  calculateWf16,
  WF16_FORMULA,
  wf16InputSchema,
  wf16ResultSchema,
} from "@/lib/crm/simulators/official/wf16";

import fixture from "./fixtures/legacy-reference-simulators-golden.json";

const formulas = {
  wf16: WF16_FORMULA,
  caixa: CAIXA_FORMULA,
  wf14: WF14_FORMULA,
  wf15: WF15_FORMULA,
};

const engines = {
  wf16: {
    input: wf16InputSchema,
    result: wf16ResultSchema,
    calculate: (input: unknown) => calculateWf16(wf16InputSchema.parse(input)),
  },
  caixa: {
    input: caixaInputSchema,
    result: caixaResultSchema,
    calculate: (input: unknown) => calculateCaixa(caixaInputSchema.parse(input)),
  },
  wf14: {
    input: wf14InputSchema,
    result: wf14ResultSchema,
    calculate: (input: unknown) => calculateWf14(wf14InputSchema.parse(input)),
  },
  wf15: {
    input: wf15InputSchema,
    result: wf15ResultSchema,
    calculate: (input: unknown) => calculateWf15(wf15InputSchema.parse(input)),
  },
} as const;

describe("motores oficiais derivados da referência congelada", () => {
  it("fixa origem, versão, hash e casos de ouro sintéticos", () => {
    expect(fixture.provenance).toBe("legacy-reference-2026-08-28");

    for (const golden of fixture.cases) {
      const engine = golden.engine as keyof typeof engines;
      const first = engines[engine].calculate(golden.input);
      const second = engines[engine].calculate(golden.input);

      expect(formulas[engine]).toMatchObject({
        provenance: fixture.provenance,
        sourceSha256: golden.sourceSha256,
      });
      expect(first).toEqual(second);
      expect(first).toMatchObject(golden.expected);
      expect(engines[engine].result.safeParse(first).success).toBe(true);
    }
  });

  it("rejeita payload forjado, moeda inexata e campos não declarados", () => {
    for (const golden of fixture.cases) {
      const engine = golden.engine as keyof typeof engines;
      expect(
        engines[engine].input.safeParse({ ...golden.input, commercialApproval: "APROVADO" })
          .success,
      ).toBe(false);
    }

    expect(
      wf16InputSchema.safeParse({ ...fixture.cases[0]!.input, salePrice: "1.234,56" }).success,
    ).toBe(false);
    expect(
      caixaInputSchema.safeParse({ ...fixture.cases[1]!.input, propertyValue: "-1" }).success,
    ).toBe(false);
  });

  it("reconcilia cada cenário em centavos sem resíduos binários", () => {
    const wf14 = calculateWf14(wf14InputSchema.parse(fixture.cases[2]!.input));
    const wf15 = calculateWf15(wf15InputSchema.parse(fixture.cases[3]!.input));

    for (const scenario of wf14.scenarios) {
      const entry = scenario.payments.reduce(
        (total, payment) => total + BigInt(payment.valueCents),
        0n,
      );
      expect(entry).toBe(BigInt(wf14.valueRealCents) / 10n);
    }
    for (const scenario of wf15.scenarios) {
      expect(
        BigInt(scenario.entryCents) +
          BigInt(scenario.signalTotalCents) +
          BigInt(scenario.intermediaryTotalCents) +
          BigInt(scenario.balanceCents),
      ).toBe(BigInt(wf15.valueRealCents));
      expect(
        BigInt(scenario.installmentValueCents) * BigInt(scenario.installments - 1) +
          BigInt(scenario.lastInstallmentValueCents),
      ).toBe(BigInt(scenario.balanceCents));
    }
  });

  it("falha fechado como rejeição de negócio sem lançar em entradas monetárias válidas", () => {
    const untrustedInventory = calculateWf15(
      wf15InputSchema.parse({ ...fixture.cases[3]!.input, inventoryMatch: false }),
    );
    const missingCaixaValues = calculateCaixa(
      caixaInputSchema.parse({
        ...fixture.cases[1]!.input,
        income: "0",
        propertyValue: "0",
      }),
    );
    const financingAboveSale = calculateWf16(
      wf16InputSchema.parse({ ...fixture.cases[0]!.input, financing: "400000" }),
    );

    expect(untrustedInventory).toMatchObject({ ok: false, scenarios: [] });
    expect(missingCaixaValues).toMatchObject({ ok: false, commitmentBps: 0 });
    expect(financingAboveSale).toMatchObject({ ok: false });
  });

  it("preserva os limites distintivos observados sem conceder autoridade oficial", () => {
    const wf16 = calculateWf16(
      wf16InputSchema.parse({
        ...fixture.cases[0]!.input,
        firstProperty: false,
        requestedFirstInstallment: "2026-09-09",
      }),
    );
    const caixa = calculateCaixa(
      caixaInputSchema.parse({
        ...fixture.cases[1]!.input,
        income: "14000",
        propertyValue: "700000",
      }),
    );
    const parking = calculateWf14(
      wf14InputSchema.parse({ ...fixture.cases[2]!.input, plant: "2 dormitórios + Vaga" }),
    );

    expect(wf16).toMatchObject({
      effectiveModality: "spbe",
      modalityForced: true,
      financingRateBps: 9000,
      firstInstallmentCorrected: true,
    });
    expect(caixa).toMatchObject({
      product: "sbpe",
      forcedSbpe: true,
      validation: "indicative_requires_caixa_confirmation",
    });
    expect(parking).toMatchObject({
      parking: true,
      preKeysRateBps: 4000,
      postKeysRateBps: 5000,
      postKeysInstallments: 66,
    });
  });
});
