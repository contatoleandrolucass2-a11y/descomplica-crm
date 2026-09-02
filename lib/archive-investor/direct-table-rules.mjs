export const DIRECT_TABLE_PARAMETERS = Object.freeze({
  actMinimumRate: 0.1,
  preKeysRate: 0.3,
  postKeysRate: 0.6,
  scenarioTwoActRate: 0.06,
  scenarioTwoSignalRates: [0.0134, 0.0133, 0.0133],
  postKeysInstallments: 120,
  parkingPreKeysRate: 0.4,
  parkingPostKeysRate: 0.5,
  parkingPostKeysInstallments: 66,
  annualInterest: 0.12,
  mipRate: 0.00021,
  dfiRate: 0.00007,
  creditCommitmentLimit: 0.4,
  intermediaryMaxRate: 0.05,
  validDueDays: [5, 10, 15],
  cascadeWindowDays: 31,
});

export function isDirectTableParkingPlant(plantInput) {
  return String(plantInput ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .includes("vaga");
}

export function resolveDirectTablePolicy(plantInput) {
  const parking = isDirectTableParkingPlant(plantInput);
  return Object.freeze({
    parking,
    preKeysRate: parking
      ? DIRECT_TABLE_PARAMETERS.parkingPreKeysRate
      : DIRECT_TABLE_PARAMETERS.preKeysRate,
    postKeysRate: parking
      ? DIRECT_TABLE_PARAMETERS.parkingPostKeysRate
      : DIRECT_TABLE_PARAMETERS.postKeysRate,
    postKeysInstallments: parking
      ? DIRECT_TABLE_PARAMETERS.parkingPostKeysInstallments
      : DIRECT_TABLE_PARAMETERS.postKeysInstallments,
  });
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date;
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value, days) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addUtcMonths(value, months) {
  const result = new Date(value);
  const targetMonth = result.getUTCMonth() + months;
  result.setUTCDate(1);
  result.setUTCMonth(targetMonth);
  result.setUTCDate(value.getUTCDate());
  return result;
}

function highestCommercialDate(baseDate) {
  const limit = addUtcDays(baseDate, DIRECT_TABLE_PARAMETERS.cascadeWindowDays);
  let selected = null;
  const monthCursor = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));

  for (let offset = 0; offset <= 2; offset += 1) {
    const cursor = addUtcMonths(monthCursor, offset);
    for (const day of DIRECT_TABLE_PARAMETERS.validDueDays) {
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
      if (candidate > baseDate && candidate <= limit && (!selected || candidate > selected))
        selected = candidate;
    }
  }

  return selected;
}

function inclusiveMonthCount(startDate, endDate) {
  if (endDate < startDate) return 0;
  return (
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    endDate.getUTCMonth() -
    startDate.getUTCMonth() +
    1
  );
}

function pricePayment(principal, installmentCount = DIRECT_TABLE_PARAMETERS.postKeysInstallments) {
  if (!(principal > 0)) return 0;
  const periods = Math.max(
    1,
    Math.trunc(Number(installmentCount) || DIRECT_TABLE_PARAMETERS.postKeysInstallments),
  );
  const monthlyRate = Math.pow(1 + DIRECT_TABLE_PARAMETERS.annualInterest, 1 / 12) - 1;
  const factor = Math.pow(1 + monthlyRate, periods);
  return principal * ((monthlyRate * factor) / (factor - 1));
}

function firstPostKeysPayment(
  principal,
  installmentCount = DIRECT_TABLE_PARAMETERS.postKeysInstallments,
) {
  return (
    pricePayment(principal, installmentCount) +
    principal * DIRECT_TABLE_PARAMETERS.mipRate +
    principal * DIRECT_TABLE_PARAMETERS.dfiRate
  );
}

