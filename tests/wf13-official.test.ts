import { describe, expect, it } from "vitest";

import {
  calculateWf13,
  WF13_FORMULA,
  wf13InputSchema,
  type Wf13Input,
} from "@/lib/crm/simulators/official/wf13";
import {
  buildOfficialSimulatorInput,
  officialSimulatorInitialValues,
  officialSimulatorResultRows,
} from "@/lib/crm/simulators/official/client";

import goldenFixture from "./fixtures/wf13-reference-golden.json";

type GoldenCase = {
  caseKey: string;
  input: Wf13Input;
  expected: Record<string, unknown>;
};

const goldenCases = goldenFixture as GoldenCase[];

describe("motor oficial WF13", () => {
  it("mantém a evidência imutável da fonte observada", () => {
    expect(WF13_FORMULA).toMatchObject({
      workflow: "WF-13",
      version: "wf13-1.0.0",
      sourceSha256: "fb55931f353857afc4164ed395a7d86e71ee1fa903985407ceca9e52075f449d",
    });
  });

  it.each(goldenCases)("reproduz sem diferença o caso $caseKey", ({ input, expected }) => {
    const result = calculateWf13(wf13InputSchema.parse(input), { today: "2026-08-13" });
    const comparable = Object.fromEntries(
      Object.keys(expected).map((key) => [key, result[key as keyof typeof result]]),
    );

    expect(comparable).toEqual(expected);
  });

  it("rejeita payload monetário ambíguo ou fora do contrato", () => {
    const standard = goldenCases[0]!.input;

    expect(wf13InputSchema.safeParse({ ...standard, entry: "1.234,56" }).success).toBe(false);
    expect(wf13InputSchema.safeParse({ ...standard, entry: "1.001" }).success).toBe(false);
    expect(wf13InputSchema.safeParse({ ...standard, salePrice: "1000000000001" }).success).toBe(
      false,
    );
    expect(wf13InputSchema.safeParse({ ...standard, unexpected: "field" }).success).toBe(false);
  });

  it("normaliza entrada brasileira no cliente e apresenta somente saída validada", () => {
    const values = {
      ...officialSimulatorInitialValues("associativo-fluxo-linear"),
      "simulator-official-context-development": "Residencial Teste",
      "simulator-official-context-product": "Torre A 101",
      "simulator-official-context-official-match": true,
      "simulator-official-context-effective-date": "2026-08-13",
      "simulator-official-context-construction-end": "2029-12-31",
      "simulator-official-context-income": "10.000,00",
      "simulator-pro-soluto-property-value": "300.000,00",
      "simulator-pro-soluto-financing": "240.000,00",
      "simulator-signals-entry": "15.000,00",
      "simulator-commercial-policy-policy-confirmed": true,
    };
    const input = buildOfficialSimulatorInput("associativo-fluxo-linear", values);

    expect(input).toMatchObject({
      income: "10000.00",
      salePrice: "300000.00",
      financing: "240000.00",
      entry: "15000.00",
      policyLimit: "84",
      installments: "84",
    });
    const result = calculateWf13(wf13InputSchema.parse(input), { today: "2026-08-13" });
    expect(officialSimulatorResultRows("associativo-fluxo-linear", result)).toEqual(
      expect.arrayContaining([
        { label: "Valor real da venda", value: "R$ 300.000,00" },
        { label: "Parcela corrigida", value: "R$ 730,86" },
      ]),
    );
    expect(
      officialSimulatorResultRows("associativo-fluxo-linear", { proSoluto: "bad" }),
    ).toBeNull();
  });
});
