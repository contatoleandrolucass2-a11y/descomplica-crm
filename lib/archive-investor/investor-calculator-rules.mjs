import { calculateAssociativeLinear } from "./associative-linear-calculator-rules.mjs";
import { calculateAssociativeDecreasing } from "./associative-decreasing-calculator-rules.mjs";
import { ASSOCIATIVE_APPROVAL_TIERS } from "./associative-approval-rules.mjs";

const INTERMEDIARY_OFFSETS = [180, 360, 540, 720];
const ANNUAL_PAYMENT_COUNT = 5;
const ANNUAL_CORRECTION_RATE = 0.005;
export const MINIMUM_SIGNAL_VALUE = 150;

function dateFromIso(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoDate(value) {
  return value?.toISOString().slice(0, 10) ?? "";
}

function addDays(value, amount) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function addMonthsClamped(value, amount) {
  const monthIndex = value.getUTCFullYear() * 12 + value.getUTCMonth() + amount;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(value.getUTCDate(), lastDay), 12));
}

export function adjustCommercialDate(value) {
  const result = new Date(value);
  const day = result.getUTCDate();
  if (day >= 15) result.setUTCDate(15);
  else if (day >= 10) result.setUTCDate(10);
  else if (day >= 5) result.setUTCDate(5);
  else {
    result.setUTCDate(15);
    result.setUTCMonth(result.getUTCMonth() - 1);
  }
  return result;
}

function fullMonthsUntil(start, end) {
  const raw =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  return Math.max(0, raw - (end.getUTCDate() < start.getUTCDate() ? 1 : 0));
}

function moneyValue(value) {
  const clean = typeof value === "string" ? value.trim().replace(/[^\d,.-]/g, "") : value;
  const normalized =
    typeof clean === "string" && clean.includes(",")
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function annualPaymentDate(baseDate, index) {
  return new Date(Date.UTC(baseDate.getUTCFullYear() + index, 11, 15, 12));
}

function correctedAnnualValue(value, baseDate, paymentDate) {
  const correctionMonths = fullMonthsUntil(baseDate, paymentDate);
  return value * Math.pow(1 + ANNUAL_CORRECTION_RATE, correctionMonths + 1);
}

function moneyInCents(value) {
  return Math.round(moneyValue(value) * 100);
}

function moneyFromCents(value) {
  return value / 100;
}

export function distributeSignalBalance(valueRealInput, entryValueInput) {
  const valueReal = moneyValue(valueRealInput);
  const entryValue = moneyValue(entryValueInput);
  const entryRate = valueReal > 0 ? entryValue / valueReal : 0;
  if (entryRate < 0.06 || entryRate >= 0.1) return [0, 0, 0];

  const missingInCents = Math.max(0, Math.ceil((valueReal * 0.1 - entryValue) * 100 - 1e-7));
  const minimumInCents = MINIMUM_SIGNAL_VALUE * 100;
  const signalCount =
    missingInCents >= minimumInCents * 3 ? 3 : missingInCents >= minimumInCents * 2 ? 2 : 1;
  const distributedInCents = Math.max(missingInCents, minimumInCents * signalCount);
  const baseInCents = Math.floor(distributedInCents / signalCount);
  const remainder = distributedInCents % signalCount;

  return Array.from({ length: 3 }, (_, index) =>
    index < signalCount ? (baseInCents + (index < remainder ? 1 : 0)) / 100 : 0,
  );
}

function distributeScenarioSignals(valueReal, entryRate, targetEntryRate, signalCount) {
  if (signalCount <= 0 || targetEntryRate <= entryRate) return [];
  const missingInCents = Math.max(0, Math.round(valueReal * (targetEntryRate - entryRate) * 100));
  const baseInCents = Math.floor(missingInCents / signalCount);
  const remainder = missingInCents % signalCount;
  return Array.from(
    { length: signalCount },
    (_, index) => (baseInCents + (index < remainder ? 1 : 0)) / 100,
  );
}

function buildCustomMonthlyDates(signalBaseDate, count, graceMonths) {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    isoDate(addMonthsClamped(signalBaseDate, graceMonths + index)),
  );
}

