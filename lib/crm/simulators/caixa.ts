/** Indicative mathematics, not a bank offer. Provenance and limits: docs/simulators/CAIXA.md. */
import { CAIXA_CITIES } from "./caixa-reference-data";
export type HousingProduct = "mcmv" | "sbpe";
export type HousingSystem = "price" | "sac";
export interface HousingInput {
  income: number;
  propertyValue: number;
  birthDate: string;
  state: string;
  city?: string;
  term: number;
  product?: HousingProduct;
  system?: HousingSystem;
  ownFunds?: number;
  fgts?: number;
  approvedPayment?: number;
  hasFgts36?: boolean;
  previousSubsidy?: boolean;
  socialFactor?: boolean;
  inConstruction?: boolean;
  propertyCondition?: "new" | "used";
  confirmedSubsidy?: number;
  nominalRate?: number;
  mipMonthly?: number;
  dfiMonthly?: number;
  operatingFee?: number;
  cityLimit?: number;
  populationFactor?: number;
  constructionMonths?: number;
  incomeLimitPercent?: number;
  middleClass?: boolean;
  asOf?: string | Date;
}

export const CAIXA_SOURCES = [
  {
    title: "CAIXA · Minha Casa, Minha Vida",
    url: "https://www.caixa.gov.br/voce/habitacao/minha-casa-minha-vida/urbana/Paginas/default.aspx",
  },
  {
    title: "Ministério das Cidades · taxas e faixas",
    url: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts",
  },
  { title: "Simulador oficial CAIXA", url: "https://simuladorhabitacao.caixa.gov.br/" },
] as const;
const STATES = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);
const NORTH_NORTHEAST = new Set("AC AL AM AP BA CE MA PA PB PE PI RN RO RR SE TO".split(" "));
const SOUTH_SOUTHEAST = new Set("ES MG RJ SP PR RS SC".split(" "));
// Nominal annual percentages. MCID table consulted 25/10/2026; FGTS discount: 0.5 p.p.
const MCMV_RATES = [
  [2160, 4.5, 4.75],
  [2850, 4.75, 5],
  [3200, 5, 5.25],
  [3500, 5.25, 5.5],
  [4000, 6, 6],
  [5000, 7, 7],
  [9600, 8.16, 8.16],
  [13000, 10, 10],
] as const;
const finiteNonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const floorCents = (value: number) => Math.floor((value + 1e-8) * 100) / 100;

function dateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const result = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === value
    ? result
    : null;
}
function referenceDate(value?: string | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return dateOnly(value) ?? new Date(NaN);
  return value ? new Date(value) : new Date();
}
function monthsBetween(start: Date, end: Date) {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() -
    (end.getUTCDate() < start.getUTCDate() ? 1 : 0)
  );
}
export function calculateAge(birthDate: string, asOf?: string | Date): number {
  const birth = dateOnly(birthDate),
    reference = referenceDate(asOf);
  if (!birth || !Number.isFinite(reference.getTime()) || birth > reference) return NaN;
  return Math.floor(monthsBetween(birth, reference) / 12);
}
export function getMaximumTerm({
  birthDate,
  inConstruction = false,
  constructionMonths = 0,
  asOf,
}: Pick<
  HousingInput,
  "birthDate" | "product" | "system" | "inConstruction" | "constructionMonths" | "asOf"
>) {
  const birth = dateOnly(birthDate),
    reference = referenceDate(asOf);
  if (
    !birth ||
    !Number.isFinite(reference.getTime()) ||
    calculateAge(birthDate, asOf) < 18 ||
    birth > reference
  )
    return 0;
  const productLimit = 420;
  // Oldest applicant; building period must be supplied rather than assuming 36 months.
  const buildingPeriod =
    inConstruction && Number.isInteger(constructionMonths) && constructionMonths > 0
      ? constructionMonths
      : 0;
  const expiry = new Date(Date.UTC(birth.getUTCFullYear() + 80, birth.getUTCMonth() + 6, 1));
  const expiryDay = Math.min(
    birth.getUTCDate(),
    new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate(),
  );
  expiry.setUTCDate(expiryDay);
  return Math.max(0, Math.min(productLimit, monthsBetween(reference, expiry) - buildingPeriod));
}
export function getMcmvBand(income: number) {
  if (income <= 3200) return "Faixa 1";
  if (income <= 5000) return "Faixa 2";
  if (income <= 9600) return "Faixa 3";
  if (income <= 13000) return "Classe Média";
  return "SBPE";
}
export function getHousingRate({
  income,
  state = "SP",
  product = "mcmv",
  hasFgts36 = false,
  previousSubsidy = false,
  nominalRate,
  middleClass = false,
  propertyValue = 0,
}: Partial<HousingInput> & { income: number }) {
  if (nominalRate !== undefined) return finiteNonnegative(nominalRate) ? nominalRate : NaN;
  if (product === "sbpe" || previousSubsidy || income <= 0 || income > 13000 || !STATES.has(state))
    return NaN;
  const row = MCMV_RATES.find(([maximum]) => income <= maximum);
  if (middleClass || propertyValue > 400000 || income > 9600) return 10;
  if (!row) return NaN;
  return row[NORTH_NORTHEAST.has(state) ? 1 : 2] - (hasFgts36 && income <= 9600 ? 0.5 : 0);
}
export function calculatePrice(principal: number, annualRate: number, term: number) {
  if (!principal || !term) return 0;
  const monthlyRate = annualRate / 1200;
  return monthlyRate === 0
    ? principal / term
    : (principal * monthlyRate) / -Math.expm1(-term * Math.log1p(monthlyRate));
}
export function calculateSacFirst(principal: number, annualRate: number, term: number) {
  return !principal || !term ? 0 : principal / term + (principal * annualRate) / 1200;
}
export interface HousingSuccess {
  ok: true;
  product: HousingProduct;
  system: HousingSystem;
  forcedSbpe: boolean;
  age: number;
  term: number;
  maximumTerm: number;
  rate: number;
  effectiveRate: number;
  incomeLimitPercent: number;
  maximumPaymentByIncome: number;
  approvedPayment: number;
  propertyValue: number;
  financing: number;
  maximumFinancingByIncome: number;
  quotaFinancing: number;
  subsidy: number;
  fgts: number;
  ownFunds: number;
  totalResources: number;
  entryNeeded: number;
  firstPayment: number;
  principalPayment: number;
  insurance: number;
  operatingFee: number;
  commitment: number;
  fitsProperty: boolean;
  warnings: string[];
  insuranceKnown: boolean;
  subsidyConfirmed: boolean;
  financingQuota: number;
  sources: typeof CAIXA_SOURCES;
  middleClass: boolean;
}
export type HousingResult = HousingSuccess | { ok: false; errors: string[] };
export function calculateHousingSimulation(input: HousingInput): HousingResult {
  const { income, propertyValue } = input;
  const product = input.product ?? "mcmv",
    system = input.system ?? "price";
  const middleClass =
    product === "mcmv" && (input.middleClass === true || income > 9600 || propertyValue > 400000);
  const errors: string[] = [],
    warnings: string[] = [];
  if (!Number.isFinite(income) || income <= 0) errors.push("Informe uma renda familiar válida.");
  if (!Number.isFinite(propertyValue) || propertyValue <= 0)
    errors.push("Informe um valor de imóvel válido.");
  if (income > 1e9 || propertyValue > 1e10)
    errors.push("Valores acima do limite seguro deste cálculo indicativo.");
  if (!STATES.has(input.state)) errors.push("Selecione o estado do imóvel.");
  if (!input.city?.trim()) errors.push("Selecione a cidade do imóvel.");
  else if (!CAIXA_CITIES.some((city) => city.n === input.city?.trim() && city.u === input.state))
    errors.push("Selecione uma cidade da lista correspondente ao estado.");
  if (!["mcmv", "sbpe"].includes(product) || !["price", "sac"].includes(system))
    errors.push("Selecione produto e sistema válidos.");
  const age = calculateAge(input.birthDate, input.asOf);
  if (!Number.isFinite(age) || age < 18)
    errors.push("Informe a data de nascimento válida do proponente mais velho, maior de idade.");
  const maximumTerm = getMaximumTerm({ ...input, product, system });
  if (!Number.isInteger(input.term) || input.term < 1 || input.term > maximumTerm)
    errors.push(
      `Prazo deve ser inteiro entre 1 e ${maximumTerm} meses, sujeito à análise da CAIXA.`,
    );
  for (const key of [
    "ownFunds",
    "fgts",
    "approvedPayment",
    "confirmedSubsidy",
    "mipMonthly",
    "dfiMonthly",
    "operatingFee",
    "cityLimit",
    "constructionMonths",
  ] as const) {
    if (input[key] !== undefined && (!finiteNonnegative(input[key]!) || input[key]! > 1e10))
      errors.push(`Valor inválido: ${key}.`);
  }
  if (product === "mcmv") {
    if (income > 13000)
      errors.push("Renda acima do MCMV. Selecione SBPE e informe a taxa da simulação oficial.");
    const ceiling = middleClass ? 600000 : income <= 5000 ? (input.cityLimit ?? 210000) : 400000;
    if (
      input.cityLimit !== undefined &&
      !middleClass &&
      income <= 5000 &&
      (input.cityLimit < 210000 || input.cityLimit > 275000)
    )
      errors.push(
        "Limite municipal MCMV deve ser confirmado na tabela oficial, entre R$ 210 mil e R$ 275 mil.",
      );
    if (propertyValue > ceiling)
      errors.push(
        !middleClass && income <= 5000 && input.cityLimit === undefined
          ? "Confirme o limite municipal oficial do imóvel nas faixas 1 e 2 (R$ 210 mil a R$ 275 mil)."
          : "Valor do imóvel acima do limite do MCMV para a faixa informada.",
      );
  }
  const rate = getHousingRate({ ...input, product, middleClass });
  if (!Number.isFinite(rate) || rate < 0 || rate > 100)
    errors.push("Informe a taxa nominal anual confirmada na CAIXA para este produto e perfil.");
  const subsidy = input.confirmedSubsidy ?? 0;
  const maximumSubsidy = new Set(["AC", "AM", "AP", "PA", "RO", "RR", "TO"]).has(input.state)
    ? 65000
    : 55000;
  if (subsidy > maximumSubsidy)
    errors.push(
      "Subsídio informado ultrapassa o teto regional. Confirme o desconto complemento na CAIXA.",
    );
  if (subsidy > 0 && (product !== "mcmv" || middleClass || input.previousSubsidy || income > 4000))
    errors.push("Subsídio incompatível com o perfil informado. Confirme o enquadramento na CAIXA.");
  const fgts = input.hasFgts36 ? (input.fgts ?? 0) : 0,
    ownFunds = input.ownFunds ?? 0;
  if ((input.fgts ?? 0) > 0 && !input.hasFgts36)
    errors.push("Confirme o requisito de tempo de FGTS antes de incluir o saldo.");
  if (fgts + ownFunds + subsidy > propertyValue)
    errors.push("Recursos e subsídio não podem superar o valor do imóvel.");
  const incomeLimitPercent = input.incomeLimitPercent ?? 30;
  if (!Number.isFinite(incomeLimitPercent) || incomeLimitPercent <= 0 || incomeLimitPercent > 30)
    errors.push("Teto indicativo de comprometimento deve ser maior que zero e no máximo 30%.");
  if (!input.propertyCondition || !["new", "used"].includes(input.propertyCondition))
    errors.push("Informe se o imóvel é novo ou usado para conferir a cota.");
  if (input.constructionMonths !== undefined && !Number.isInteger(input.constructionMonths))
    errors.push("Prazo de construção deve conter meses inteiros.");
  const maximumPaymentByIncome = floorCents((income * incomeLimitPercent) / 100),
    approvedPayment = input.approvedPayment ?? 0;
  if (approvedPayment > maximumPaymentByIncome)
    errors.push(
      `A prestação informada ultrapassa ${incomeLimitPercent}% da renda. Teto indicativo: R$ ${maximumPaymentByIncome.toFixed(2)}.`,
    );
  if (errors.length) return { ok: false, errors };
  const insuranceKnown = input.mipMonthly !== undefined && input.dfiMonthly !== undefined;
  const insurance = (input.mipMonthly ?? 0) + (input.dfiMonthly ?? 0),
    operatingFee = input.operatingFee ?? 0;
  if (insurance + operatingFee > (approvedPayment || maximumPaymentByIncome))
    return {
      ok: false,
      errors: [
        "Seguros e tarifa ultrapassam a prestação disponível. Não há capacidade para este cenário.",
      ],
    };
  let financingQuota =
    product === "sbpe" ? (system === "sac" ? 0.8 : 0.7) : system === "sac" ? 0.9 : 0.8;
  if (
    product === "mcmv" &&
    middleClass &&
    input.propertyCondition === "used" &&
    SOUTH_SOUTHEAST.has(input.state)
  )
    financingQuota = 0.6;
  if (!insuranceKnown)
    warnings.push(
      "MIP e DFI não confirmados: prestação e capacidade parciais, sem os seguros ausentes. Não representam o encargo total.",
    );
  if (input.operatingFee === undefined)
    warnings.push(
      "Tarifa administrativa não informada e não incluída; confirme o encargo total na CAIXA.",
    );
  if (input.confirmedSubsidy === undefined && product === "mcmv" && !middleClass)
    warnings.push(
      "Subsídio a confirmar: nenhum desconto foi abatido. A fórmula municipal não foi presumida.",
    );
  if (product === "mcmv" && !middleClass && income <= 5000 && input.cityLimit === undefined)
    warnings.push(
      "Limite municipal não confirmado: utilizado o teto conservador de R$ 210 mil, sujeito ao município.",
    );
  if (input.inConstruction && !input.constructionMonths)
    warnings.push(
      "Prazo de obra não informado: limite etário não desconta a fase de construção; confirme o prazo total na CAIXA.",
    );
  if (middleClass)
    warnings.push(
      "Enquadramento indicativo MCMV Classe Média, sem subsídio complemento: renda até R$ 13 mil, taxa nominal de referência 10% e imóvel até R$ 600 mil, sujeito à confirmação da CAIXA.",
    );
  warnings.push(
    "Cenário sem atualização futura pela TR, variação dos seguros, análise de crédito ou CET. Cotas e comprometimento são tetos indicativos; a CAIXA pode aprovar valores menores.",
  );
  const factor =
    system === "price"
      ? calculatePrice(1, rate, input.term)
      : calculateSacFirst(1, rate, input.term);
  const incomeFinancing = Math.max(
    0,
    ((approvedPayment || maximumPaymentByIncome) - insurance - operatingFee) / factor,
  );
  const quotaFinancing = floorCents(propertyValue * financingQuota);
  const financing = Math.max(
    0,
    floorCents(
      Math.min(propertyValue - ownFunds - fgts - subsidy, quotaFinancing, incomeFinancing),
    ),
  );
  const principalPayment =
    system === "price"
      ? calculatePrice(financing, rate, input.term)
      : calculateSacFirst(financing, rate, input.term);
  const firstPayment = cents(principalPayment + insurance + operatingFee),
    entryNeeded = cents(Math.max(0, propertyValue - financing - ownFunds - fgts - subsidy));
  return {
    ok: true,
    product,
    system,
    forcedSbpe: false,
    age,
    term: input.term,
    maximumTerm,
    rate,
    effectiveRate: (Math.pow(1 + rate / 1200, 12) - 1) * 100,
    incomeLimitPercent,
    maximumPaymentByIncome,
    approvedPayment,
    propertyValue,
    financing,
    maximumFinancingByIncome: floorCents(incomeFinancing),
    quotaFinancing,
    subsidy,
    fgts,
    ownFunds,
    totalResources: cents(ownFunds + fgts),
    entryNeeded,
    firstPayment,
    principalPayment: cents(principalPayment),
    insurance: cents(insurance),
    operatingFee,
    commitment: (firstPayment / income) * 100,
    fitsProperty: entryNeeded <= 0.01,
    warnings,
    insuranceKnown,
    subsidyConfirmed: input.confirmedSubsidy !== undefined,
    financingQuota,
    middleClass,
    sources: CAIXA_SOURCES,
  };
}

