export const ASSOCIATIVE_LINEAR_PARAMETERS = Object.freeze({
  workflow: "WF-13",
  scope: "Associativo | Fluxo Linear",
  preRate: 0.005,
  postRate: 0.015,
  minimumEntryOrSignal: 150,
  annualRate: 0.005,
  paymentDays: [5, 10, 15],
});

function number(value) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function monthsByCalendar(start, end) {
  return ((end.getUTCFullYear() - start.getUTCFullYear()) * 12) + end.getUTCMonth() - start.getUTCMonth();
}

function fullMonthsBetween(start, end) {
  const calendarMonths = monthsByCalendar(start, end);
  return Math.max(0, calendarMonths - (end.getUTCDate() < start.getUTCDate() ? 1 : 0));
}

function latestOfficialDate(date) {
  const limit = addDays(date, 31);
  const candidates = [];
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    for (const day of ASSOCIATIVE_LINEAR_PARAMETERS.paymentDays) {
      const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, day));
      if (candidate > date && candidate <= limit) candidates.push(candidate);
    }
  }
  return candidates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function firstInstallmentBaseDate(date) {
  const limit = addDays(date, 30);
  const candidates = [];
  for (let monthOffset = 0; monthOffset <= 1; monthOffset += 1) {
    for (const day of ASSOCIATIVE_LINEAR_PARAMETERS.paymentDays) {
      const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, day));
      if (candidate > date && candidate <= limit) candidates.push(candidate);
    }
  }
  return candidates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function pmt(rate, periods, presentValue) {
  if (!periods || periods <= 0) return 0;
  if (rate === 0) return -(presentValue / periods);
  const factor = Math.pow(1 + rate, periods);
  return -((rate * presentValue * factor) / (factor - 1));
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function calculateAssociativeLinear(raw, options = {}) {
  const errors = [];
  const warnings = [];
  const entryDate = parseDate(raw.entryDate);
  const constructionEnd = parseDate(raw.constructionEnd);
  const calculationDate = parseDate(options.today ?? raw.calculationDate ?? todayIso());

  const salePrice = number(raw.salePrice);
  const bonus = number(raw.bonus);
  const discount = number(raw.discount);
  const financing = number(raw.financing);
  const subsidy = number(raw.subsidy);
  const fgts = number(raw.fgts);
  const housingCheck = number(raw.housingCheck);
  const entry = number(raw.entry);
  const signal1 = number(raw.signal1);
  const signal2 = number(raw.signal2);
  const signal3 = number(raw.signal3);
  const installments = Math.trunc(number(raw.installments));
  const policyLimit = Math.trunc(number(raw.policyLimit));

  if (!raw.development?.trim()) errors.push("Informe o nome completo do empreendimento.");
  if (!raw.product?.trim()) errors.push("Informe o produto ou a unidade exata do estoque.");
  if (!raw.stockMatch) errors.push("Confirme o match de empreendimento e produto na fonte oficial.");
  if (!entryDate) errors.push("Informe uma data vigente válida.");
  if (!constructionEnd) errors.push("Informe a data oficial de término da obra.");
  if (entryDate && constructionEnd && constructionEnd <= entryDate) errors.push("A data de término da obra deve ser posterior à data vigente.");
  if (salePrice <= 0) errors.push("Informe um valor de imóvel maior que zero.");
  if (bonus + discount > salePrice) errors.push("Bônus e desconto não podem superar o valor do imóvel.");
  if (entry < ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal) errors.push("A entrada deve ser de pelo menos R$ 150,00.");
  if (!raw.policyConfirmed) errors.push("Confirme a consulta à política comercial do empreendimento.");
  if (policyLimit <= 0) errors.push("Informe o limite de parcelas aprovado na política comercial.");
  if (installments <= 0) errors.push("Informe a quantidade de parcelas mensais.");
  if (policyLimit > 0 && installments > policyLimit) errors.push(`A quantidade solicitada supera o limite comercial de ${policyLimit} parcelas.`);

  const signal1Valid = signal1 === 0 || signal1 >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal;
  const signal2Valid = signal2 === 0 || (signal1 >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal && signal2 >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal && signal2 <= signal1);
  const signal3Valid = signal3 === 0 || (signal2 >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal && signal3 >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal && signal3 <= signal2);
  if (!signal1Valid) errors.push("Sinal 1 deve ser zero ou ter valor mínimo de R$ 150,00.");
  if (!signal2Valid) errors.push("Sinal 2 exige Sinal 1 válido, mínimo de R$ 150,00 e valor menor ou igual ao Sinal 1.");
  if (!signal3Valid) errors.push("Sinal 3 exige Sinal 2 válido, mínimo de R$ 150,00 e valor menor ou igual ao Sinal 2.");

  const baseSignalDate = entryDate ? latestOfficialDate(entryDate) : null;
  const signal1Date = signal1 >= 150 && signal1Valid ? baseSignalDate : null;
  const signal2Date = signal2 >= 150 && signal2Valid && signal1Date ? latestOfficialDate(signal1Date) : null;
  const signal3Date = signal3 >= 150 && signal3Valid && signal2Date ? latestOfficialDate(signal2Date) : null;
  const graceMonths = signal3Date ? 3 : signal2Date ? 2 : signal1Date ? 1 : 0;
  const installmentBaseDate = calculationDate ? firstInstallmentBaseDate(calculationDate) : null;
  const firstInstallmentDate = entry >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal && installmentBaseDate
    ? addMonths(installmentBaseDate, graceMonths)
    : null;
  if (entryDate && !baseSignalDate) errors.push("Não foi possível localizar uma data válida nos dias 5, 10 ou 15.");
  if (entry >= ASSOCIATIVE_LINEAR_PARAMETERS.minimumEntryOrSignal && !firstInstallmentDate) errors.push("Não foi possível definir a data de início das mensais.");

  const validInitialTotal = entry
    + (signal1 >= 150 && signal1Valid ? signal1 : 0)
    + (signal2 >= 150 && signal2Valid ? signal2 : 0)
    + (signal3 >= 150 && signal3Valid ? signal3 : 0);
  const annualInputs = [raw.annual1, raw.annual2, raw.annual3, raw.annual4, raw.annual5].map(number);
  const annualSchedule = annualInputs.map((amount, index) => {
    const dueDate = calculationDate ? new Date(Date.UTC(calculationDate.getUTCFullYear() + index, 11, 15)) : null;
    let valid = amount <= 0;
    let reason = amount <= 0 ? "Não informado" : "";
    if (amount > 0) {
      if (!dueDate || !constructionEnd || dueDate > constructionEnd) reason = "A anual ultrapassa o término da obra.";
      else if (!calculationDate || dueDate < calculationDate) reason = "A data da anual já passou.";
      else { valid = true; reason = "Válida"; }
    }
    const months = valid && amount > 0 && calculationDate && dueDate ? fullMonthsBetween(calculationDate, dueDate) : 0;
    const corrected = valid && amount > 0 ? amount * (1 + ASSOCIATIVE_LINEAR_PARAMETERS.annualRate) * Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.annualRate, months) : 0;
    if (amount > 0 && !valid) errors.push(`Anual ${index + 1}: ${reason}`);
    return { index: index + 1, amount, dueDate: iso(dueDate), months, corrected, valid, reason };
  });
  const annualCorrectedTotal = annualSchedule.reduce((total, annual) => total + annual.corrected, 0);

  const realSaleValue = salePrice - bonus - discount;
  // A anual redistribui o pagamento das mensais, mas não reduz o Pró-Soluto.
  const deductions = financing + subsidy + fgts + housingCheck + validInitialTotal;
  const proSoluto = Math.max(0, realSaleValue - deductions);
  const installmentBalance = Math.max(0, proSoluto - annualCorrectedTotal);
  if (installments > 0 && proSoluto > 0 && annualCorrectedTotal >= proSoluto) {
    errors.push("O total corrigido das anuais deve ser menor que o Pró-Soluto para preservar ao menos uma parcela mensal.");
  }

  let preInstallments = 0;
  if (firstInstallmentDate && constructionEnd && installments > 0) {
    preInstallments = Math.max(0, Math.min(installments, monthsByCalendar(firstInstallmentDate, constructionEnd)));
  }
  const postInstallments = Math.max(0, installments - preInstallments);
  const baseRate = installments > 0 && preInstallments >= 1
    ? ASSOCIATIVE_LINEAR_PARAMETERS.preRate
    : installments > 0 && postInstallments >= 1
      ? ASSOCIATIVE_LINEAR_PARAMETERS.postRate
      : 0;
  const proSolutoWithInitialCorrection = proSoluto * (1 + baseRate);
  const correctedProSoluto = proSolutoWithInitialCorrection * Math.pow(1 + baseRate, graceMonths);
  const installmentBalanceWithInitialCorrection = installmentBalance * (1 + baseRate);
  const correctedInstallmentBalance = installmentBalanceWithInitialCorrection * Math.pow(1 + baseRate, graceMonths);

  const preVariable = preInstallments === 0 ? 0 : ((Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.preRate, preInstallments) * ASSOCIATIVE_LINEAR_PARAMETERS.preRate) / (Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.preRate, preInstallments) - 1));
  const postVariable = postInstallments === 0 ? 0 : (Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.preRate, preInstallments) * ((Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.postRate, postInstallments) * ASSOCIATIVE_LINEAR_PARAMETERS.postRate) / (Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.postRate, postInstallments) - 1)));
  const prePercentage = preInstallments === 0 ? 0 : postInstallments === 0 ? 1 : 1 - (preVariable / (preVariable + postVariable));
  const postPercentage = postInstallments === 0 ? 0 : preInstallments === 0 ? 1 : 1 - prePercentage;
  const prePeriodTotal = prePercentage * correctedInstallmentBalance;
  const postPeriodTotal = correctedInstallmentBalance - prePeriodTotal;
  const adjustedPre = prePeriodTotal;
  const adjustedPost = postPeriodTotal * Math.pow(1 + ASSOCIATIVE_LINEAR_PARAMETERS.preRate, preInstallments);
  const prePayment = preInstallments > 0 ? -pmt(ASSOCIATIVE_LINEAR_PARAMETERS.preRate, preInstallments, adjustedPre) : 0;
  const postPayment = postInstallments > 0 ? -pmt(ASSOCIATIVE_LINEAR_PARAMETERS.postRate, postInstallments, adjustedPost) : 0;
  const correctedInstallment = Math.max(prePayment, postPayment, 0);
  const correctedWithAnnuals = correctedInstallmentBalance + annualCorrectedTotal;

  if (proSoluto === 0) warnings.push("O pró-soluto ficou zerado após as deduções informadas.");
  if (preInstallments + postInstallments !== installments) errors.push("A divisão entre parcelas pré e pós não fecha a quantidade total.");
  if (Math.abs((prePercentage + postPercentage) - (installments > 0 ? 1 : 0)) > 0.000001) errors.push("Os percentuais pré e pós não fecham 100%.");

  const audit = [
    { label: "Executor WF-13 e escopo Associativo | Fluxo Linear", ok: true },
    { label: "Empreendimento e produto com match oficial", ok: Boolean(raw.development?.trim() && raw.product?.trim() && raw.stockMatch) },
    { label: "Política comercial conferida", ok: Boolean(raw.policyConfirmed && policyLimit > 0 && installments <= policyLimit) },
    { label: "Entrada e sinais respeitam a sequência mínima", ok: entry >= 150 && signal1Valid && signal2Valid && signal3Valid },
    { label: "D59 + D60 fecha D61", ok: preInstallments + postInstallments === installments },
    { label: "F59 + F60 fecha 100%", ok: Math.abs((prePercentage + postPercentage) - (installments > 0 ? 1 : 0)) <= 0.000001 },
    { label: "Períodos pré e pós fecham a base mensal corrigida", ok: Math.abs((prePeriodTotal + postPeriodTotal) - correctedInstallmentBalance) <= 0.01 },
    { label: "Parcela final acompanha data 5/10/15", ok: Boolean(firstInstallmentDate && ASSOCIATIVE_LINEAR_PARAMETERS.paymentDays.includes(firstInstallmentDate.getUTCDate())) },
  ];

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    workflow: ASSOCIATIVE_LINEAR_PARAMETERS.workflow,
    scope: ASSOCIATIVE_LINEAR_PARAMETERS.scope,
    calculationDate: iso(calculationDate),
    baseSignalDate: iso(baseSignalDate),
    signalDates: [iso(signal1Date), iso(signal2Date), iso(signal3Date)],
    firstInstallmentDate: iso(firstInstallmentDate),
    graceMonths,
    validInitialTotal,
    annualSchedule,
    annualCorrectedTotal,
    realSaleValue,
    deductions,
    proSoluto,
    installmentBalance,
    baseRate,
    proSolutoWithInitialCorrection,
    correctedProSoluto,
    installmentBalanceWithInitialCorrection,
    correctedInstallmentBalance,
    correctedWithAnnuals,
    installments,
    policyLimit,
    preInstallments,
    postInstallments,
    preVariable,
    postVariable,
    prePercentage,
    postPercentage,
    prePeriodTotal,
    postPeriodTotal,
    adjustedPre,
    adjustedPost,
    prePayment,
    postPayment,
    correctedInstallment,
    installmentOverSale: realSaleValue > 0 ? correctedInstallment / realSaleValue : 0,
    proSolutoOverSale: realSaleValue > 0 ? proSoluto / realSaleValue : 0,
    audit,
  };
}