function standardScenario({
  code,
  entryRate,
  targetEntryRate = entryRate,
  installmentLimit,
  signalLimit = 0,
  intermediaryLimit,
  valueReal,
  baseDate,
  completionDate,
  deadline,
  annualMode = false,
  income = 0,
}) {
  const signalBaseDate = adjustCommercialDate(addDays(baseDate, 30));
  const signalValues =
    signalLimit > 0
      ? distributeScenarioSignals(valueReal, entryRate, targetEntryRate, signalLimit)
      : [];
  const signals = signalValues.map((value, index) => ({
    index: index + 1,
    value,
    date: isoDate(addMonthsClamped(signalBaseDate, index)),
  }));
  const signalTotal = signals.reduce((total, item) => total + item.value, 0);
  const standardMonthlyDates = buildCustomMonthlyDates(
    signalBaseDate,
    installmentLimit,
    signalLimit,
  ).filter((date) => dateFromIso(date) <= completionDate);
  const installments = standardMonthlyDates.length;
  const monthlyDates = new Set(standardMonthlyDates);
  const intermediaryDates = annualMode
    ? Array.from({ length: intermediaryLimit }, (_, index) =>
        annualPaymentDate(baseDate, index),
      ).filter((candidate) => candidate >= baseDate && candidate <= completionDate)
    : INTERMEDIARY_OFFSETS.slice(0, intermediaryLimit)
        .map((_, index) => addMonthsClamped(signalBaseDate, (index + 1) * 6 - 1))
        .filter((candidate) => candidate <= deadline && monthlyDates.has(isoDate(candidate)));
  const intermediaryCount = installments > 0 ? intermediaryDates.length : 0;
  const valueRealInCents = moneyInCents(valueReal);
  const entryInCents = installments > 0 ? Math.round(valueRealInCents * entryRate) : 0;
  const intermediaryUnit = annualMode ? Math.min(valueReal * 0.05, income * 0.5) : valueReal * 0.05;
  const intermediaryUnitInCents = installments > 0 ? moneyInCents(intermediaryUnit) : 0;
  const intermediaryValues = annualMode
    ? intermediaryDates.map((date) => correctedAnnualValue(intermediaryUnit, baseDate, date))
    : intermediaryDates.map(() => moneyFromCents(intermediaryUnitInCents));
  const intermediaryTotalInCents = moneyInCents(
    intermediaryValues.reduce((total, value) => total + value, 0),
  );
  const signalTotalInCents = moneyInCents(signalTotal);
  const balanceInCents = Math.max(
    0,
    valueRealInCents - entryInCents - signalTotalInCents - intermediaryTotalInCents,
  );
  const entry = moneyFromCents(entryInCents);
  const intermediaryTotal = moneyFromCents(intermediaryTotalInCents);
  const balance = moneyFromCents(balanceInCents);
  const installmentBaseInCents = installments > 0 ? Math.round(balanceInCents / installments) : 0;
  const lastInstallmentInCents =
    installments > 0 ? balanceInCents - installmentBaseInCents * (installments - 1) : 0;
  const installmentValues = Array.from({ length: installments }, (_, index) =>
    moneyFromCents(index === installments - 1 ? lastInstallmentInCents : installmentBaseInCents),
  );
  return {
    code,
    entryRate,
    targetEntryRate,
    installmentLimit,
    signalLimit,
    intermediaryLimit,
    installments,
    intermediaryCount,
    intermediaryDates: intermediaryDates.map(isoDate),
    entry,
    signals,
    signalTotal,
    intermediaryTotal,
    intermediaryUnit,
    intermediaryValues,
    balance,
    installmentValue: installmentValues[0] ?? 0,
    lastInstallmentValue: installmentValues.at(-1) ?? 0,
    installmentValues,
    firstInstallmentDate: standardMonthlyDates[0] ?? "",
    monthlyDates: standardMonthlyDates,
    available: valueReal > 0 && installments === installmentLimit,
  };
}

