import {
  calculateDirectTable,
  DIRECT_TABLE_PARAMETERS,
  resolveDirectTablePolicy,
} from "./direct-table-rules.mjs";
export {
  buildDirectTableAmortizationSchedule,
  buildDirectTablePreKeysSchedule,
} from "./direct-table-rules.mjs";

const INTERMEDIARY_OFFSETS = [180, 360, 540, 720, 900, 1080, 1260, 1440];

export const DIRECT_TABLE_PROPOSAL_OPTIONS = Object.freeze([
  Object.freeze({
    id: "without-signal-without-intermediary",
    label: "Opção sem sinal e sem intermediária",
    title: "Pagamento simples",
    entrySummary: "Ato de 10%",
    signalSummary: "Sem sinais",
    intermediarySummary: "Sem intermediária",
    withSignals: false,
    withIntermediary: false,
  }),
  Object.freeze({
    id: "with-signal-without-intermediary",
    label: "Opção com sinal e sem intermediária",
    title: "Entrada distribuída",
    entrySummary: "Ato de 6%",
    signalSummary: "3 sinais somam 4%",
    intermediarySummary: "Sem intermediária",
    withSignals: true,
    withIntermediary: false,
  }),
  Object.freeze({
    id: "without-signal-with-intermediary",
    label: "Opção sem sinal e com intermediária",
    title: "Parcela reduzida",
    entrySummary: "Ato de 10%",
    signalSummary: "Sem sinais",
    intermediarySummary: "Intermediárias de 5% conforme a entrega",
    withSignals: false,
    withIntermediary: true,
  }),
  Object.freeze({
    id: "with-signal-with-intermediary",
    label: "Opção com sinal e com intermediária",
    title: "Maior flexibilidade",
    entrySummary: "Ato de 6%",
    signalSummary: "3 sinais somam 4%",
    intermediarySummary: "Intermediárias de 5% conforme a entrega",
    withSignals: true,
    withIntermediary: true,
  }),
]);

export function buildDirectTableProposalPreset(optionId, valueRealInput, dates = {}) {
  const option = DIRECT_TABLE_PROPOSAL_OPTIONS.find((item) => item.id === optionId);
  if (!option) return null;
  const valueReal = moneyValue(valueRealInput);
  const policy = resolveDirectTablePolicy(dates.plant);
  const entryRate = option.withSignals
    ? DIRECT_TABLE_PARAMETERS.scenarioTwoActRate
    : DIRECT_TABLE_PARAMETERS.actMinimumRate;
  const entryValue = roundMoney(valueReal * entryRate);
  const signals = option.withSignals
    ? DIRECT_TABLE_PARAMETERS.scenarioTwoSignalRates.map((rate) => roundMoney(valueReal * rate))
    : [0, 0, 0];
  if (option.withSignals) {
    const targetEntry = roundMoney(valueReal * DIRECT_TABLE_PARAMETERS.actMinimumRate);
    const currentEntry = roundMoney(
      entryValue + signals.reduce((total, value) => total + value, 0),
    );
    signals[0] = roundMoney(signals[0] + targetEntry - currentEntry);
  }
  const intermediaryPreset = buildIntermediaryPreset(option, valueReal, dates, policy);
  return {
    ...option,
    entryValue,
    signals,
    intermediaries: intermediaryPreset.values,
    signalFieldCount: option.withSignals ? 3 : 0,
    intermediaryFieldCount: intermediaryPreset.count,
    intermediaryDates: intermediaryPreset.dates,
  };
}