export function calculateExtraAmortization({
  balance,
  annualRate,
  remainingTerm,
  system = "price",
  contribution = 0,
}: {
  balance: number;
  annualRate: number;
  remainingTerm: number;
  system?: HousingSystem;
  contribution?: number;
}) {
  if (
    !Number.isFinite(balance) ||
    balance <= 0 ||
    !finiteNonnegative(annualRate) ||
    annualRate > 100 ||
    !Number.isInteger(remainingTerm) ||
    remainingTerm < 1 ||
    remainingTerm > 420 ||
    !finiteNonnegative(contribution) ||
    contribution > balance ||
    !["price", "sac"].includes(system)
  )
    return {
      ok: false as const,
      errors: ["Confira saldo, taxa nominal, prazo restante e aporte (entre zero e o saldo)."],
    };
  const payment = system === "sac" ? calculateSacFirst : calculatePrice;
  const interestTotal = (principal: number) =>
    system === "sac"
      ? (((principal * annualRate) / 1200) * (remainingTerm + 1)) / 2
      : calculatePrice(principal, annualRate, remainingTerm) * remainingTerm - principal;
  const originalPayment = payment(balance, annualRate, remainingTerm),
    newBalance = balance - contribution;
  let outstanding = newBalance,
    shortenedInterest = 0,
    shortenedTerm = 0;
  while (outstanding > 1e-8 && shortenedTerm < remainingTerm) {
    const interest = (outstanding * annualRate) / 1200;
    const amortization = system === "sac" ? balance / remainingTerm : originalPayment - interest;
    outstanding = Math.max(0, outstanding - amortization);
    shortenedInterest += interest;
    shortenedTerm++;
  }
  const newPayment = payment(newBalance, annualRate, remainingTerm);
  return {
    ok: true as const,
    originalPayment: cents(originalPayment),
    newPayment: cents(newPayment),
    monthlyReduction: cents(originalPayment - newPayment),
    shortenedTerm,
    eliminatedMonths: remainingTerm - shortenedTerm,
    interestSavingByTerm: cents(Math.max(0, interestTotal(balance) - shortenedInterest)),
    interestSavingByPayment: cents(Math.max(0, interestTotal(balance) - interestTotal(newBalance))),
  };
}

