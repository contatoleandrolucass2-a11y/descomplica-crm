const MCMV_RATES = [
  [2160, 4.5, 4.75],
  [2850, 4.75, 5],
  [3200, 5, 5.25],
  [3500, 5.25, 5.5],
  [4000, 6, 6],
  [5000, 7, 7],
  [9600, 8.16, 8.16],
  [13000, 10, 10],
];

const CCFGTS_RATES = [
  [2160, 6.13, 5.63],
  [2850, 6.06, 5.56],
  [3200, 6.08, 5.58],
  [3500, 6.08, 5.58],
  [4000, 6.08, 5.58],
  [5000, 7, 6.5],
  [9600, 8.16, 7.66],
  [13000, 10, 10],
];

const MIP_MCMV = [
  [18, 25, 0.0082],
  [26, 30, 0.0085],
  [31, 35, 0.0108],
  [36, 40, 0.0144],
  [41, 45, 0.0244],
  [46, 50, 0.0359],
  [51, 55, 0.0645],
  [56, 60, 0.0764],
  [61, 65, 0.1296],
  [66, 70, 0.2005],
  [71, 75, 0.3729],
  [76, 99, 0.4566],
];
const MIP_SBPE = [
  [18, 25, 0.0093],
  [26, 30, 0.0096],
  [31, 35, 0.0116],
  [36, 40, 0.0154],
  [41, 45, 0.0252],
  [46, 50, 0.0386],
  [51, 55, 0.0676],
  [56, 60, 0.1533],
  [61, 65, 0.2731],
  [66, 70, 0.3259],
  [71, 75, 0.4894],
  [76, 99, 0.5312],
];

const FDR_BY_STATE = {
  DF: 7.17,
  GO: -0.68,
  MS: -3.49,
  MT: -0.13,
  AL: -8.14,
  BA: -5.03,
  CE: -7.87,
  MA: 0.69,
  PB: -6.78,
  PE: -5.31,
  PI: -8.13,
  RN: 0.58,
  SE: -6.18,
  AC: 3.44,
  AM: 0.56,
  AP: 10,
  PA: 5.45,
  RO: -10,
  RR: -4.83,
  TO: -3.17,
  ES: -5.1,
  MG: -5.68,
  RJ: -1.78,
  SP: -5.68,
  PR: -5.13,
  RS: -1.09,
  SC: 4.58,
};

const NORTH = new Set(["AC", "AM", "AP", "PA", "RO", "RR", "TO"]);
const NORTH_NORTHEAST = new Set([
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "MA",
  "PA",
  "PB",
  "PE",
  "PI",
  "RN",
  "RO",
  "RR",
  "SE",
  "TO",
]);

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function monthsBetween(start, end) {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return months;
}

export function calculateAge(birthDate, asOf = new Date()) {
  if (!birthDate) return 35;
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const reference = new Date(asOf);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) return 35;
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    reference.getUTCMonth() < birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() &&
      reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return clamp(age, 18, 99);
}

export function getMaximumTerm({
  birthDate,
  product = "mcmv",
  system = "price",
  inConstruction = false,
  asOf,
}) {
  const reference = asOf ? new Date(asOf) : new Date();
  const birth = birthDate ? new Date(`${birthDate}T00:00:00.000Z`) : null;
  const ageLimit =
    birth && !Number.isNaN(birth.getTime())
      ? Math.max(0, 966 - monthsBetween(birth, reference) - (inConstruction ? 36 : 0))
      : 966 - (inConstruction ? 36 : 0);
  const productLimit = product === "mcmv" ? 420 : system === "price" ? 360 : 420;
  return Math.max(0, Math.min(productLimit, ageLimit));
}

export function getMcmvBand(income) {
  if (income <= 2850) return "Faixa 1";
  if (income <= 4700) return "Faixa 2";
  if (income <= 8600) return "Faixa 3";
  if (income <= 13000) return "Classe Média";
  return "SBPE";
}

