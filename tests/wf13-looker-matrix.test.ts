import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { calculateWf13, wf13InputSchema, type Wf13Input } from "@/lib/crm/simulators/official/wf13";

type MatrixRow = Record<string, string>;

const matrixPath = resolve(process.cwd(), "docs/qa/wf13/looker-site-ranking-matrix.csv");

function readMatrix(): MatrixRow[] {
  const [headerLine, ...lines] = readFileSync(matrixPath, "utf8").trim().split("\n");
  const headers = headerLine!.split(",");
  return lines.map((line) =>
    Object.fromEntries(line.split(",").map((value, index) => [headers[index], value])),
  );
}

function inputFrom(row: MatrixRow): Wf13Input {
  return wf13InputSchema.parse({
    development: "Cenário sintético de paridade",
    product: row.scenario,
    stockMatch: true,
    policyConfirmed: true,
    ranking: row.ranking,
    policyLimit: row.installments,
    installments: row.installments,
    entryDate: row.base_date,
    constructionEnd: row.delivery_date,
    monthlyDueDay: "15",
    income: row.income,
    salePrice: row.sale_price,
    bonus: "0",
    discount: "0",
    cashback: "0",
    cashbackDiscount: "0",
    financing: row.financing,
    subsidy: "0",
    fgts: "0",
    housingCheck: "0",
    entry: row.entry,
    signal1: "0",
    signal1Date: "",
    signal2: "0",
    signal2Date: "",
    signal3: "0",
    signal3Date: "",
    annuals: [],
  });
}

describe("matriz Looker × site do WF13", () => {
  it("mantém os 30 cenários mínimos e seis fronteiras por ranking", () => {
    const rows = readMatrix();

    expect(rows).toHaveLength(30);
    for (const ranking of ["DIAMANTE", "OURO", "PRATA", "BRONZE", "AÇO"]) {
      expect(rows.filter((row) => row.ranking === ranking)).toHaveLength(6);
    }
  });

  it.each(readMatrix())("reconcilia $scenario", (row) => {
    const result = calculateWf13(inputFrom(row), { today: row.base_date! });

    expect(result.realSaleValue).toBe(Number(row.final_value_site));
    expect(result.proSoluto).toBe(Number(row.nominal_pro_site));
    expect(result.nominalInstallment).toBe(Number(row.nominal_monthly_site));
    expect(result.correctedInstallment).toBe(Number(row.corrected_monthly_site));
    expect(result.approval.proSoluto.value * 100).toBeCloseTo(Number(row.pro_pct_site), 2);
    expect(result.approval.incomeCommitment.value * 100).toBeCloseTo(
      Number(row.income_pct_site),
      2,
    );
    expect(result.firstInstallmentDate).toBe(row.first_monthly_site);
    expect(result.annualSchedule.map(({ dueDate }) => dueDate).join("|")).toBe(
      row.annual_dates_site,
    );
    expect(result.approval.status).toBe(row.status_site);
  });
});