function buildIntermediaryPreset(option, valueReal, dates, policy) {
  const empty = { count: 0, dates: [], values: INTERMEDIARY_OFFSETS.map(() => 0) };
  if (!option.withIntermediary || valueReal <= 0) return empty;

  const baseDate = parseIsoDate(dates.baseDate);
  const completionDate = parseIsoDate(dates.completionDate);
  if (!baseDate || !completionDate || completionDate <= baseDate) return empty;

  let lastEntryDate = baseDate;
  if (option.withSignals) {
    for (let index = 0; index < DIRECT_TABLE_PARAMETERS.scenarioTwoSignalRates.length; index += 1) {
      const signalDate = highestCommercialDate(lastEntryDate);
      if (!signalDate) return empty;
      lastEntryDate = signalDate;
    }
  }

  const firstPreKeysDate = highestCommercialDate(lastEntryDate);
  const preKeysInstallments = inclusiveMonthCount(firstPreKeysDate, completionDate);
  const monthlyDateSet = new Set(
    firstPreKeysDate
      ? Array.from({ length: preKeysInstallments }, (_, index) =>
          isoDate(addMonthsClamped(firstPreKeysDate, index)),
        )
      : [],
  );
  const deadline = addMonthsClamped(completionDate, -3);
  const eligibleDates = eligibleIntermediaryDates(
    baseDate,
    firstPreKeysDate,
    deadline,
    monthlyDateSet,
  );
  const maxAtFivePercent = Math.floor(
    (policy.preKeysRate + Number.EPSILON) / DIRECT_TABLE_PARAMETERS.intermediaryMaxRate,
  );
  const count = Math.min(eligibleDates.length, INTERMEDIARY_OFFSETS.length, maxAtFivePercent);
  const intermediaryValue = roundMoney(valueReal * DIRECT_TABLE_PARAMETERS.intermediaryMaxRate);
  const values = INTERMEDIARY_OFFSETS.map((_, index) => (index < count ? intermediaryValue : 0));
  if (count === maxAtFivePercent) {
    const targetTotal = roundMoney(valueReal * policy.preKeysRate);
    const currentTotal = roundMoney(values.reduce((total, value) => total + value, 0));
    values[count - 1] = roundMoney(values[count - 1] - Math.max(0, currentTotal - targetTotal));
  }

  return {
    count,
    dates: eligibleDates.slice(0, count).map(isoDate),
    values,
  };
}

function eligibleIntermediaryDates(baseDate, firstPreKeysDate, deadline, monthlyDateSet) {
  if (!baseDate || !firstPreKeysDate || !deadline) return [];
  return INTERMEDIARY_OFFSETS.map((offset) =>
    fixedDayFromOffset(baseDate, offset, firstPreKeysDate.getUTCDate()),
  ).filter(
    (date) => date >= firstPreKeysDate && date <= deadline && monthlyDateSet.has(isoDate(date)),
  );
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
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

function highestCommercialDate(baseDate) {
  const limit = addDays(baseDate, DIRECT_TABLE_PARAMETERS.cascadeWindowDays);
  let selected = null;
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    const month = addMonthsClamped(
      new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 12)),
      monthOffset,
    );
    for (const day of DIRECT_TABLE_PARAMETERS.validDueDays) {
      const candidate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 12));
      if (candidate > baseDate && candidate <= limit && (!selected || candidate > selected))
        selected = candidate;
    }
  }
  return selected;
}

function inclusiveMonthCount(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return 0;
  return (
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    endDate.getUTCMonth() -
    startDate.getUTCMonth() +
    1
  );
}

function fixedDayFromOffset(baseDate, offset, dueDay = 15) {
  const offsetDate = addDays(baseDate, offset);
  return new Date(Date.UTC(offsetDate.getUTCFullYear(), offsetDate.getUTCMonth(), dueDay, 12));
}

