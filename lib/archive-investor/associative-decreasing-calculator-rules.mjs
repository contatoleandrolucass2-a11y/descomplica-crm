export const ASSOCIATIVE_DECREASING_PARAMETERS = Object.freeze({
  workflow: "WF-13B",
  scope: "Associativo | Fluxo Decrescente | 4 Blocos",
  preRate: 0.005,
  postRate: 0.015,
  percentages: [0.4, 0.3, 0.2, 0.1],
});

function number(value) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pmt(rate, periods, presentValue) {
  if (!periods || periods <= 0) return 0;
  if (rate === 0) return presentValue / periods;
  const factor = Math.pow(1 + rate, periods);
  return (rate * presentValue * factor) / (factor - 1);
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonthsClamped(value, amount) {
  const monthIndex = value.getUTCFullYear() * 12 + value.getUTCMonth() + amount;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(value.getUTCDate(), lastDay)));
}

function iso(value) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function calculateAssociativeDecreasing(raw) {
  const uncorrectedBalance = Math.max(0, number(raw.uncorrectedBalance ?? raw.correctedBalance));
  const correctedBalance = Math.max(0, number(raw.correctedBalance));
  const rawInstallments = number(raw.installments);
  const rawPreInstallments = number(raw.preInstallments);
  const rawPostInstallments = number(raw.postInstallments);
  const installments = Math.trunc(rawInstallments);
  const preInstallments = Math.max(0, Math.trunc(rawPreInstallments));
  const postInstallments = Math.max(0, Math.trunc(rawPostInstallments));
  const firstInstallmentDate = parseDate(raw.firstInstallmentDate);
  const errors = [];

  if (uncorrectedBalance <= 0) errors.push("Informe um saldo sem correção positivo.");
  if (correctedBalance <= 0) errors.push("Informe um saldo corrigido positivo.");
  if (installments <= 0) errors.push("Informe a quantidade total de parcelas.");
  if (![rawInstallments, rawPreInstallments, rawPostInstallments].every(Number.isInteger))
    errors.push("As quantidades de parcelas devem ser inteiras.");
  if (preInstallments + postInstallments !== installments)
    errors.push("A soma das parcelas pré e pós não fecha a quantidade total.");
  if (!firstInstallmentDate) errors.push("Informe a data da primeira mensal.");

  const regularBlockCount = installments > 0 ? Math.round(installments / 4) : 0;
  const blockCounts = [
    regularBlockCount,
    regularBlockCount,
    regularBlockCount,
    Math.max(0, installments - regularBlockCount * 3),
  ];
  let remainingPre = preInstallments;
  let accumulatedPre = 0;
  let accumulatedPost = 0;
  let elapsedInstallments = 0;

  const blocks = ASSOCIATIVE_DECREASING_PARAMETERS.percentages.map((percentage, index) => {
    const count = blockCounts[index];
    const pre = Math.max(0, Math.min(count, remainingPre));
    const post = Math.max(0, count - pre);
    remainingPre = Math.max(0, remainingPre - pre);

    const uncorrectedBase = uncorrectedBalance * percentage;
    const base = correctedBalance * percentage;
    const prePower = Math.pow(1 + ASSOCIATIVE_DECREASING_PARAMETERS.preRate, pre);
    const postPower = Math.pow(1 + ASSOCIATIVE_DECREASING_PARAMETERS.postRate, post);
    const preVariable =
      pre === 0 ? 0 : (prePower * ASSOCIATIVE_DECREASING_PARAMETERS.preRate) / (prePower - 1);
    const postVariable =
      post === 0
        ? 0
        : prePower * ((postPower * ASSOCIATIVE_DECREASING_PARAMETERS.postRate) / (postPower - 1));
    const prePercentage =
      pre === 0 ? 0 : post === 0 ? 1 : 1 - preVariable / (preVariable + postVariable);
    const postPercentage = post === 0 ? 0 : pre === 0 ? 1 : 1 - prePercentage;
    const prePrincipal = base * prePercentage;
    const postPrincipal = base - prePrincipal;
    const preAdjustment =
      index === 1
        ? Math.pow(1 + ASSOCIATIVE_DECREASING_PARAMETERS.preRate, accumulatedPre) *
          Math.pow(1 + ASSOCIATIVE_DECREASING_PARAMETERS.postRate, accumulatedPost)
        : 1;
    const postAdjustment =
      Math.pow(1 + ASSOCIATIVE_DECREASING_PARAMETERS.preRate, accumulatedPre + pre) *
      Math.pow(1 + ASSOCIATIVE_DECREASING_PARAMETERS.postRate, accumulatedPost);
    const adjustedPre = prePrincipal * preAdjustment;
    const adjustedPost = postPrincipal * postAdjustment;
    const prePayment =
      pre > 0 ? pmt(ASSOCIATIVE_DECREASING_PARAMETERS.preRate, pre, adjustedPre) : 0;
    const postPayment =
      post > 0 ? pmt(ASSOCIATIVE_DECREASING_PARAMETERS.postRate, post, adjustedPost) : 0;
    const correctedInstallment = Math.max(prePayment, postPayment, 0);
    const uncorrectedInstallment = count > 0 ? uncorrectedBase / count : 0;
    const startDate = firstInstallmentDate
      ? addMonthsClamped(firstInstallmentDate, elapsedInstallments)
      : null;
    const endDate = startDate && count > 0 ? addMonthsClamped(startDate, count - 1) : null;

    accumulatedPre += pre;
    accumulatedPost += post;
    elapsedInstallments += count;

    return {
      percentage,
      label: `${Math.round(percentage * 100)}%`,
      uncorrectedBase,
      base,
      count,
      preInstallments: pre,
      postInstallments: post,
      preVariable,
      postVariable,
      prePercentage,
      postPercentage,
      prePrincipal,
      postPrincipal,
      adjustedPre,
      adjustedPost,
      prePayment,
      postPayment,
      uncorrectedInstallment,
      correctedInstallment,
      firstInstallmentDate: iso(startDate),
      lastInstallmentDate: iso(endDate),
    };
  });

  const blockCountClosed = blocks.reduce((total, block) => total + block.count, 0) === installments;
  const preCountClosed =
    blocks.reduce((total, block) => total + block.preInstallments, 0) === preInstallments;
  const postCountClosed =
    blocks.reduce((total, block) => total + block.postInstallments, 0) === postInstallments;
  const allBlocksPayable = blocks.every(
    (block) =>
      block.count > 0 && block.uncorrectedInstallment > 0 && block.correctedInstallment > 0,
  );
  if (!blockCountClosed) errors.push("Os quatro blocos não fecham a quantidade total.");
  if (!preCountClosed || !postCountClosed)
    errors.push("A distribuição pré e pós dos blocos não fecha o plano.");
  if (!allBlocksPayable)
    errors.push("Os quatro blocos precisam ter quantidade e parcela positivas.");

  return {
    ok: errors.length === 0,
    errors,
    workflow: ASSOCIATIVE_DECREASING_PARAMETERS.workflow,
    scope: ASSOCIATIVE_DECREASING_PARAMETERS.scope,
    uncorrectedBalance,
    correctedBalance,
    installments,
    preInstallments,
    postInstallments,
    blocks,
    audit: [
      { label: "Os quatro blocos fecham a quantidade total", ok: blockCountClosed },
      { label: "As quantidades pré e pós fecham o plano", ok: preCountClosed && postCountClosed },
      { label: "Os quatro blocos têm quantidade e parcela positivas", ok: allBlocksPayable },
      {
        label: "Os percentuais monetários fecham 100%",
        ok: Math.abs(blocks.reduce((total, block) => total + block.percentage, 0) - 1) < 0.000001,
      },
    ],
  };
}