export function getHousingRate({
  income,
  state = "SP",
  propertyValue = 0,
  product = "mcmv",
  hasFgts36 = false,
  previousSubsidy = false,
}) {
  if (product === "sbpe") return 10.9259;
  if (previousSubsidy) {
    let rate = CCFGTS_RATES.find(([maximum]) => income <= maximum)?.[hasFgts36 ? 2 : 1] ?? 10;
    if (propertyValue > 400000 && propertyValue <= 600000) rate = Math.max(rate, 10);
    return rate;
  }
  const favored = NORTH_NORTHEAST.has(state);
  let rate = MCMV_RATES.find(([maximum]) => income <= maximum)?.[favored ? 1 : 2] ?? 10;
  if (propertyValue > 400000 && propertyValue <= 600000) rate = Math.max(rate, 10);
  if (hasFgts36 && income <= 9600 && rate < 10) rate -= 0.5;
  return rate;
}

function getMip(age, product) {
  const table = product === "sbpe" ? MIP_SBPE : MIP_MCMV;
  const rate = table.find(([minimum, maximum]) => age >= minimum && age <= maximum)?.[2];
  return (rate ?? (product === "sbpe" ? 0.5312 : 0.4566)) / 100;
}

function getDfi(product) {
  return (product === "sbpe" ? 0.0066 : 0.0071) / 100;
}

