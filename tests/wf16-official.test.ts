import { describe, expect, it } from "vitest";

import {
  calculateWf16,
  WF16_FORMULA,
  WF16_REFERENCE_TABLES,
  wf16InputSchema,
  type Wf16Input,
} from "@/lib/crm/simulators/official/wf16";
import {
  buildOfficialSimulatorInput,
  officialSimulatorInitialValues,
  officialSimulatorResultRows,
} from "@/lib/crm/simulators/official/client";

import goldenFixture from "./fixtures/wf16-reference-golden.json";

type GoldenCase = {
  caseKey: string;
  input: Wf16Input;
  expected: Record<string, unknown>;
};

const goldenCases = goldenFixture as GoldenCase[];

describe("motor oficial WF16", () => {
  it("mantém a evidência imutável da fonte observada", () => {
    expect(WF16_FORMULA).toMatchObject({
      workflow: "WF-16",
      version: "wf16-1.0.0",
      sourceSha256: "1bde87c5c9f3abad9841c5187f9b4457e0b67b01eb7d839639c2896cbc88dca8",
    });
    expect(WF16_REFERENCE_TABLES.registrationTable).toHaveLength(48);
  });

  it.each(goldenCases)("reproduz sem diferença o caso $caseKey", ({ input, expected }) => {
    const result = calculateWf16(wf16InputSchema.parse(input));
    const comparable = Object.fromEntries(
      Object.keys(expected).map((key) => [key, result[key as keyof typeof result]]),
    );

    expect(comparable).toEqual(expected);
  });

  it("rejeita payload ambíguo ou fora do contrato", () => {
    const standard = goldenCases[0]!.input;

    expect(wf16InputSchema.safeParse({ ...standard, salePrice: "1.234,56" }).success).toBe(false);
    expect(wf16InputSchema.safeParse({ ...standard, salePrice: "1000000000001" }).success).toBe(
      false,
    );
    expect(wf16InputSchema.safeParse({ ...standard, unexpected: "field" }).success).toBe(false);
  });

  it("normaliza a entrada brasileira e apresenta somente saída validada", () => {
    const values = {
      ...officialSimulatorInitialValues("calcular-documentacao"),
      "simulator-profile-builder": "Direcional",
      "simulator-purchase-type-modality": "MCMV",
      "simulator-purchase-type-first-property": "Sim",
      "simulator-values-property-value": "240.000,00",
      "simulator-values-bank-appraisal": "250.000,00",
      "simulator-values-financing": "190.000,00",
      "simulator-values-family-income": "6.000,00",
      "simulator-values-base-date": "2026-08-13",
      "simulator-values-requested-first-installment": "",
    };
    const input = buildOfficialSimulatorInput("calcular-documentacao", values);

    expect(input).toEqual({
      ...goldenCases[0]!.input,
      salePrice: "240000.00",
      appraisalValue: "250000.00",
      financing: "190000.00",
      income: "6000.00",
    });
    const result = calculateWf16(wf16InputSchema.parse(input));
    expect(officialSimulatorResultRows("calcular-documentacao", result)).toEqual(
      expect.arrayContaining([
        { label: "Total da documentação", value: "R$ 3.951,99" },
        { label: "Valor da parcela", value: "R$ 132,10" },
        { label: "Primeiro vencimento", value: "2026-12-10" },
      ]),
    );
    expect(
      officialSimulatorResultRows("calcular-documentacao", { maximumFinancing: "bad" }),
    ).toBeNull();
  });
});
