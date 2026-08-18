export const WF13_RANKING_POLICY_VERSION = "wf13-ranking-2026-08-18";

export const WF13_RANKINGS = [
  "DIAMANTE",
  "OURO",
  "PRATA",
  "BRONZE",
  "AÇO",
  "NÃO ELEGÍVEL",
] as const;

export type Wf13Ranking = (typeof WF13_RANKINGS)[number];

export const WF13_RANKING_LIMITS = Object.freeze({
  DIAMANTE: { proSolutoBps: 2_500, incomeCommitmentBps: 2_000, eligible: true },
  OURO: { proSolutoBps: 2_000, incomeCommitmentBps: 2_000, eligible: true },
  PRATA: { proSolutoBps: 1_800, incomeCommitmentBps: 1_800, eligible: true },
  BRONZE: { proSolutoBps: 1_500, incomeCommitmentBps: 1_500, eligible: true },
  AÇO: { proSolutoBps: 1_200, incomeCommitmentBps: 1_000, eligible: true },
  "NÃO ELEGÍVEL": { proSolutoBps: 0, incomeCommitmentBps: 0, eligible: false },
} satisfies Record<
  Wf13Ranking,
  { proSolutoBps: number; incomeCommitmentBps: number; eligible: boolean }
>);

export type Wf13Ratio = Readonly<{ numerator: bigint; denominator: bigint }>;

export type Wf13Violation = {
  code: string;
  message: string;
  fieldPaths: string[];
};

export type Wf13PolicyMetric = {
  value: number;
  rawNumerator: string;
  rawDenominator: string;
  limitBps: number;
  limit: number;
  approved: boolean;
  excessPercentagePoints: number;
};

export type Wf13PolicyEvaluation = {
  policyVersion: string;
  ranking: Wf13Ranking | "";
  proSoluto: Wf13PolicyMetric;
  incomeCommitment: Wf13PolicyMetric;
  status: "APROVADO" | "REPROVADO";
  violations: Wf13Violation[];
};

function ratioValue(ratio: Wf13Ratio): number {
  if (ratio.denominator <= 0n) return 0;
  const scale = 1_000_000_000_000n;
  const scaled = (ratio.numerator * scale * 2n + ratio.denominator) / (ratio.denominator * 2n);
  return Number(scaled) / Number(scale);
}

function metric(ratio: Wf13Ratio, limitBps: number): Wf13PolicyMetric {
  const valid = ratio.denominator > 0n && ratio.numerator >= 0n;
  const approved = valid && ratio.numerator * 10_000n <= ratio.denominator * BigInt(limitBps);
  const value = ratioValue(ratio);
  const limit = limitBps / 10_000;

  return {
    value,
    rawNumerator: ratio.numerator.toString(),
    rawDenominator: ratio.denominator.toString(),
    limitBps,
    limit,
    approved,
    excessPercentagePoints: Math.max(0, (value - limit) * 100),
  };
}

export function evaluateWf13RankingPolicy(input: {
  ranking: Wf13Ranking | "";
  proSoluto: Wf13Ratio;
  incomeCommitment: Wf13Ratio;
}): Wf13PolicyEvaluation {
  const violations: Wf13Violation[] = [];
  const limits = input.ranking ? WF13_RANKING_LIMITS[input.ranking] : null;
  const proSoluto = metric(input.proSoluto, limits?.proSolutoBps ?? 0);
  const incomeCommitment = metric(input.incomeCommitment, limits?.incomeCommitmentBps ?? 0);

  if (!input.ranking) {
    violations.push({
      code: "ranking.required",
      message: "Selecione o ranking informado no Bora Vender.",
      fieldPaths: ["commercialPolicy.ranking"],
    });
  } else if (!limits?.eligible) {
    violations.push({
      code: "ranking.not_eligible",
      message: "Cliente classificado como não elegível.",
      fieldPaths: ["commercialPolicy.ranking"],
    });
  } else {
    if (input.proSoluto.denominator > 0n && !proSoluto.approved) {
      violations.push({
        code: "ranking.pro_soluto_exceeded",
        message: `Pró-soluto acima do permitido para o ranking ${input.ranking}.`,
        fieldPaths: ["result.proSolutoPercentage", "section.proSoluto"],
      });
    }
    if (input.incomeCommitment.denominator > 0n && !incomeCommitment.approved) {
      violations.push({
        code: "ranking.income_commitment_exceeded",
        message: `Comprometimento de renda acima do permitido para o ranking ${input.ranking}.`,
        fieldPaths: [
          "result.incomeCommitment",
          "result.correctedInstallment",
          "officialContext.income",
        ],
      });
    }
  }

  return {
    policyVersion: WF13_RANKING_POLICY_VERSION,
    ranking: input.ranking,
    proSoluto,
    incomeCommitment,
    status:
      violations.length === 0 && proSoluto.approved && incomeCommitment.approved
        ? "APROVADO"
        : "REPROVADO",
    violations,
  };
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function generateWf13AnnualDates(baseDate: string, constructionEnd: string): string[] {
  const start = parseIsoDate(baseDate);
  const end = parseIsoDate(constructionEnd);
  if (!start || !end || end < start) return [];

  const dates: string[] = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const candidate = new Date(Date.UTC(year, 11, 15));
    if (candidate >= start && candidate <= end) dates.push(candidate.toISOString().slice(0, 10));
  }
  return dates;
}