export function calculateFgtsTime(
  periods: { start: string; end?: string; company?: string }[],
  asOf?: string | Date,
) {
  const reference = referenceDate(asOf),
    intervals: [number, number][] = [];
  let invalid = !Number.isFinite(reference.getTime());
  for (const period of periods) {
    if (!period.start && !period.end) continue;
    const start = dateOnly(period.start),
      end = period.end ? dateOnly(period.end) : reference;
    if (!start || !end || !Number.isFinite(end.getTime()) || end < start || end > reference) {
      invalid = true;
      continue;
    }
    intervals.push([start.getTime(), end.getTime()]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let overlap = false;
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1]) {
      overlap ||= interval[0] < previous[1];
      previous[1] = Math.max(previous[1], interval[1]);
    } else merged.push([...interval]);
  }
  const days = Math.floor(merged.reduce((sum, [start, end]) => sum + end - start, 0) / 86400000);
  // Duration is an estimate. Calendar periods/extrato FGTS determine official eligibility.
  return {
    days,
    years: Math.floor(days / 365),
    months: Math.floor((days % 365) / 30.4368),
    eligible: !invalid && days >= 1095,
    missingDays: Math.max(0, 1095 - days),
    overlap,
    invalid,
    indicative: true as const,
  };
}

export function estimateConstructionInterest({
  financing,
  annualRate,
  months,
  currentProgress = 0,
  trAnnual = 0,
  mipMonthly = 0,
  dfiMonthly = 0,
  operatingFee = 0,
}: {
  financing: number;
  annualRate: number;
  months: number;
  currentProgress?: number;
  trAnnual?: number;
  mipMonthly?: number;
  dfiMonthly?: number;
  operatingFee?: number;
}) {
  if (
    !Number.isFinite(financing) ||
    financing <= 0 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 420 ||
    !finiteNonnegative(annualRate) ||
    annualRate > 100 ||
    !finiteNonnegative(trAnnual) ||
    trAnnual > 100 ||
    !finiteNonnegative(currentProgress) ||
    currentProgress > 100 ||
    ![mipMonthly, dfiMonthly, operatingFee].every(finiteNonnegative)
  )
    return {
      ok: false as const,
      errors: [
        "Confira financiamento, taxa, TR hipotética, progresso (0–100%) e prazo de obra (1–420 meses).",
      ],
    };
  const installments = Array.from({ length: months }, (_, index) => {
    const progress = currentProgress / 100 + ((1 - currentProgress / 100) * index) / months;
    const releasedBalance = financing * progress;
    const interest = (releasedBalance * annualRate) / 1200;
    const correction = releasedBalance * (Math.pow(1 + trAnnual / 100, 1 / 12) - 1);
    return {
      month: index + 1,
      releasedBalance: cents(releasedBalance),
      interest: cents(interest),
      correction: cents(correction),
      payment: cents(interest + correction + mipMonthly + dfiMonthly + operatingFee),
    };
  });
  return {
    ok: true as const,
    installments,
    firstPayment: installments[0]!.payment,
    lastPayment: installments.at(-1)!.payment,
    total: cents(installments.reduce((sum, row) => sum + row.payment, 0)),
  };
}