function standardAssociativeScenario({
  code,
  signalLimit = 0,
  annualLimit = 0,
  valueReal,
  baseDate,
  completionDate,
  financing = 0,
  subsidy = 0,
  fgts = 0,
  housingCheck = 0,
  income = 0,
  installments = 84,
  tierId = "",
}) {
  const tier =
    ASSOCIATIVE_APPROVAL_TIERS.find((item) => item.id === tierId) ?? ASSOCIATIVE_APPROVAL_TIERS[0];
  const safeInstallments = Math.max(1, Math.trunc(moneyValue(installments)) || 84);
  const resources =
    moneyValue(financing) + moneyValue(subsidy) + moneyValue(fgts) + moneyValue(housingCheck);
  const safeIncome = moneyValue(income);
  const monthlyCapacityRate = Math.max(
    0,
    Math.min(tier.commitmentRate, tier.annualIncomeLimitRate - 0.3),
  );
  const tierBalanceLimit = valueReal * tier.proSolutoRate;
  // Mantém folga para os juros pré/pós-obra e para o maior bloco decrescente.
  const incomeBalanceLimit =
    safeIncome > 0 ? safeIncome * monthlyCapacityRate * safeInstallments * 0.4 : 0;
  const proSolutoReductionTarget = Math.max(
    MINIMUM_SIGNAL_VALUE,
    valueReal - resources - tierBalanceLimit,
  );
  const incomeReductionTarget = Math.max(
    MINIMUM_SIGNAL_VALUE,
    valueReal - resources - incomeBalanceLimit,
  );
  const annualMaximum = Math.max(0, moneyValue(income) * 0.5);
  let annualReductionRemaining =
    annualLimit > 0 ? Math.max(0, incomeReductionTarget - proSolutoReductionTarget) : 0;
  const annualInputs = Array.from({ length: ANNUAL_PAYMENT_COUNT }, (_, index) => {
    const dueDate = annualPaymentDate(baseDate, index);
    if (
      index >= annualLimit ||
      dueDate > completionDate ||
      annualMaximum <= 0 ||
      annualReductionRemaining <= 0
    )
      return 0;
    const maximumCorrected = correctedAnnualValue(annualMaximum, baseDate, dueDate);
    const desiredCorrected = Math.min(maximumCorrected, annualReductionRemaining);
    const correctionFactor = correctedAnnualValue(1, baseDate, dueDate);
    const value = moneyFromCents(Math.floor((desiredCorrected / correctionFactor) * 100));
    annualReductionRemaining = Math.max(
      0,
      annualReductionRemaining - correctedAnnualValue(value, baseDate, dueDate),
    );
    return value;
  });
  const allocatedAnnualTotal = annualInputs.reduce(
    (total, value, index) =>
      total + correctedAnnualValue(value, baseDate, annualPaymentDate(baseDate, index)),
    0,
  );
  const reductionRemaining = Math.max(
    proSolutoReductionTarget,
    incomeReductionTarget - allocatedAnnualTotal,
  );
  const paymentCount = signalLimit > 0 ? signalLimit + 1 : 1;
  const equalPaymentInCents = Math.max(
    MINIMUM_SIGNAL_VALUE * 100,
    Math.ceil((reductionRemaining * 100) / paymentCount),
  );
  const entry = moneyFromCents(equalPaymentInCents);
  const signalValues = Array.from({ length: signalLimit }, () => entry);
  const entryRate = valueReal > 0 ? entry / valueReal : 0;
  const calculate = (scenarioFinancing) =>
    calculateAssociativeLinear(
      {
        development: "Estoque selecionado",
        product: code,
        stockMatch: true,
        policyConfirmed: true,
        policyLimit: safeInstallments,
        installments: safeInstallments,
        entryDate: isoDate(baseDate),
        constructionEnd: isoDate(completionDate),
        calculationDate: isoDate(baseDate),
        salePrice: valueReal,
        bonus: 0,
        discount: 0,
        financing: scenarioFinancing,
        subsidy,
        fgts,
        housingCheck,
        entry,
        signal1: signalValues[0] ?? 0,
        signal2: signalValues[1] ?? 0,
        signal3: signalValues[2] ?? 0,
        annual1: annualInputs[0],
        annual2: annualInputs[1],
        annual3: annualInputs[2],
        annual4: annualInputs[3],
        annual5: annualInputs[4],
      },
      { today: isoDate(baseDate) },
    );
  let scenarioFinancing = moneyValue(financing);
  let linear = calculate(scenarioFinancing);
  const excess = Math.max(
    0,
    scenarioFinancing +
      moneyValue(subsidy) +
      moneyValue(fgts) +
      moneyValue(housingCheck) +
      entry +
      signalValues.reduce((total, value) => total + value, 0) -
      valueReal,
  );
  if (excess > 0 && scenarioFinancing > 0) {
    scenarioFinancing = Math.max(0, scenarioFinancing - excess);
    linear = calculate(scenarioFinancing);
  }
  const signals = signalValues.map((value, index) => ({
    index: index + 1,
    value,
    date: linear.signalDates[index] ?? "",
  }));
  const annualSchedule = linear.annualSchedule.filter(
    (annual) => annual.amount > 0 && annual.valid,
  );
  const firstInstallmentDate = dateFromIso(linear.firstInstallmentDate);
  const monthlyDates = firstInstallmentDate
    ? Array.from({ length: safeInstallments }, (_, index) =>
        isoDate(addMonthsClamped(firstInstallmentDate, index)),
      )
    : [];
  const decreasing = calculateAssociativeDecreasing({
    uncorrectedBalance: linear.installmentBalance,
    correctedBalance: linear.correctedInstallmentBalance,
    installments: safeInstallments,
    preInstallments: linear.preInstallments,
    postInstallments: linear.postInstallments,
    firstInstallmentDate: linear.firstInstallmentDate,
  });
  const highestLinearPayment = Math.max(linear.prePayment, linear.postPayment);
  const highestDecreasingPayment = decreasing.blocks.reduce(
    (highest, block) => Math.max(highest, block.correctedInstallment),
    0,
  );
  const highestPayment = Math.max(highestLinearPayment, highestDecreasingPayment);
  const proSolutoRate = valueReal > 0 ? linear.proSoluto / valueReal : Number.POSITIVE_INFINITY;
  const commitmentRate = safeIncome > 0 ? highestPayment / safeIncome : Number.POSITIVE_INFINITY;
  const maximumIncomeRate =
    safeIncome > 0 ? (highestPayment + safeIncome * 0.3) / safeIncome : Number.POSITIVE_INFINITY;
  const tierChecks = [
    { label: "% Pró-Soluto", ok: proSolutoRate <= tier.proSolutoRate + 1e-9 },
    { label: "% Comprometimento da Renda", ok: commitmentRate <= tier.commitmentRate + 1e-9 },
    {
      label: "% Máximo da renda por anual",
      ok: maximumIncomeRate <= tier.annualIncomeLimitRate + 1e-9,
    },
  ];
  const firstFailedTierCheck = tierChecks.find((check) => !check.ok);
  const available =
    valueReal > 0 &&
    tier.id !== "not-eligible" &&
    linear.ok &&
    decreasing.ok &&
    !firstFailedTierCheck;

  return {
    code,
    entryRate,
    targetEntryRate: entryRate,
    installmentLimit: safeInstallments,
    signalLimit,
    intermediaryLimit: annualLimit,
    installments: safeInstallments,
    preInstallments: linear.preInstallments,
    postInstallments: linear.postInstallments,
    intermediaryCount: annualSchedule.length,
    intermediaryDates: annualSchedule.map((annual) => annual.dueDate),
    entry,
    signals,
    signalTotal: signalValues.reduce((total, value) => total + value, 0),
    intermediaryTotal: linear.annualCorrectedTotal,
    intermediaryUnit: annualInputs.find((value) => value > 0) ?? 0,
    intermediaryValues: annualSchedule.map((annual) => annual.corrected),
    balance: linear.correctedInstallmentBalance,
    installmentValue: linear.correctedInstallment,
    lastInstallmentValue: linear.correctedInstallment,
    installmentValues: Array.from({ length: safeInstallments }, () => linear.correctedInstallment),
    firstInstallmentDate: linear.firstInstallmentDate,
    monthlyDates,
    available,
    availabilityReason: available
      ? ""
      : tier.id === "not-eligible"
        ? "Classificação Não Elegível não possui limite disponível"
        : (linear.errors[0] ??
          decreasing.errors[0] ??
          firstFailedTierCheck?.label ??
          "Cenário fora da regra"),
    approval: {
      tierId: tier.id,
      proSolutoRate,
      commitmentRate,
      maximumIncomeRate,
      checks: tierChecks,
    },
    financing: scenarioFinancing,
    subsidy: moneyValue(subsidy),
    fgts: moneyValue(fgts),
    housingCheck: moneyValue(housingCheck),
    linear,
    decreasing,
  };
}