export function buildDirectTableAmortizationSchedule(
  principalInput,
  firstPaymentDateInput,
  installmentCountInput = DIRECT_TABLE_PARAMETERS.postKeysInstallments,
) {
  const principal = Math.max(0, Number(principalInput) || 0);
  if (!(principal > 0)) return [];
  const periods = Math.max(
    1,
    Math.trunc(Number(installmentCountInput) || DIRECT_TABLE_PARAMETERS.postKeysInstallments),
  );
  const monthlyRate = Math.pow(1 + DIRECT_TABLE_PARAMETERS.annualInterest, 1 / 12) - 1;
  const basePayment = pricePayment(principal, periods);
  const firstPaymentDate = parseIsoDate(firstPaymentDateInput);
  const schedule = [];
  let openingBalance = principal;
  let cumulativeTotalPayments = 0;

  for (let month = 1; month <= periods; month += 1) {
    const interest = openingBalance * monthlyRate;
    const amortization = Math.min(openingBalance, basePayment - interest);
    const mip = openingBalance * DIRECT_TABLE_PARAMETERS.mipRate;
    const dfiBase = month === 1 ? openingBalance : openingBalance + cumulativeTotalPayments;
    const dfi = dfiBase * DIRECT_TABLE_PARAMETERS.dfiRate;
    const totalPayment = basePayment + mip + dfi;
    const closingBalance = Math.max(0, openingBalance - amortization);
    const paymentDate = firstPaymentDate
      ? toIsoDate(addUtcMonths(firstPaymentDate, month - 1))
      : "";
    schedule.push({
      month,
      paymentDate,
      amortization,
      interest,
      mip,
      dfi,
      totalPayment,
      balance: closingBalance,
    });
    cumulativeTotalPayments += totalPayment;
    openingBalance = closingBalance;
  }

  return schedule;
}

export function buildDirectTablePreKeysSchedule(
  principalInput,
  installmentCountInput,
  firstPaymentDateInput,
) {
  const principal = Math.max(0, Number(principalInput) || 0);
  const installmentCount = Math.max(0, Math.trunc(Number(installmentCountInput) || 0));
  const firstPaymentDate = parseIsoDate(firstPaymentDateInput);
  if (!(principal > 0) || installmentCount <= 0) return [];

  const payment = principal / installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => ({
    month: index + 1,
    payment,
    paymentDate: firstPaymentDate ? toIsoDate(addUtcMonths(firstPaymentDate, index)) : "",
    balance: Math.max(0, principal - payment * (index + 1)),
  }));
}

function buildScenario({ key, label, valueReal, income, baseDate, workEndDate, payments, policy }) {
  let lastPaymentDate = baseDate;
  const datedPayments = payments.map((payment, index) => {
    const paymentDate = index === 0 ? baseDate : highestCommercialDate(lastPaymentDate);
    lastPaymentDate = paymentDate;
    return { ...payment, date: toIsoDate(paymentDate) };
  });
  const firstPreKeysDate = highestCommercialDate(lastPaymentDate);
  const preKeysInstallments = inclusiveMonthCount(firstPreKeysDate, workEndDate);

  if (preKeysInstallments <= 0) {
    return { error: "O término da obra precisa ocorrer depois do início das mensais pré-chaves." };
  }

  const lastPreKeysDate = addUtcMonths(firstPreKeysDate, preKeysInstallments - 1);
  const firstPostKeysDate = highestCommercialDate(lastPreKeysDate);
  const preKeysBalance = valueReal * policy.preKeysRate;
  const postKeysBalance = valueReal * policy.postKeysRate;
  const postKeysPayment = firstPostKeysPayment(postKeysBalance, policy.postKeysInstallments);
  const commitment = postKeysPayment / income;

  return {
    key,
    label,
    payments: datedPayments,
    firstPreKeysDate: toIsoDate(firstPreKeysDate),
    preKeysInstallments,
    preKeysBalance,
    preKeysPayment: preKeysBalance / preKeysInstallments,
    postKeysBalance,
    postKeysInstallments: policy.postKeysInstallments,
    firstPostKeysDate: toIsoDate(firstPostKeysDate),
    postKeysPayment,
    commitment,
    approved: commitment <= DIRECT_TABLE_PARAMETERS.creditCommitmentLimit,
  };
}

