import { describe, expect, it } from "vitest";

import {
  evaluateWf13RankingPolicy,
  generateWf13AnnualDates,
  WF13_RANKING_LIMITS,
  type Wf13Ranking,
} from "@/lib/crm/simulators/official/wf13-policy";

const eligibleRankings = ["DIAMANTE", "OURO", "PRATA", "BRONZE", "AÇO"] as const;

function ratioBps(basisPoints: number) {
  return { numerator: BigInt(basisPoints), denominator: 10_000n };
}

const rankingScenarios = eligibleRankings.flatMap((ranking) => {
  const limits = WF13_RANKING_LIMITS[ranking];
  return [
    {
      name: `${ranking}: ambos abaixo`,
      ranking,
      pro: limits.proSolutoBps - 1,
      income: limits.incomeCommitmentBps - 1,
      status: "APROVADO",
      violations: 0,
    },
    {
      name: `${ranking}: pró-soluto exatamente no limite`,
      ranking,
      pro: limits.proSolutoBps,
      income: limits.incomeCommitmentBps - 1,
      status: "APROVADO",
      violations: 0,
    },
    {
      name: `${ranking}: pró-soluto 0,01 p.p. acima`,
      ranking,
      pro: limits.proSolutoBps + 1,
      income: limits.incomeCommitmentBps - 1,
      status: "REPROVADO",
      violations: 1,
    },
    {
      name: `${ranking}: renda exatamente no limite`,
      ranking,
      pro: limits.proSolutoBps - 1,
      income: limits.incomeCommitmentBps,
      status: "APROVADO",
      violations: 0,
    },
    {
      name: `${ranking}: renda 0,01 p.p. acima`,
      ranking,
      pro: limits.proSolutoBps - 1,
      income: limits.incomeCommitmentBps + 1,
      status: "REPROVADO",
      violations: 1,
    },
    {
      name: `${ranking}: ambos acima`,
      ranking,
      pro: limits.proSolutoBps + 1,
      income: limits.incomeCommitmentBps + 1,
      status: "REPROVADO",
      violations: 2,
    },
  ] as const;
});

describe("política de ranking do WF13", () => {
  it.each(rankingScenarios)("avalia $name", ({ ranking, pro, income, status, violations }) => {
    const result = evaluateWf13RankingPolicy({
      ranking,
      proSoluto: ratioBps(pro),
      incomeCommitment: ratioBps(income),
    });

    expect(result.status).toBe(status);
    expect(result.violations).toHaveLength(violations);
  });

  it("rejeita ranking ausente e não elegível sem tratá-los como faixa comercial", () => {
    const values = { proSoluto: ratioBps(0), incomeCommitment: ratioBps(0) };
    const missing = evaluateWf13RankingPolicy({ ranking: "", ...values });
    const notEligible = evaluateWf13RankingPolicy({ ranking: "NÃO ELEGÍVEL", ...values });

    expect(missing.status).toBe("REPROVADO");
    expect(missing.violations[0]?.code).toBe("ranking.required");
    expect(notEligible.status).toBe("REPROVADO");
    expect(notEligible.violations[0]).toMatchObject({
      code: "ranking.not_eligible",
      message: "Cliente classificado como não elegível.",
    });
  });

  it("mantém comparação exata apesar da apresentação em duas casas", () => {
    const ranking: Wf13Ranking = "BRONZE";
    const exact = evaluateWf13RankingPolicy({
      ranking,
      proSoluto: { numerator: 15n, denominator: 100n },
      incomeCommitment: { numerator: 15n, denominator: 100n },
    });
    const fractionAbove = evaluateWf13RankingPolicy({
      ranking,
      proSoluto: { numerator: 150_000_001n, denominator: 1_000_000_000n },
      incomeCommitment: { numerator: 15n, denominator: 100n },
    });

    expect(exact.status).toBe("APROVADO");
    expect(fractionAbove.proSoluto.value).toBeCloseTo(0.150000001, 9);
    expect(fractionAbove.status).toBe("REPROVADO");
  });
});

describe("calendário anual do WF13", () => {
  it.each([
    {
      name: "três anuais durante as obras",
      base: "2026-08-01",
      end: "2029-02-28",
      dates: ["2026-12-15", "2027-12-15", "2028-12-15"],
    },
    {
      name: "data-base posterior a 15/12",
      base: "2026-12-16",
      end: "2028-12-15",
      dates: ["2027-12-15", "2028-12-15"],
    },
    {
      name: "entrega antes de 15/12",
      base: "2026-08-01",
      end: "2028-12-14",
      dates: ["2026-12-15", "2027-12-15"],
    },
    {
      name: "entrega exatamente em 15/12",
      base: "2026-08-01",
      end: "2028-12-15",
      dates: ["2026-12-15", "2027-12-15", "2028-12-15"],
    },
    {
      name: "data-base exatamente em 15/12",
      base: "2026-12-15",
      end: "2026-12-15",
      dates: ["2026-12-15"],
    },
    {
      name: "nenhuma data disponível",
      base: "2026-12-16",
      end: "2027-12-14",
      dates: [],
    },
  ])("gera $name", ({ base, end, dates }) => {
    expect(generateWf13AnnualDates(base, end)).toEqual(dates);
  });

  it("falha fechado para datas inválidas ou invertidas", () => {
    expect(generateWf13AnnualDates("2026-02-29", "2028-12-15")).toEqual([]);
    expect(generateWf13AnnualDates("2028-12-15", "2026-12-15")).toEqual([]);
  });
});