export function calculatePrice(principal, annualRate, term) {
  if (!principal || !term) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (!monthlyRate) return principal / term;
  const factor = (1 + monthlyRate) ** term;
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function calculateSacFirst(principal, annualRate, term) {
  if (!principal || !term) return 0;
  return principal / term + (principal * annualRate) / 100 / 12;
}

export function calculateSubsidy({
  income,
  propertyValue,
  state = "SP",
  cityLimit = 0,
  populationFactor = 1,
  socialFactor = true,
  previousSubsidy = false,
}) {
  if (
    previousSubsidy ||
    income > 4000 ||
    income > 3700 ||
    !income ||
    !propertyValue ||
    populationFactor <= 0
  )
    return 0;
  const maximumDiscount = 50000;
  const minimumDiscount = 1900;
  const maximumIncome = 1750;
  const minimumIncome = 3700;
  const b =
    (2 * maximumDiscount * (minimumDiscount / maximumDiscount - 1)) /
    (minimumIncome - maximumIncome);
  const a = -b / (2 * (minimumIncome - maximumIncome));
  const incomeFactor = Math.max(
    0,
    a * (income - maximumIncome) ** 2 + b * (income - maximumIncome) + maximumDiscount,
  );
  const rate = getHousingRate({ income, state, propertyValue, product: "mcmv" });
  const monthlyRate = rate / 100 / 12;
  const rateFactor = (1 + monthlyRate) ** 420;
  const financingDemand = (0.25 * income * (rateFactor - 1)) / (rateFactor * monthlyRate);
  const referenceValue = Math.min(propertyValue, 0.675 * (cityLimit || propertyValue));
  const financingFactor = clamp(10 - 40 * (financingDemand / referenceValue - 0.5), -10, 10);
  const stateFactor = FDR_BY_STATE[state] ?? 0;
  let subsidy = incomeFactor * (1 + (stateFactor + financingFactor) / 100) * populationFactor;
  subsidy = Math.min(subsidy, NORTH.has(state) ? 65000 : 55000);
  if (!socialFactor) subsidy *= 0.3;
  return subsidy < 1500 ? 0 : Math.round(subsidy);
}

export function calculateHousingSimulation(input) {
  const income = positive(input.income);
  const propertyValue = positive(input.propertyValue);
  const ownFunds = positive(input.ownFunds);
  const product = income > 13000 || propertyValue > 600000 ? "sbpe" : input.product || "mcmv";
  const system = product === "mcmv" ? "price" : input.system || "sac";
  const errors = [];
  if (!income) errors.push("Informe a renda familiar.");
  if (!propertyValue) errors.push("Informe o valor do imóvel.");
  if (!input.birthDate) errors.push("Informe a data de nascimento.");
  if (!input.state) errors.push("Selecione o estado do imóvel.");
  if (errors.length) return { ok: false, errors };

  const age = calculateAge(input.birthDate, input.asOf);
  const maximumTerm = getMaximumTerm({
    birthDate: input.birthDate,
    product,
    system,
    inConstruction: Boolean(input.inConstruction),
    asOf: input.asOf,
  });
  const term = Math.max(1, Math.min(positive(input.term) || maximumTerm, maximumTerm));
  const rate = getHousingRate({
    income,
    state: input.state,
    propertyValue,
    product,
    hasFgts36: Boolean(input.hasFgts36),
    previousSubsidy: Boolean(input.previousSubsidy),
  });
  const subsidy =
    product === "mcmv"
      ? calculateSubsidy({
          income,
          propertyValue,
          state: input.state,
          cityLimit: positive(input.cityLimit),
          populationFactor: positive(input.populationFactor) || 1,
          socialFactor: input.socialFactor !== false,
          previousSubsidy: Boolean(input.previousSubsidy),
        })
      : 0;
  const fgts = input.hasFgts36 ? positive(input.fgts) : 0;
  const totalResources = fgts + ownFunds;
  const quota = product === "mcmv" || system === "price" ? 0.8 : 0.9;
  const requestedFinancing = Math.max(0, propertyValue - totalResources - subsidy);
  const quotaFinancing = propertyValue * quota;
  const mip = getMip(age, product);
  const dfi = getDfi(product);
  const operatingFee = product === "mcmv" && income <= 2850 ? 0 : 25;
  const monthlyFactor =
    system === "price" ? calculatePrice(1, rate, term) : calculateSacFirst(1, rate, term);
  const incomeLimitPercent = product === "sbpe" && system === "price" ? 25 : 30;
  const maximumPaymentByIncome = (income * incomeLimitPercent) / 100;
  const approvedPayment = positive(input.approvedPayment);
  if (approvedPayment > maximumPaymentByIncome) {
    return {
      ok: false,
      errors: [
        `A prestação informada ultrapassa ${incomeLimitPercent}% da renda. O teto é ${maximumPaymentByIncome.toFixed(2)}.`,
      ],
    };
  }
  const paymentLimit = approvedPayment || maximumPaymentByIncome;
  const availableForFinancing = paymentLimit - propertyValue * dfi - operatingFee;
  const incomeFinancing =
    availableForFinancing > 0 ? availableForFinancing / (monthlyFactor + mip) : 0;
  const financing = Math.max(0, Math.min(requestedFinancing, quotaFinancing, incomeFinancing));
  const principalPayment =
    system === "price"
      ? calculatePrice(financing, rate, term)
      : calculateSacFirst(financing, rate, term);
  const insurance = financing * mip + propertyValue * dfi;
  const firstPayment = principalPayment + insurance + operatingFee;
  const entryNeeded = Math.max(0, propertyValue - financing - totalResources - subsidy);
  const effectiveRate = ((1 + rate / 100 / 12) ** 12 - 1) * 100;

  return {
    ok: true,
    product,
    system,
    forcedSbpe: product === "sbpe" && input.product === "mcmv",
    age,
    term,
    maximumTerm,
    rate,
    effectiveRate,
    incomeLimitPercent,
    maximumPaymentByIncome,
    approvedPayment,
    propertyValue,
    financing,
    maximumFinancingByIncome: incomeFinancing,
    quotaFinancing,
    subsidy,
    fgts,
    ownFunds,
    totalResources,
    entryNeeded,
    firstPayment,
    principalPayment,
    insurance,
    operatingFee,
    commitment: income ? (firstPayment / income) * 100 : 0,
    fitsProperty: entryNeeded <= 0.01,
  };
}

function totalInterest(principal, annualRate, term, system) {
  if (system === "sac") return (principal * (annualRate / 100 / 12) * (term + 1)) / 2;
  return calculatePrice(principal, annualRate, term) * term - principal;
}

export function calculateExtraAmortization({
  balance,
  annualRate,
  remainingTerm,
  system = "price",
  contribution = 0,
}) {
  const principal = positive(balance);
  const rate = positive(annualRate);
  const term = Math.floor(positive(remainingTerm));
  const extra = Math.min(positive(contribution), principal);
  if (!principal || !rate || !term)
    return { ok: false, errors: ["Informe saldo, taxa e prazo restantes."] };
  const originalInterest = totalInterest(principal, rate, term, system);
  const originalPayment =
    system === "sac"
      ? calculateSacFirst(principal, rate, term)
      : calculatePrice(principal, rate, term);
  const monthlyRate = rate / 100 / 12;
  const originalAmortization = principal / term;
  let remainingBalance = Math.max(0, principal - extra);
  let shortenedInterest = 0;
  let shortenedTerm = 0;
  while (remainingBalance > 0.01 && shortenedTerm < term) {
    shortenedTerm += 1;
    const interest = remainingBalance * monthlyRate;
    shortenedInterest += interest;
    let amortization = system === "sac" ? originalAmortization : originalPayment - interest;
    amortization = Math.min(remainingBalance, Math.max(0.01, amortization));
    remainingBalance -= amortization;
  }
  const newBalance = Math.max(0, principal - extra);
  const newInterest = totalInterest(newBalance, rate, term, system);
  const newPayment =
    system === "sac"
      ? calculateSacFirst(newBalance, rate, term)
      : calculatePrice(newBalance, rate, term);
  return {
    ok: true,
    originalPayment,
    newPayment,
    monthlyReduction: Math.max(0, originalPayment - newPayment),
    shortenedTerm,
    eliminatedMonths: term - shortenedTerm,
    interestSavingByTerm: Math.max(0, originalInterest - shortenedInterest),
    interestSavingByPayment: Math.max(0, originalInterest - newInterest),
  };
}

export function calculateFgtsTime(periods, asOf = new Date()) {
  const normalized = periods
    .map((period) => {
      const start = new Date(`${period.start}T00:00:00.000Z`);
      const end = period.end ? new Date(`${period.end}T00:00:00.000Z`) : new Date(asOf);
      if (
        !period.start ||
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      )
        return null;
      return { start, end, days: Math.round((end - start) / 86400000) };
    })
    .filter(Boolean);
  const overlap = normalized.some((period, index) =>
    normalized.some(
      (other, otherIndex) =>
        index < otherIndex && period.start < other.end && other.start < period.end,
    ),
  );
  const days = normalized.reduce((total, period) => total + period.days, 0);
  return {
    days,
    years: Math.floor(days / 365),
    months: Math.floor((days % 365) / 30.4368),
    eligible: days >= 1095,
    missingDays: Math.max(0, 1095 - days),
    overlap,
  };
}

export function estimateConstructionInterest({
  financing,
  annualRate,
  months,
  currentProgress = 0,
  trAnnual = 2,
  mipMonthly = 0,
  operatingFee = 25,
}) {
  const principal = positive(financing);
  const term = Math.floor(positive(months));
  if (!principal || !term)
    return { ok: false, errors: ["Informe financiamento e meses restantes da obra."] };
  const startProgress = clamp(Number(currentProgress) || 0, 0, 99) / 100;
  const tr = clamp(Number(trAnnual) || 0, 0, 2);
  const monthlyFactor = annualRate / 100 / 12 + tr / 100 / 12;
  const installments = [];
  for (let month = 1; month <= term; month += 1) {
    const priorProgress = startProgress + (1 - startProgress) * ((month - 1) / term);
    const releasedBalance = principal * priorProgress;
    installments.push({
      month,
      releasedBalance,
      interest: releasedBalance * monthlyFactor,
      payment: releasedBalance * monthlyFactor + mipMonthly + operatingFee,
    });
  }
  return {
    ok: true,
    installments,
    firstPayment: installments[0]?.payment ?? 0,
    lastPayment: installments.at(-1)?.payment ?? 0,
    total: installments.reduce((sum, installment) => sum + installment.payment, 0),
  };
}