function mapStandardScenario(result, scenario, income) {
  const entry = scenario.payments[0];
  const signals = scenario.payments.slice(1).map((payment, index) => ({
    index: index + 1,
    value: payment.value,
    date: payment.date,
  }));
  return {
    code: scenario.key === "scenario-one" ? "C1" : "C2",
    entryRate: entry.rate,
    targetEntryRate: DIRECT_TABLE_PARAMETERS.actMinimumRate,
    installmentLimit: scenario.preKeysInstallments,
    signalLimit: signals.length,
    intermediaryLimit: 0,
    installments: scenario.preKeysInstallments,
    intermediaryCount: 0,
    intermediaryDates: [],
    entry: entry.value,
    signals,
    signalTotal: signals.reduce((total, item) => total + item.value, 0),
    intermediaryTotal: 0,
    balance: scenario.preKeysBalance,
    installmentValue: scenario.preKeysPayment,
    lastInstallmentValue: scenario.preKeysPayment,
    installmentValues: Array.from(
      { length: scenario.preKeysInstallments },
      () => scenario.preKeysPayment,
    ),
    firstInstallmentDate: scenario.firstPreKeysDate,
    monthlyDates: Array.from({ length: scenario.preKeysInstallments }, (_, index) =>
      isoDate(addMonthsClamped(parseIsoDate(scenario.firstPreKeysDate), index)),
    ),
    postKeysBalance: scenario.postKeysBalance,
    postKeysInstallments: scenario.postKeysInstallments,
    postKeysPayment: scenario.postKeysPayment,
    firstPostKeysDate: scenario.firstPostKeysDate,
    commitment: income > 0 ? scenario.postKeysPayment / income : null,
    creditApproved:
      income > 0 &&
      scenario.postKeysPayment / income <= DIRECT_TABLE_PARAMETERS.creditCommitmentLimit,
    available: scenario.preKeysInstallments > 0,
  };
}