export function calculateInvestorFlow(input) {
  const baseDate = dateFromIso(input.baseDate);
  const completionDate = dateFromIso(input.completionDate);
  const salePrice = moneyValue(input.salePrice);
  const annualMode = Boolean(input.annualMode);
  const propertyValue = annualMode ? moneyValue(input.propertyValue || input.salePrice) : salePrice;
  const unitBonus = annualMode ? moneyValue(input.unitBonus) : 0;
  const tableSlack = annualMode ? moneyValue(input.tableSlack) : 0;
  const discount = input.discountAuthorized ? moneyValue(input.discount) : 0;
  const valueReal = Math.max(0, propertyValue - unitBonus - tableSlack - discount);
  const financing = annualMode ? moneyValue(input.financing) : 0;
  const subsidy = annualMode ? moneyValue(input.subsidy) : 0;
  const fgts = annualMode ? moneyValue(input.fgts) : 0;
  const housingCheck = annualMode ? moneyValue(input.housingCheck) : 0;
  const resourceTotal = financing + subsidy + fgts + housingCheck;
  const balanceAfterResources = Math.max(0, valueReal - resourceTotal);
  const actValue = moneyValue(input.entryValue);
  const actRate = valueReal > 0 ? actValue / valueReal : 0;
  const rawInstallments = moneyValue(input.installments);
  const installmentsInteger = Number.isInteger(rawInstallments);
  const desiredInstallments = Math.trunc(rawInstallments);
  const income = moneyValue(input.income);
  const signalValues = Array.from({ length: 3 }, (_, index) => moneyValue(input.signals?.[index]));
  const intermediaryValues = Array.from(
    { length: annualMode ? ANNUAL_PAYMENT_COUNT : INTERMEDIARY_OFFSETS.length },
    (_, index) => moneyValue(input.intermediaries?.[index]),
  );
  const signalBaseDate = baseDate ? adjustCommercialDate(addDays(baseDate, 30)) : null;
  const signals = signalValues.map((value, index) => {
    const previousValue = index > 0 ? signalValues[index - 1] : 0;
    let reason = "Dentro da regra";
    if (value <= 0) reason = "Não usado";
    else if (value < MINIMUM_SIGNAL_VALUE)
      reason = `Valor mínimo: R$ ${MINIMUM_SIGNAL_VALUE.toFixed(2).replace(".", ",")}`;
    else if (index > 0 && previousValue <= 0) reason = `Preencha o Sinal ${index} primeiro`;
    else if (index > 0 && value > previousValue)
      reason = `Sinal ${index + 1} não pode ser maior que o Sinal ${index}`;
    const approved = value <= 0 || reason === "Dentro da regra";
    return {
      index: index + 1,
      value,
      date: signalBaseDate ? isoDate(addMonthsClamped(signalBaseDate, index)) : "",
      rate: valueReal > 0 ? value / valueReal : 0,
      active: value > 0,
      approved,
      status: value <= 0 ? "Disponível" : approved ? "Dentro da regra" : "Ajuste necessário",
      reason,
    };
  });
  const invalidSignals = signals.filter((item) => item.active && !item.approved);
  const approvedSignals = signals.filter((item) => item.active && item.approved);
  const activeSignals = approvedSignals.length;
  const signalGraceMonths = approvedSignals.reduce(
    (latest, item) => Math.max(latest, item.index),
    0,
  );
  const signalTotal = approvedSignals.reduce((total, item) => total + item.value, 0);
  const totalEntryValue = actValue + signalTotal;
  const totalEntryRate = valueReal > 0 ? totalEntryValue / valueReal : 0;
  const entryLimit = annualMode ? 84 : totalEntryRate < 0.1 ? 0 : totalEntryRate < 0.2 ? 18 : 24;
  const intermediaryInputLimit = annualMode
    ? baseDate && completionDate
      ? Array.from({ length: ANNUAL_PAYMENT_COUNT }, (_, index) =>
          annualPaymentDate(baseDate, index),
        ).filter((date) => date >= baseDate && date <= completionDate).length
      : 0
    : desiredInstallments === 24
      ? 4
      : 3;
  const maxIntermediaries = annualMode
    ? intermediaryInputLimit
    : totalEntryRate < 0.1
      ? 0
      : intermediaryInputLimit;
  const monthsUntil = baseDate && completionDate ? fullMonthsUntil(baseDate, completionDate) : 0;
  const deadline = completionDate
    ? annualMode
      ? completionDate
      : addMonthsClamped(completionDate, -3)
    : null;
  const availableMonthlyDates =
    signalBaseDate && completionDate
      ? buildCustomMonthlyDates(signalBaseDate, entryLimit, signalGraceMonths).filter(
          (date) => annualMode || dateFromIso(date) <= completionDate,
        )
      : [];
  const maxInstallments = availableMonthlyDates.length;
  const monthlyDates = signalBaseDate
    ? buildCustomMonthlyDates(signalBaseDate, desiredInstallments, signalGraceMonths)
    : [];
  const monthlyDateSet = new Set(monthlyDates);

  const intermediaries = intermediaryValues.map((value, index) => {
    const intermediaryDate =
      annualMode && baseDate
        ? annualPaymentDate(baseDate, index)
        : signalBaseDate
          ? addMonthsClamped(signalBaseDate, (index + 1) * 6 - 1)
          : baseDate
            ? adjustCommercialDate(addDays(baseDate, INTERMEDIARY_OFFSETS[index]))
            : null;
    if (!baseDate || value <= 0) {
      return {
        index: index + 1,
        value,
        correctedValue: 0,
        date: isoDate(intermediaryDate),
        rate: 0,
        approved: true,
        status: "Neutro",
        reason: annualMode ? "Não usada" : "Não usada",
      };
    }
    // Six-month cadence, anchored to the same 05/10/15 calendar as the monthly plan.
    const rate = valueReal > 0 ? value / valueReal : 0;
    let reason = "Dentro da regra";
    if (annualMode) {
      if (!intermediaryDate || intermediaryDate < baseDate)
        reason = "Vencimento anterior à data vigente";
      else if (!completionDate || intermediaryDate > completionDate)
        reason = "Anual após o término da obra";
    } else if (totalEntryRate < 0.1) reason = "Entrada total menor que 10%";
    else if (index + 1 > maxIntermediaries) reason = "Excede o limite do fluxo";
    else if (rate > 0.05) reason = "Intermediária acima de 5%";
    else if (!deadline || intermediaryDate > deadline) reason = "Fora do prazo da obra";
    else if (!monthlyDateSet.has(isoDate(intermediaryDate))) reason = "Sem mensal na mesma data";
    const approved = reason === "Dentro da regra";
    const correctedValue =
      approved && annualMode && intermediaryDate
        ? correctedAnnualValue(value, baseDate, intermediaryDate)
        : approved
          ? value
          : 0;
    return {
      index: index + 1,
      value,
      correctedValue,
      date: isoDate(intermediaryDate),
      rate,
      approved,
      status: approved ? "Aprovado" : "Reprovado",
      reason,
    };
  });
  const activeIntermediaries = intermediaries.filter((item) => item.value > 0).length;
  const invalidIntermediaries = intermediaries.filter((item) => item.value > 0 && !item.approved);
  const validIntermediaryTotal = intermediaries
    .filter((item) => item.value > 0 && item.approved)
    .reduce((total, item) => total + item.correctedValue, 0);
  const balanceBeforeCorrection = Math.max(
    0,
    balanceAfterResources - totalEntryValue - (annualMode ? 0 : validIntermediaryTotal),
  );
  const customLinear =
    annualMode && baseDate && completionDate
      ? calculateAssociativeLinear(
          {
            development: "Estoque selecionado",
            product: input.selectedUnitId || "Unidade selecionada",
            stockMatch: Boolean(input.selectedUnitId),
            policyConfirmed: true,
            policyLimit: 84,
            installments: desiredInstallments,
            entryDate: isoDate(baseDate),
            constructionEnd: isoDate(completionDate),
            calculationDate: isoDate(baseDate),
            salePrice: propertyValue,
            bonus: unitBonus + tableSlack,
            discount,
            financing,
            subsidy,
            fgts,
            housingCheck,
            entry: actValue,
            signal1: signalValues[0],
            signal2: signalValues[1],
            signal3: signalValues[2],
            annual1: intermediaryValues[0],
            annual2: intermediaryValues[1],
            annual3: intermediaryValues[2],
            annual4: intermediaryValues[3],
            annual5: intermediaryValues[4],
          },
          { today: isoDate(baseDate) },
        )
      : null;
  const installmentBalanceBeforeCorrection = customLinear
    ? customLinear.installmentBalance
    : annualMode
      ? Math.max(0, balanceBeforeCorrection - validIntermediaryTotal)
      : balanceBeforeCorrection;
  const balance = customLinear ? customLinear.correctedInstallmentBalance : balanceBeforeCorrection;
  const installmentValue = customLinear
    ? customLinear.correctedInstallment
    : desiredInstallments > 0 && balance > 0
      ? balance / desiredInstallments
      : 0;
  const customDecreasing = customLinear
    ? calculateAssociativeDecreasing({
        uncorrectedBalance: customLinear.installmentBalance,
        correctedBalance: customLinear.correctedInstallmentBalance,
        installments: desiredInstallments,
        preInstallments: customLinear.preInstallments,
        postInstallments: customLinear.postInstallments,
        firstInstallmentDate: customLinear.firstInstallmentDate,
      })
    : null;
  const customFirstInstallmentDate = dateFromIso(customLinear?.firstInstallmentDate);
  const customMonthlyDates = customFirstInstallmentDate
    ? Array.from({ length: desiredInstallments }, (_, index) =>
        isoDate(addMonthsClamped(customFirstInstallmentDate, index)),
      )
    : monthlyDates;

  const audit = [
    {
      id: "context",
      label: "Unidade, valor e data da obra válidos",
      ok: Boolean(input.selectedUnitId && propertyValue > 0 && completionDate && baseDate),
    },
    {
      id: "act",
      label: annualMode ? "Entrada mínima de R$ 150,00" : "Entrada mínima de 6%",
      ok: annualMode ? actValue >= MINIMUM_SIGNAL_VALUE : actRate >= 0.06,
    },
    {
      id: "entry",
      label: annualMode ? "Entrada total conforme WF-13" : "Entrada total mínima de 10%",
      ok: annualMode || totalEntryRate >= 0.1,
    },
    {
      id: "signals",
      label: invalidSignals[0]?.reason ?? "Sinais respeitam valor mínimo e ordem decrescente",
      ok: invalidSignals.length === 0,
    },
    {
      id: "construction",
      label: "Data da obra futura",
      ok: Boolean(baseDate && completionDate && completionDate > baseDate),
    },
    {
      id: "installments",
      label: installmentsInteger
        ? `Parcelas dentro do limite (${maxInstallments || 0})`
        : "Quantidade de parcelas deve ser inteira",
      ok: installmentsInteger && desiredInstallments > 0 && desiredInstallments <= maxInstallments,
    },
    {
      id: "intermediary-count",
      label: annualMode ? "Até 5 anuais" : `Até ${maxIntermediaries} intermediárias`,
      ok: activeIntermediaries <= maxIntermediaries,
    },
    {
      id: "intermediaries",
      label: annualMode
        ? "Anuais respeitam vencimento e término da obra"
        : "Intermediárias respeitam 5%, prazo e mensal",
      ok: invalidIntermediaries.length === 0,
    },
    {
      id: "associative-linear",
      label: customLinear?.errors[0] ?? "Motor WF-13 aplicado ao fluxo editável",
      ok: !annualMode || Boolean(customLinear?.ok),
    },
    { id: "balance", label: "Saldo parcelado positivo", ok: balance > 0 },
    { id: "installment-value", label: "Parcela calculada positiva", ok: installmentValue > 0 },
  ];
  const errors = audit.filter((item) => !item.ok).map((item) => item.label);
  const ok = errors.length === 0;

  const standardScenarios =
    baseDate && completionDate
      ? annualMode
        ? [
            standardAssociativeScenario({
              code: "C1",
              valueReal,
              baseDate,
              completionDate,
              financing,
              subsidy,
              fgts,
              housingCheck,
              income,
              installments: desiredInstallments,
              tierId: input.approvalTierId,
            }),
            standardAssociativeScenario({
              code: "C2",
              signalLimit: 3,
              valueReal,
              baseDate,
              completionDate,
              financing,
              subsidy,
              fgts,
              housingCheck,
              income,
              installments: desiredInstallments,
              tierId: input.approvalTierId,
            }),
            standardAssociativeScenario({
              code: "C3",
              annualLimit: 5,
              valueReal,
              baseDate,
              completionDate,
              financing,
              subsidy,
              fgts,
              housingCheck,
              income,
              installments: desiredInstallments,
              tierId: input.approvalTierId,
            }),
            standardAssociativeScenario({
              code: "C4",
              signalLimit: 3,
              annualLimit: 5,
              valueReal,
              baseDate,
              completionDate,
              financing,
              subsidy,
              fgts,
              housingCheck,
              income,
              installments: desiredInstallments,
              tierId: input.approvalTierId,
            }),
          ]
        : [
            standardScenario({
              code: "C1",
              entryRate: 0.1,
              installmentLimit: 18,
              intermediaryLimit: 0,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C2",
              entryRate: 0.06,
              targetEntryRate: 0.1,
              installmentLimit: 18,
              signalLimit: 3,
              intermediaryLimit: 0,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C3",
              entryRate: 0.06,
              targetEntryRate: 0.1,
              installmentLimit: 18,
              signalLimit: 3,
              intermediaryLimit: annualMode ? 5 : 3,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C4",
              entryRate: 0.1,
              installmentLimit: 18,
              intermediaryLimit: annualMode ? 5 : 3,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C5",
              entryRate: 0.2,
              installmentLimit: 24,
              intermediaryLimit: 0,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C6",
              entryRate: 0.17,
              targetEntryRate: 0.2,
              installmentLimit: 24,
              signalLimit: 3,
              intermediaryLimit: 0,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C7",
              entryRate: 0.17,
              targetEntryRate: 0.2,
              installmentLimit: 24,
              signalLimit: 3,
              intermediaryLimit: annualMode ? 5 : 4,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
            standardScenario({
              code: "C8",
              entryRate: 0.2,
              installmentLimit: 24,
              intermediaryLimit: annualMode ? 5 : 4,
              valueReal,
              baseDate,
              completionDate,
              deadline,
              annualMode,
              income,
            }),
          ]
      : [];

  return {
    ok,
    status: ok ? "Aprovado | Dentro da regra" : "Bloqueado | Ver auditoria",
    errors,
    audit,
    standardScenarios,
    context: {
      salePrice,
      propertyValue,
      unitBonus,
      tableSlack,
      discount,
      valueReal,
      resourceTotal,
      balanceAfterResources,
      monthsUntil,
      maxInstallments,
      installmentsInteger,
      maxSignals: 3,
      annualMode,
      income,
      maxIntermediaries,
      intermediaryInputLimit,
      deadline: isoDate(deadline),
      signalBaseDate: isoDate(signalBaseDate),
      monthlyDates: annualMode ? customMonthlyDates : monthlyDates,
    },
    custom: {
      actRate,
      actValue,
      entryRate: totalEntryRate,
      entryValue: totalEntryValue,
      desiredInstallments,
      activeSignals,
      signals,
      signalTotal,
      activeIntermediaries,
      intermediaries,
      validIntermediaryTotal,
      totalEntryRate,
      totalEntryValue,
      financing,
      subsidy,
      fgts,
      housingCheck,
      resourceTotal,
      balanceAfterResources,
      balanceBeforeCorrection: customLinear?.proSoluto ?? balanceBeforeCorrection,
      installmentBalanceBeforeCorrection,
      correctedProSoluto: customLinear?.correctedProSoluto ?? balanceBeforeCorrection,
      balance,
      installmentValue,
      preInstallments: customLinear?.preInstallments ?? 0,
      postInstallments: customLinear?.postInstallments ?? 0,
      linear: customLinear,
      decreasing: customDecreasing,
    },
  };
}
