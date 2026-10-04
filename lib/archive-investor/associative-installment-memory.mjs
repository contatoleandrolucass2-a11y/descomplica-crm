import { ASSOCIATIVE_LINEAR_PARAMETERS } from "./associative-linear-calculator-rules.mjs";

function knownNonNegativeNumber(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function buildAssociativeInstallmentMemory({
  monthlyDates,
  preInstallments,
  postInstallments,
  adjustedPre,
  adjustedPost,
  prePayment,
  postPayment,
}) {
  const schedule = [];
  const appendPhase = (phase, count, principal, rate, payment) => {
    let balance = Math.max(0, Number(principal) || 0);
    for (let index = 0; index < count && balance > 0; index += 1) {
      const interest = balance * rate;
      const amortization = Math.min(balance, Math.max(0, payment - interest));
      const nextBalance = Math.max(0, balance - amortization);
      schedule.push({
        installment: schedule.length + 1,
        phase,
        paymentDate: monthlyDates[schedule.length] ?? "",
        rate,
        openingBalance: balance,
        amortization,
        interest,
        payment: interest + amortization,
        balance: nextBalance < 0.005 ? 0 : nextBalance,
      });
      balance = nextBalance;
    }
  };

  appendPhase(
    "Pré-obra",
    preInstallments,
    adjustedPre,
    ASSOCIATIVE_LINEAR_PARAMETERS.preRate,
    prePayment,
  );
  appendPhase(
    "Pós-obra",
    postInstallments,
    adjustedPost,
    ASSOCIATIVE_LINEAR_PARAMETERS.postRate,
    postPayment,
  );
  return schedule;
}

export function buildAssociativePaymentComparison({
  monthlyDates = [],
  installments = 0,
  linearSchedule = [],
  decreasingBlocks = [],
  income = 0,
  constructionProgress = null,
  baseDate = "",
  completionDate = "",
  entryPayment = null,
  signals = [],
  annuals = [],
}) {
  const rawProgress = knownNonNegativeNumber(constructionProgress);
  const normalizedProgress =
    rawProgress == null || rawProgress > 100
      ? null
      : rawProgress > 1
        ? rawProgress / 100
        : rawProgress;
  const safeIncome = knownNonNegativeNumber(income) ?? 0;
  const safeInstallments = Math.max(0, Math.trunc(Number(installments) || 0));
  const decreasingPayments = decreasingBlocks.flatMap((block) =>
    Array.from({ length: Math.max(0, Math.trunc(Number(block.count) || 0)) }, () =>
      knownNonNegativeNumber(block.correctedInstallment),
    ),
  );
  const isoMonth = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(value || ""));
    if (!match) return null;
    const parsed = new Date(`${value}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      ordinal: Number(match[1]) * 12 + Number(match[2]) - 1,
    };
  };
  const baseMonth = isoMonth(baseDate);
  const completionMonth = isoMonth(completionDate);
  const workEvolutionAvailable = Boolean(
    normalizedProgress != null && safeIncome > 0 && baseMonth && completionMonth,
  );
  const withinSignatureWindow = (paymentDate) => {
    const paymentMonth = isoMonth(paymentDate);
    return Boolean(baseMonth && paymentMonth && paymentMonth.ordinal <= baseMonth.ordinal + 1);
  };
  const progressAt = (paymentDate) => {
    if (normalizedProgress == null) return null;
    const paymentMonth = isoMonth(paymentDate);
    if (!paymentMonth || !baseMonth || !completionMonth) return null;
    if (paymentMonth.ordinal >= completionMonth.ordinal) return 1;
    const duration = Math.max(1, completionMonth.ordinal - baseMonth.ordinal);
    const elapsed = Math.min(duration, Math.max(0, paymentMonth.ordinal - baseMonth.ordinal));
    return Math.min(1, normalizedProgress + (1 - normalizedProgress) * (elapsed / duration));
  };
  const workEvolutionAt = (paymentDate, progress) => {
    const paymentMonth = isoMonth(paymentDate);
    if (progress == null || !workEvolutionAvailable || !paymentMonth) return null;
    // Regra comercial: o mes da simulacao e o mes seguinte formam a janela de assinatura.
    if (paymentMonth.ordinal <= baseMonth.ordinal + 1) return null;
    return safeIncome * 0.3 * progress;
  };
  const monthlyRows = monthlyDates.slice(0, safeInstallments).map((paymentDate, index) => {
    const linearPayment = knownNonNegativeNumber(linearSchedule[index]?.payment);
    const decreasingPayment = decreasingPayments[index] ?? null;
    const progress = progressAt(paymentDate);
    const workEvolution = workEvolutionAt(paymentDate, progress);
    const workKnown = withinSignatureWindow(paymentDate) || workEvolution != null;
    const linearTotal =
      linearPayment != null && workKnown ? linearPayment + (workEvolution ?? 0) : null;
    const decreasingTotal =
      decreasingPayment != null && workKnown ? decreasingPayment + (workEvolution ?? 0) : null;
    return {
      kind: "monthly",
      installment: index + 1,
      label: "Mensal",
      paymentDate,
      paymentValue: 0,
      constructionProgress: progress,
      workEvolution,
      workEvolutionAvailable: workKnown,
      annualPayment: 0,
      linearPayment,
      linearTotal,
      linearIncomeRate: safeIncome > 0 && linearTotal != null ? linearTotal / safeIncome : null,
      decreasingPayment,
      decreasingTotal,
      decreasingIncomeRate:
        safeIncome > 0 && decreasingTotal != null ? decreasingTotal / safeIncome : null,
    };
  });

  const annualRows = annuals
    .map((annual, index) => ({
      index: Math.max(1, Math.trunc(Number(annual?.index) || index + 1)),
      paymentDate: String(annual?.paymentDate ?? annual?.date ?? ""),
      value: Math.max(0, Number(annual?.correctedValue ?? annual?.value) || 0),
      approved: annual?.approved !== false,
    }))
    .filter((annual) => annual.approved && annual.value > 0 && isoMonth(annual.paymentDate));
  const annualByDate = new Map();
  for (const annual of annualRows) {
    const previous = annualByDate.get(annual.paymentDate) ?? { value: 0, labels: [] };
    annualByDate.set(annual.paymentDate, {
      value: previous.value + annual.value,
      labels: [...previous.labels, `Anual ${annual.index}`],
    });
  }
  const mergedMonthlyRows = monthlyRows.map((row) => {
    const annual = annualByDate.get(row.paymentDate);
    if (!annual) return row;
    annualByDate.delete(row.paymentDate);
    const linearTotal = row.linearTotal == null ? null : row.linearTotal + annual.value;
    const decreasingTotal = row.decreasingTotal == null ? null : row.decreasingTotal + annual.value;
    return {
      ...row,
      annualPayment: annual.value,
      annualLabel: annual.labels.join(" + "),
      linearTotal,
      decreasingTotal,
      linearIncomeRate: safeIncome > 0 && linearTotal != null ? linearTotal / safeIncome : null,
      decreasingIncomeRate:
        safeIncome > 0 && decreasingTotal != null ? decreasingTotal / safeIncome : null,
    };
  });
  const annualOnlyRows = [...annualByDate.entries()].map(([paymentDate, annual]) => ({
    kind: "annual",
    installment: null,
    label: annual.labels.join(" + "),
    paymentDate,
    paymentValue: annual.value,
    constructionProgress: progressAt(paymentDate),
    workEvolution: null,
    annualPayment: annual.value,
    linearPayment: 0,
    linearTotal: annual.value,
    linearIncomeRate: safeIncome > 0 ? annual.value / safeIncome : null,
    decreasingPayment: 0,
    decreasingTotal: annual.value,
    decreasingIncomeRate: safeIncome > 0 ? annual.value / safeIncome : null,
  }));
  const orderedUpfront = [entryPayment, ...signals]
    .filter(Boolean)
    .map((payment, index) => ({
      kind: payment.kind === "entry" || payment.label === "Entrada" ? "entry" : "signal",
      installment: null,
      label: String(payment.label || (index === 0 ? "Entrada" : `Sinal ${index}`)),
      paymentDate: String(payment.paymentDate ?? payment.date ?? ""),
      paymentValue: Math.max(0, Number(payment.value) || 0),
      constructionProgress: progressAt(String(payment.paymentDate ?? payment.date ?? "")),
      workEvolution: null,
      annualPayment: 0,
      linearPayment: Math.max(0, Number(payment.value) || 0),
      linearTotal: Math.max(0, Number(payment.value) || 0),
      linearIncomeRate: null,
      decreasingPayment: 0,
      decreasingTotal: 0,
      decreasingIncomeRate: null,
    }))
    .filter((payment) => payment.paymentValue > 0 && isoMonth(payment.paymentDate));
  // A evolucao pertence ao mes: sinais e anuais tambem cobrem meses sem mensal.
  const chargedMonths = new Set(
    monthlyRows
      .filter((row) => row.workEvolution != null)
      .map((row) => isoMonth(row.paymentDate)?.ordinal),
  );
  const withWorkEvolution = (row) => {
    const month = isoMonth(row.paymentDate)?.ordinal;
    const workEvolution = workEvolutionAt(row.paymentDate, row.constructionProgress);
    if (withinSignatureWindow(row.paymentDate) || chargedMonths.has(month))
      return { ...row, workEvolutionAvailable: true };
    if (workEvolution == null)
      return {
        ...row,
        workEvolutionAvailable: false,
        linearTotal: null,
        decreasingTotal: null,
        linearIncomeRate: null,
        decreasingIncomeRate: null,
      };
    chargedMonths.add(month);
    const linearTotal = row.linearTotal + workEvolution;
    const decreasingTotal = row.decreasingTotal + workEvolution;
    return {
      ...row,
      workEvolution,
      workEvolutionAvailable: true,
      linearTotal,
      decreasingTotal,
      linearIncomeRate: linearTotal / safeIncome,
      decreasingIncomeRate: decreasingTotal / safeIncome,
    };
  };
  const upfrontRows = orderedUpfront.map(withWorkEvolution);
  const recurringRows = [...mergedMonthlyRows, ...annualOnlyRows.map(withWorkEvolution)].sort(
    (left, right) =>
      left.paymentDate.localeCompare(right.paymentDate) || (left.kind === "monthly" ? -1 : 1),
  );
  const rows = [...upfrontRows, ...recurringRows];
  const monthlyWorkEvolution = monthlyRows[0]?.workEvolution ?? null;
  const datesAvailable =
    safeInstallments > 0 &&
    Number(installments) === safeInstallments &&
    monthlyDates.length === safeInstallments &&
    monthlyRows.every((row) => isoMonth(row.paymentDate));
  const linearScheduleAvailable =
    datesAvailable &&
    linearSchedule.length === safeInstallments &&
    monthlyRows.every((row) => row.linearPayment != null);
  const decreasingScheduleAvailable =
    datesAvailable &&
    decreasingPayments.length === safeInstallments &&
    monthlyRows.every((row) => row.decreasingPayment != null);
  const installmentComparisonAvailable =
    safeIncome > 0 && linearScheduleAvailable && decreasingScheduleAvailable;
  const comparisonAvailable = installmentComparisonAvailable && workEvolutionAvailable;
  // A anual reduz somente a base distribuída nas mensais; não reduz o Pró-Soluto.
  // O indicador compara parcela corrigida + evolução de obra, sem somar a anual novamente.
  const recurringIncomeRows = monthlyRows;
  const highestLinearTotal = comparisonAvailable
    ? recurringIncomeRows.reduce((highest, row) => Math.max(highest, row.linearTotal ?? 0), 0)
    : null;
  const highestDecreasingTotal = comparisonAvailable
    ? recurringIncomeRows.reduce((highest, row) => Math.max(highest, row.decreasingTotal ?? 0), 0)
    : null;
  const highestLinearPaymentRow = linearScheduleAvailable
    ? monthlyRows.reduce(
        (highest, row) => (row.linearPayment > (highest?.linearPayment ?? -1) ? row : highest),
        null,
      )
    : null;
  const highestDecreasingPaymentRow = decreasingScheduleAvailable
    ? monthlyRows.reduce(
        (highest, row) =>
          row.decreasingPayment > (highest?.decreasingPayment ?? -1) ? row : highest,
        null,
      )
    : null;
  const highestLinearTotalRow = comparisonAvailable
    ? recurringIncomeRows.reduce(
        (highest, row) => (row.linearTotal > (highest?.linearTotal ?? -1) ? row : highest),
        null,
      )
    : null;
  const highestDecreasingTotalRow = comparisonAvailable
    ? recurringIncomeRows.reduce(
        (highest, row) => (row.decreasingTotal > (highest?.decreasingTotal ?? -1) ? row : highest),
        null,
      )
    : null;

  return {
    normalizedProgress,
    installmentComparisonAvailable,
    workEvolutionAvailable,
    comparisonAvailable,
    workEvolution: monthlyWorkEvolution,
    hasAnnuals: annualRows.length > 0,
    highestLinearTotal,
    highestDecreasingTotal,
    highestLinearPayment: highestLinearPaymentRow?.linearPayment ?? null,
    highestDecreasingPayment: highestDecreasingPaymentRow?.decreasingPayment ?? null,
    highestLinearPaymentRow,
    highestDecreasingPaymentRow,
    highestLinearTotalRow,
    highestDecreasingTotalRow,
    rows,
  };
}