export function calculateDirectTableFileFlow(input) {
  const baseDate = parseIsoDate(input.baseDate);
  const completionDate = parseIsoDate(input.completionDate);
  const salePrice = moneyValue(input.salePrice);
  const discount = input.discountAuthorized ? moneyValue(input.discount) : 0;
  const valueReal = Math.max(0, salePrice - discount);
  const policy = resolveDirectTablePolicy(input.plant);
  const income = moneyValue(input.income);
  const actValue = moneyValue(input.entryValue);
  const actRate = valueReal > 0 ? actValue / valueReal : 0;
  const signalValues = Array.from({ length: 3 }, (_, index) => moneyValue(input.signals?.[index]));
  const intermediaryValues = INTERMEDIARY_OFFSETS.map((_, index) =>
    moneyValue(input.intermediaries?.[index]),
  );

  let previousSignalDate = baseDate;
  const signals = signalValues.map((value, index) => {
    const signalDate = previousSignalDate ? highestCommercialDate(previousSignalDate) : null;
    if (signalDate) previousSignalDate = signalDate;
    const previousValue = index > 0 ? signalValues[index - 1] : actValue;
    let reason = "Dentro da regra";
    if (value <= 0) reason = "Não usado";
    else if (previousValue <= 0)
      reason = index === 0 ? "Preencha o ato primeiro" : `Preencha o Sinal ${index} primeiro`;
    else if (value > previousValue)
      reason =
        index === 0
          ? "Sinal 1 não pode ser maior que o ato"
          : `Sinal ${index + 1} não pode ser maior que o Sinal ${index}`;
    const approved = value <= 0 || reason === "Dentro da regra";
    return {
      index: index + 1,
      value,
      date: isoDate(signalDate),
      rate: valueReal > 0 ? value / valueReal : 0,
      active: value > 0,
      approved,
      status: value <= 0 ? "Disponível" : approved ? "Dentro da regra" : "Ajuste necessário",
      reason,
    };
  });
  const invalidSignals = signals.filter((item) => item.active && !item.approved);
  const approvedSignals = signals.filter((item) => item.active && item.approved);
  const signalTotal = approvedSignals.reduce((total, item) => total + item.value, 0);
  const totalEntryValue = actValue + signalTotal;
  const totalEntryRate = valueReal > 0 ? totalEntryValue / valueReal : 0;
  const lastEntryDate =
    approvedSignals.length > 0 ? parseIsoDate(approvedSignals.at(-1).date) : baseDate;
  const firstPreKeysDate = lastEntryDate ? highestCommercialDate(lastEntryDate) : null;
  const preKeysInstallments = inclusiveMonthCount(firstPreKeysDate, completionDate);
  const monthlyDates = firstPreKeysDate
    ? Array.from({ length: preKeysInstallments }, (_, index) =>
        isoDate(addMonthsClamped(firstPreKeysDate, index)),
      )
    : [];
  const monthlyDateSet = new Set(monthlyDates);
  const deadline = completionDate ? addMonthsClamped(completionDate, -3) : null;
  const intermediaryInputLimit = eligibleIntermediaryDates(
    baseDate,
    firstPreKeysDate,
    deadline,
    monthlyDateSet,
  ).length;

  const intermediaryBudget = roundMoney(valueReal * policy.preKeysRate);
  let approvedIntermediaryTotal = 0;
  const intermediaries = intermediaryValues.map((value, index) => {
    const intermediaryDate =
      baseDate && firstPreKeysDate
        ? fixedDayFromOffset(baseDate, INTERMEDIARY_OFFSETS[index], firstPreKeysDate.getUTCDate())
        : null;
    const rate = valueReal > 0 ? value / valueReal : 0;
    const maximumValue =
      Math.round(valueReal * DIRECT_TABLE_PARAMETERS.intermediaryMaxRate * 100) / 100;
    let reason = "Dentro da regra";
    if (value <= 0) reason = "Não usada";
    else if (totalEntryRate < DIRECT_TABLE_PARAMETERS.actMinimumRate)
      reason = "Entrada total menor que 10%";
    else if (value > maximumValue) reason = "Intermediária acima de 5%";
    else if (roundMoney(approvedIntermediaryTotal + value) > intermediaryBudget)
      reason = `Intermediárias acima do saldo pré-chaves de ${policy.preKeysRate * 100}%`;
    else if (!deadline || intermediaryDate > deadline) reason = "Fora do prazo da obra";
    else if (!firstPreKeysDate || intermediaryDate < firstPreKeysDate)
      reason = "Anterior à primeira mensal pré-chaves";
    else if (!monthlyDateSet.has(isoDate(intermediaryDate))) reason = "Sem mensal na mesma data";
    const approved = value <= 0 || reason === "Dentro da regra";
    if (value > 0 && approved)
      approvedIntermediaryTotal = roundMoney(approvedIntermediaryTotal + value);
    return {
      index: index + 1,
      value,
      date: isoDate(intermediaryDate),
      rate,
      approved,
      status: value <= 0 ? "Neutro" : approved ? "Aprovado" : "Reprovado",
      reason,
    };
  });
  const invalidIntermediaries = intermediaries.filter((item) => item.value > 0 && !item.approved);
  const validIntermediaryTotal = intermediaries
    .filter((item) => item.value > 0 && item.approved)
    .reduce((total, item) => total + item.value, 0);
  const preKeysBalance = Math.max(0, valueReal * policy.preKeysRate - validIntermediaryTotal);
  const preKeysPayment = preKeysInstallments > 0 ? preKeysBalance / preKeysInstallments : 0;
  const lastPreKeysDate =
    preKeysInstallments > 0 ? addMonthsClamped(firstPreKeysDate, preKeysInstallments - 1) : null;
  const firstPostKeysDate = lastPreKeysDate ? highestCommercialDate(lastPreKeysDate) : null;

  const standardInput = {
    developmentName: input.developmentName || "Empreendimento selecionado",
    businessUnit: input.businessUnit || "Direcional",
    product: input.product || "Unidade selecionada",
    plant: input.plant || "Planta selecionada",
    description: input.description || "",
    propertyValue: salePrice,
    discount,
    income: income || 1,
    baseDate: input.baseDate,
    workEndDate: input.completionDate,
  };
  const standardResult = calculateDirectTable(standardInput);
  const standardScenarios =
    standardResult.scenarios?.map((scenario) =>
      mapStandardScenario(standardResult, scenario, income),
    ) ?? [];
  const firstStandardScenario = standardScenarios[0];
  const postKeysBalance = firstStandardScenario?.postKeysBalance ?? valueReal * policy.postKeysRate;
  const postKeysPayment = firstStandardScenario?.postKeysPayment ?? 0;
  const commitment = income > 0 ? postKeysPayment / income : 0;
  const creditApproved = income > 0 && commitment <= DIRECT_TABLE_PARAMETERS.creditCommitmentLimit;

  const audit = [
    {
      id: "context",
      label: "Unidade, valor e data da obra válidos",
      ok: Boolean(
        input.selectedUnitId &&
        salePrice > 0 &&
        completionDate &&
        baseDate &&
        completionDate > baseDate,
      ),
    },
    {
      id: "act",
      label: "Ato mínimo de 6%",
      ok: actValue >= roundMoney(valueReal * DIRECT_TABLE_PARAMETERS.scenarioTwoActRate),
    },
    {
      id: "entry",
      label: "Ato e sinais totalizam pelo menos 10%",
      ok: totalEntryRate >= DIRECT_TABLE_PARAMETERS.actMinimumRate,
    },
    {
      id: "signals",
      label: invalidSignals[0]?.reason ?? "Sinais respeitam a ordem e a cascata",
      ok: invalidSignals.length === 0,
    },
    {
      id: "distribution",
      label: `Distribuição 10% + ${policy.preKeysRate * 100}% + ${policy.postKeysRate * 100}%`,
      ok: valueReal > 0,
    },
    {
      id: "pre-keys",
      label: `${preKeysInstallments} mensais pré-chaves calculadas`,
      ok: preKeysInstallments > 0 && preKeysBalance >= 0,
    },
    {
      id: "intermediaries",
      label:
        invalidIntermediaries[0]?.reason ?? "Até 8 intermediárias respeitam 5%, prazo e mensal",
      ok: invalidIntermediaries.length === 0,
    },
    {
      id: "post-keys",
      label: `Pós-chaves em ${policy.postKeysInstallments} parcelas com juros, MIP e DFI`,
      ok: postKeysPayment > 0,
    },
    { id: "income", label: "Renda mensal informada", ok: income > 0 },
    {
      id: "credit",
      label:
        income > 0 ? `Comprometimento de renda até 40%` : "Informe a renda para validar o crédito",
      ok: creditApproved,
    },
  ];
  const errors = audit.filter((item) => !item.ok).map((item) => item.label);
  const ok = errors.length === 0;

  return {
    ok,
    status: income <= 0 ? "Informe a renda" : creditApproved ? "APROVADO" : "REPROVADO",
    errors,
    audit,
    standardScenarios,
    context: {
      salePrice,
      discount,
      valueReal,
      monthsUntil: preKeysInstallments,
      maxInstallments: preKeysInstallments,
      maxSignals: 3,
      maxIntermediaries: 8,
      intermediaryInputLimit,
      deadline: isoDate(deadline),
      signalBaseDate: signals[0]?.date ?? "",
      monthlyDates,
      parkingPolicy: policy.parking,
      preKeysRate: policy.preKeysRate,
      postKeysRate: policy.postKeysRate,
      postKeysInstallments: policy.postKeysInstallments,
    },
    custom: {
      actRate,
      actValue,
      entryRate: totalEntryRate,
      entryValue: totalEntryValue,
      desiredInstallments: preKeysInstallments,
      activeSignals: approvedSignals.length,
      signals,
      signalTotal,
      activeIntermediaries: intermediaries.filter((item) => item.value > 0).length,
      validIntermediaryCount: intermediaries.filter((item) => item.value > 0 && item.approved)
        .length,
      intermediaries,
      validIntermediaryTotal,
      totalEntryRate,
      totalEntryValue,
      balance: preKeysBalance,
      installmentValue: preKeysPayment,
      firstPreKeysDate: isoDate(firstPreKeysDate),
      lastPreKeysDate: isoDate(lastPreKeysDate),
      postKeysBalance,
      postKeysInstallments: policy.postKeysInstallments,
      postKeysPayment,
      firstPostKeysDate: isoDate(firstPostKeysDate),
      income,
      commitment,
      creditApproved,
    },
  };
}