export function calculateDirectTable(input) {
  const developmentName = input.developmentName?.trim();
  const product = input.product?.trim();
  const plant = input.plant?.trim();
  const policy = resolveDirectTablePolicy(plant);
  const description = input.description?.trim();
  const businessUnit = input.businessUnit?.trim() || "Direcional";
  const propertyValue = Number(input.propertyValue);
  const discount = Number(input.discount || 0);
  const income = Number(input.income);
  const baseDate = parseIsoDate(input.baseDate);
  const workEndDate = parseIsoDate(input.workEndDate);
  const errors = [];

  if (!developmentName) errors.push("Informe o nome do empreendimento.");
  if (!product) errors.push("Informe o produto ou unidade.");
  if (!plant) errors.push("Informe a planta.");
  if (!(propertyValue > 0)) errors.push("O valor do imóvel deve ser maior que zero.");
  if (!(discount >= 0)) errors.push("O desconto não pode ser negativo.");
  if (propertyValue > 0 && discount >= propertyValue)
    errors.push("O desconto precisa ser menor que o valor do imóvel.");
  if (!(income > 0)) errors.push("Informe a renda mensal para validar o crédito.");
  if (!baseDate) errors.push("Informe uma data de simulação válida.");
  if (!workEndDate) errors.push("Informe uma data válida para o término da obra.");

  const valueReal = propertyValue - discount;
  const audit = [
    { label: "Empreendimento e produto", ok: Boolean(developmentName && product && plant) },
    { label: "Valor real da venda", ok: valueReal > 0 },
    { label: "Renda informada", ok: income > 0 },
    {
      label: `Distribuição 10% + ${policy.preKeysRate * 100}% + ${policy.postKeysRate * 100}%`,
      ok: true,
    },
    { label: `Prazo pós-chaves de ${policy.postKeysInstallments} parcelas`, ok: true },
  ];

  if (errors.length > 0) return { ok: false, errors, valueReal: Math.max(0, valueReal), audit };

  const scenarioOne = buildScenario({
    key: "scenario-one",
    label: "Cenário 1",
    valueReal,
    income,
    baseDate,
    workEndDate,
    policy,
    payments: [
      {
        label: "Ato",
        rate: DIRECT_TABLE_PARAMETERS.actMinimumRate,
        value: valueReal * DIRECT_TABLE_PARAMETERS.actMinimumRate,
      },
    ],
  });
  const scenarioTwo = buildScenario({
    key: "scenario-two",
    label: "Cenário 2",
    valueReal,
    income,
    baseDate,
    workEndDate,
    policy,
    payments: [
      {
        label: "Ato",
        rate: DIRECT_TABLE_PARAMETERS.scenarioTwoActRate,
        value: valueReal * DIRECT_TABLE_PARAMETERS.scenarioTwoActRate,
      },
      ...DIRECT_TABLE_PARAMETERS.scenarioTwoSignalRates.map((rate, index) => ({
        label: `Sinal ${index + 1}`,
        rate,
        value: valueReal * rate,
      })),
    ],
  });

  for (const scenario of [scenarioOne, scenarioTwo]) {
    if (scenario.error) errors.push(`${scenario.label}: ${scenario.error}`);
  }
  if (errors.length > 0) return { ok: false, errors, valueReal, audit };

  return {
    ok: true,
    developmentName,
    businessUnit,
    product,
    plant,
    description,
    workEndDate: toIsoDate(workEndDate),
    valueReal,
    income,
    policy,
    scenarios: [scenarioOne, scenarioTwo],
    audit,
  };
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(value) {
  return date.format(new Date(`${value}T00:00:00.000Z`));
}

export function formatDirectTableMessage(result, scenario) {
  const description = [result.plant, result.description].filter(Boolean).join(" | ");
  const payments = scenario.payments
    .filter((payment) => payment.value > 0)
    .map(
      (payment) =>
        `${payment.label}: ${money.format(payment.value)}  Data: ${formatDate(payment.date)}`,
    )
    .join("\n");
  return [
    `----- SIMULAÇÃO TABELA DIRETA - ${scenario.label.toUpperCase()} -----`,
    `Empreendimento: ${result.developmentName}`,
    `Produto: ${result.product} | ${description}`,
    `Término de obra: ${formatDate(result.workEndDate)}`,
    "",
    `Valor real de venda: ${money.format(result.valueReal)}`,
    "",
    payments,
    "",
    `Mensais pré-chaves: ${scenario.preKeysInstallments}x de ${money.format(scenario.preKeysPayment)}`,
    `1ª parcela: ${formatDate(scenario.firstPreKeysDate)}`,
    "",
    `Pós-chaves: ${scenario.postKeysInstallments}x de ${money.format(scenario.postKeysPayment)} (com juros)`,
    `1ª parcela: ${formatDate(scenario.firstPostKeysDate)}`,
    "",
    `Renda informada: ${money.format(result.income)}`,
    `Comprometimento: ${percent.format(scenario.commitment)} da renda`,
    `Status: ${scenario.approved ? "APROVADO" : "REPROVADO"}`,
  ].join("\n");
}
