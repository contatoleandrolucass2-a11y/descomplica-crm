import { z } from "zod";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_NEGATIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const NON_NEGATIVE_INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/;
const MAX_MONEY_CENTS = 100_000_000_000_000n;
const CENTS_PER_REAL = 100n;
const PAYMENT_DAYS = [5, 10, 15] as const;
const DAY_IN_MILLISECONDS = 86_400_000;

const boundedText = z
  .string()
  .max(200)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));

function parseMoneyCents(value: string): bigint {
  if (!value) return 0n;
  if (!NON_NEGATIVE_DECIMAL_PATTERN.test(value)) return 0n;
  const [whole = "0", decimals = ""] = value.split(".");
  return BigInt(whole) * CENTS_PER_REAL + BigInt(decimals.padEnd(2, "0"));
}

const moneyInput = z
  .union([z.literal(""), z.string().regex(NON_NEGATIVE_DECIMAL_PATTERN)])
  .refine((value) => value === "" || parseMoneyCents(value) <= MAX_MONEY_CENTS);
const integerInput = z
  .union([z.literal(""), z.string().regex(NON_NEGATIVE_INTEGER_PATTERN)])
  .refine((value) => value === "" || Number(value) <= 1_000);

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

const dateInput = z
  .string()
  .max(10)
  .refine((value) => value === "" || parseDate(value) !== null);

export const wf13InputSchema = z
  .object({
    development: boundedText,
    product: boundedText,
    stockMatch: z.boolean(),
    policyConfirmed: z.boolean(),
    policyLimit: integerInput,
    installments: integerInput,
    entryDate: dateInput,
    constructionEnd: dateInput,
    monthlyDueDay: z.enum(["5", "10", "15"]),
    income: moneyInput,
    salePrice: moneyInput,
    bonus: moneyInput,
    discount: moneyInput,
    financing: moneyInput,
    subsidy: moneyInput,
    fgts: moneyInput,
    housingCheck: moneyInput,
    entry: moneyInput,
    signal1: moneyInput,
    signal1Date: dateInput,
    signal2: moneyInput,
    signal2Date: dateInput,
    signal3: moneyInput,
    signal3Date: dateInput,
    annual1: moneyInput,
    annual2: moneyInput,
    annual3: moneyInput,
    annual4: moneyInput,
    annual5: moneyInput,
  })
  .strict();

export type Wf13Input = z.infer<typeof wf13InputSchema>;

export const WF13_FORMULA = Object.freeze({
  engineKey: "simulator.wf13" as const,
  workflow: "WF-13",
  scope: "Associativo | Fluxo Linear",
  version: "wf13-1.1.0",
  sourceRoute: "https://descomplicapro.com.br/simulacao/associativo-fluxo-linear",
  sourceAsset: "https://descomplicapro.com.br/assets/AssociativeLinearCalculator-D0Gvra4K.js",
  sourceSha256: "e9f4d1577cba434582aeb054f0f2a2eb8018a21d66fbf6ec7a72012e35641b71",
  referencePdfSha256: "dd54578f8762ea37f0a8eb6496cda945ee555a56d85dcdff317d20ccbbd834dc",
  observedAt: "2026-08-18T00:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  preRate: 0.005,
  postRate: 0.015,
  minimumEntryOrSignal: 150,
  annualRate: 0.005,
  annualIncomeLimit: 0.5,
  paymentDays: PAYMENT_DAYS,
});

type Fraction = { numerator: bigint; denominator: bigint };

type AnnualScheduleItem = {
  index: number;
  amount: number;
  dueDate: string;
  months: number;
  corrected: number;
  valid: boolean;
  reason: string;
};

type AnnualScheduleCalculation = AnnualScheduleItem & {
  amountCents: bigint;
  correctedCents: bigint;
};

type NominalSchedule = {
  installments: number;
  baseAmount: number;
  baseCount: number;
  adjustedAmount: number;
  adjustedCount: number;
  remainder: number;
  total: number;
};

export type Wf13Result = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  workflow: string;
  scope: string;
  formulaVersion: string;
  calculationDate: string;
  baseSignalDate: string;
  signalDates: string[];
  initialPaymentDate: string;
  firstInstallmentDate: string;
  initialToFirstInstallmentDays: number;
  monthlyDueDay: number;
  graceMonths: number;
  validInitialTotal: number;
  annualSchedule: AnnualScheduleItem[];
  annualNominalTotal: number;
  annualCorrectedTotal: number;
  realSaleValue: number;
  deductions: number;
  proSoluto: number;
  nominalInstallment: number;
  nominalSchedule: NominalSchedule;
  baseRate: number;
  proSolutoWithInitialCorrection: number;
  correctedProSoluto: number;
  correctedWithAnnuals: number;
  installments: number;
  policyLimit: number;
  preInstallments: number;
  postInstallments: number;
  preVariable: number;
  postVariable: number;
  prePercentage: number;
  postPercentage: number;
  prePeriodTotal: number;
  postPeriodTotal: number;
  adjustedPre: number;
  adjustedPost: number;
  prePayment: number;
  postPayment: number;
  correctedInstallment: number;
  installmentOverSale: number;
  proSolutoOverSale: number;
  audit: Array<{ label: string; ok: boolean }>;
  calculationMemory: Array<{
    step: string;
    value: number | string;
    format: "currency" | "date" | "integer";
  }>;
};

function fraction(numerator: bigint, denominator = 1n): Fraction {
  return { numerator, denominator };
}

function addFractions(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divideFractions(left: Fraction, right: Fraction): Fraction {
  if (right.numerator === 0n) return fraction(0n);
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function ratePower(rateNumerator: bigint, rateDenominator: bigint, periods: number): Fraction {
  if (periods <= 0) return fraction(1n);
  return fraction(
    (rateDenominator + rateNumerator) ** BigInt(periods),
    rateDenominator ** BigInt(periods),
  );
}

function annuityFactor(rateNumerator: bigint, rateDenominator: bigint, periods: number): Fraction {
  if (periods <= 0) return fraction(0n);
  if (rateNumerator === 0n) return fraction(1n, BigInt(periods));
  const factorNumerator = (rateDenominator + rateNumerator) ** BigInt(periods);
  const factorDenominator = rateDenominator ** BigInt(periods);
  return fraction(
    rateNumerator * factorNumerator,
    rateDenominator * (factorNumerator - factorDenominator),
  );
}

function annuityPayment(
  rateNumerator: bigint,
  rateDenominator: bigint,
  periods: number,
  presentValueCents: Fraction,
): Fraction {
  return multiplyFractions(
    presentValueCents,
    annuityFactor(rateNumerator, rateDenominator, periods),
  );
}

function roundedQuotient(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function fractionToCents(value: Fraction): bigint {
  return roundedQuotient(value.numerator, value.denominator);
}

function centsToMoney(value: bigint): number {
  return Number(value) / Number(CENTS_PER_REAL);
}

function fractionCentsToMoney(value: Fraction): number {
  return centsToMoney(fractionToCents(value));
}

function fractionToNumber(value: Fraction, scale = 1_000_000_000_000n): number {
  return Number(roundedQuotient(value.numerator * scale, value.denominator)) / Number(scale);
}

function dateText(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function monthDifference(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  );
}

function completedMonths(start: Date, end: Date): number {
  const months = monthDifference(start, end);
  return Math.max(0, months - Number(end.getUTCDate() < start.getUTCDate()));
}

function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_IN_MILLISECONDS);
}

function sameCalendarMonth(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth()
  );
}

function nextMonthPaymentDate(entryDate: Date, dueDay: number): Date {
  return new Date(Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth() + 1, dueDay));
}

function latestDate(...values: Array<Date | null>): Date | null {
  const available = values.filter((value): value is Date => value !== null);
  return available.length ? new Date(Math.max(...available.map((value) => value.getTime()))) : null;
}

function utcToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WF13_FORMULA.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildNominalSchedule(proSolutoCents: bigint, installments: number): NominalSchedule {
  if (installments <= 0) {
    return {
      installments: 0,
      baseAmount: 0,
      baseCount: 0,
      adjustedAmount: 0,
      adjustedCount: 0,
      remainder: 0,
      total: centsToMoney(proSolutoCents),
    };
  }
  const quantity = BigInt(installments);
  const baseAmountCents = proSolutoCents / quantity;
  const remainderCents = proSolutoCents % quantity;
  const adjustedCount = Number(remainderCents);
  const baseCount = installments - adjustedCount;
  return {
    installments,
    baseAmount: centsToMoney(baseAmountCents),
    baseCount,
    adjustedAmount: centsToMoney(baseAmountCents + (remainderCents > 0n ? 1n : 0n)),
    adjustedCount,
    remainder: centsToMoney(remainderCents),
    total: centsToMoney(
      baseAmountCents * BigInt(baseCount) + (baseAmountCents + 1n) * remainderCents,
    ),
  };
}

export function calculateWf13(input: Wf13Input, options: { today?: string } = {}): Wf13Result {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entryDate = parseDate(input.entryDate);
  const constructionEnd = parseDate(input.constructionEnd);
  const calculationDate = parseDate(options.today ?? utcToday());
  const monthlyDueDay = Number(input.monthlyDueDay) as (typeof PAYMENT_DAYS)[number];
  const salePriceCents = parseMoneyCents(input.salePrice);
  const incomeCents = parseMoneyCents(input.income);
  const bonusCents = parseMoneyCents(input.bonus);
  const discountCents = parseMoneyCents(input.discount);
  const financingCents = parseMoneyCents(input.financing);
  const subsidyCents = parseMoneyCents(input.subsidy);
  const fgtsCents = parseMoneyCents(input.fgts);
  const housingCheckCents = parseMoneyCents(input.housingCheck);
  const entryCents = parseMoneyCents(input.entry);
  const signalCents = [input.signal1, input.signal2, input.signal3].map(parseMoneyCents);
  const enteredSignalDates = [input.signal1Date, input.signal2Date, input.signal3Date].map(
    parseDate,
  );
  const installments = Number(input.installments || 0);
  const policyLimit = Number(input.policyLimit || 0);
  const minimumCents = BigInt(WF13_FORMULA.minimumEntryOrSignal) * CENTS_PER_REAL;

  if (!input.development.trim()) errors.push("Informe o nome completo do empreendimento.");
  if (!input.product.trim()) errors.push("Informe o produto ou a unidade exata do estoque.");
  if (!input.stockMatch)
    errors.push("Confirme o match de empreendimento e produto na fonte oficial.");
  if (!entryDate) errors.push("Informe uma data vigente válida.");
  if (!constructionEnd) errors.push("Informe a data oficial de término da obra.");
  if (entryDate && constructionEnd && constructionEnd <= entryDate) {
    errors.push("A data de término da obra deve ser posterior à data vigente.");
  }
  if (salePriceCents <= 0n) errors.push("Informe um valor de imóvel maior que zero.");
  if (bonusCents + discountCents > salePriceCents) {
    errors.push("Bônus e desconto não podem superar o valor do imóvel.");
  }
  if (entryCents < minimumCents) errors.push("A entrada deve ser de pelo menos R$ 150,00.");
  if (!input.policyConfirmed)
    errors.push("Confirme a consulta à política comercial do empreendimento.");
  if (policyLimit <= 0) errors.push("Informe o limite de parcelas aprovado na política comercial.");
  if (installments <= 0) errors.push("Informe a quantidade de parcelas mensais.");
  if (policyLimit > 0 && installments > policyLimit) {
    errors.push(`A quantidade solicitada supera o limite comercial de ${policyLimit} parcelas.`);
  }

  const signal1Valid = signalCents[0] === 0n || signalCents[0]! >= minimumCents;
  const signal2Valid =
    signalCents[1] === 0n ||
    (signalCents[0]! >= minimumCents &&
      signalCents[1]! >= minimumCents &&
      signalCents[1]! <= signalCents[0]!);
  const signal3Valid =
    signalCents[2] === 0n ||
    (signalCents[1]! >= minimumCents &&
      signalCents[2]! >= minimumCents &&
      signalCents[2]! <= signalCents[1]!);
  const signalAmountValidity = [signal1Valid, signal2Valid, signal3Valid];
  if (!signal1Valid) errors.push("Sinal 1 deve ser zero ou ter valor mínimo de R$ 150,00.");
  if (!signal2Valid) {
    errors.push(
      "Sinal 2 exige Sinal 1 válido, mínimo de R$ 150,00 e valor menor ou igual ao Sinal 1.",
    );
  }
  if (!signal3Valid) {
    errors.push(
      "Sinal 3 exige Sinal 2 válido, mínimo de R$ 150,00 e valor menor ou igual ao Sinal 2.",
    );
  }

  const baselineFirstInstallmentDate = entryDate
    ? nextMonthPaymentDate(entryDate, monthlyDueDay)
    : null;
  const validSignalDates: Array<Date | null> = [null, null, null];
  let previousPaymentDate = entryDate;
  signalCents.forEach((amountCents, index) => {
    const signalNumber = index + 1;
    const signalDate = enteredSignalDates[index];
    if (amountCents === 0n && signalDate) {
      errors.push(`Sinal ${signalNumber}: informe um valor para a data preenchida.`);
      return;
    }
    if (amountCents > 0n && !signalDate) {
      errors.push(`Sinal ${signalNumber}: informe uma data válida.`);
      return;
    }
    if (amountCents === 0n || !signalDate) return;
    if (!PAYMENT_DAYS.includes(signalDate.getUTCDate() as (typeof PAYMENT_DAYS)[number])) {
      errors.push(`Sinal ${signalNumber}: o vencimento deve ocorrer no dia 05, 10 ou 15.`);
      return;
    }
    if (!previousPaymentDate || signalDate <= previousPaymentDate) {
      errors.push(`Sinal ${signalNumber}: a data deve ser posterior ao pagamento anterior.`);
      return;
    }
    if (!signalAmountValidity[index]) return;
    validSignalDates[index] = signalDate;
    previousPaymentDate = signalDate;
  });

  const initialPaymentDate = latestDate(entryDate, ...validSignalDates);
  const firstInstallmentDate = initialPaymentDate
    ? nextMonthPaymentDate(initialPaymentDate, monthlyDueDay)
    : null;
  const baselineInterval =
    entryDate && baselineFirstInstallmentDate
      ? calendarDaysBetween(entryDate, baselineFirstInstallmentDate)
      : 0;
  const firstValidSignalDate = validSignalDates.find(Boolean) ?? null;
  if (
    entryDate &&
    baselineInterval > 30 &&
    firstValidSignalDate &&
    !sameCalendarMonth(entryDate, firstValidSignalDate)
  ) {
    errors.push(
      "Quando a primeira mensal excede 30 dias, o primeiro sinal deve estar no mesmo mês do pagamento inicial.",
    );
  }
  const initialToFirstInstallmentDays =
    initialPaymentDate && firstInstallmentDate
      ? calendarDaysBetween(initialPaymentDate, firstInstallmentDate)
      : 0;
  if (initialPaymentDate && firstInstallmentDate && initialToFirstInstallmentDays > 30) {
    const hasFutureAllowedDate = entryDate
      ? PAYMENT_DAYS.some((day) => day > entryDate.getUTCDate())
      : false;
    if (validSignalDates.every((date) => date === null) && !hasFutureAllowedDate) {
      errors.push(
        "A primeira mensal excede 30 dias e não há dia 05, 10 ou 15 futuro no mês para um sinal.",
      );
    } else if (validSignalDates.every((date) => date === null)) {
      errors.push(
        "A primeira mensal excede 30 dias. Informe valor e data de um sinal no mesmo mês.",
      );
    } else {
      errors.push(
        `O intervalo entre o último pagamento inicial e a primeira mensal é de ${initialToFirstInstallmentDays} dias; o limite é 30.`,
      );
    }
  }

  const validSignalCents = signalCents.reduce(
    (total, amountCents, index) =>
      total +
      (amountCents > 0n && signalAmountValidity[index] && validSignalDates[index]
        ? amountCents
        : 0n),
    0n,
  );
  const validInitialTotalCents = entryCents + validSignalCents;
  const graceMonths = validSignalDates.filter(Boolean).length;

  const annualCalculations = [
    input.annual1,
    input.annual2,
    input.annual3,
    input.annual4,
    input.annual5,
  ]
    .map(parseMoneyCents)
    .map((amountCents, index): AnnualScheduleCalculation => {
      const dueDate = calculationDate
        ? new Date(Date.UTC(calculationDate.getUTCFullYear() + index, 11, 15))
        : null;
      let valid = amountCents <= 0n;
      let reason = amountCents <= 0n ? "Não informado" : "";
      if (amountCents > 0n) {
        if (incomeCents <= 0n) reason = "Informe a renda para validar a anual.";
        else if (amountCents * 2n > incomeCents) reason = "A anual supera 50% da renda.";
        else if (!dueDate || !constructionEnd || dueDate > constructionEnd)
          reason = "A anual ultrapassa o término da obra.";
        else if (!calculationDate || dueDate < calculationDate)
          reason = "A data da anual já passou.";
        else {
          valid = true;
          reason = "Válida";
        }
      }
      const months =
        valid && amountCents > 0n && calculationDate && dueDate
          ? completedMonths(calculationDate, dueDate)
          : 0;
      const correctedCents =
        valid && amountCents > 0n
          ? fractionToCents(
              multiplyFractions(fraction(amountCents), ratePower(5n, 1_000n, months + 1)),
            )
          : 0n;
      if (amountCents > 0n && !valid) errors.push(`Anual ${index + 1}: ${reason}`);
      return {
        index: index + 1,
        amount: centsToMoney(amountCents),
        dueDate: dateText(dueDate),
        months,
        corrected: centsToMoney(correctedCents),
        amountCents,
        correctedCents,
        valid,
        reason,
      };
    });

  const annualNominalTotalCents = annualCalculations.reduce(
    (total, item) => total + (item.valid ? item.amountCents : 0n),
    0n,
  );
  const annualCorrectedTotalCents = annualCalculations.reduce(
    (total, item) => total + item.correctedCents,
    0n,
  );
  const annualSchedule: AnnualScheduleItem[] = annualCalculations.map((item) => ({
    index: item.index,
    amount: item.amount,
    dueDate: item.dueDate,
    months: item.months,
    corrected: item.corrected,
    valid: item.valid,
    reason: item.reason,
  }));
  const realSaleValueCents = salePriceCents - bonusCents - discountCents;
  const deductionsCents =
    financingCents +
    subsidyCents +
    fgtsCents +
    housingCheckCents +
    validInitialTotalCents +
    annualNominalTotalCents;
  const proSolutoCents =
    realSaleValueCents > deductionsCents ? realSaleValueCents - deductionsCents : 0n;
  const nominalSchedule = buildNominalSchedule(proSolutoCents, installments);

  let preInstallments = 0;
  if (firstInstallmentDate && constructionEnd && installments > 0) {
    preInstallments = Math.max(
      0,
      Math.min(installments, monthDifference(firstInstallmentDate, constructionEnd)),
    );
  }
  const postInstallments = Math.max(0, installments - preInstallments);
  const baseRateNumerator = preInstallments >= 1 ? 5n : postInstallments >= 1 ? 15n : 0n;
  const baseRate = Number(baseRateNumerator) / 1_000;
  const proSolutoFraction = fraction(proSolutoCents);
  const initialCorrection = ratePower(baseRateNumerator, 1_000n, baseRateNumerator > 0n ? 1 : 0);
  const proSolutoWithInitialCorrectionFraction = multiplyFractions(
    proSolutoFraction,
    initialCorrection,
  );
  const correctedProSolutoFraction = multiplyFractions(
    proSolutoWithInitialCorrectionFraction,
    ratePower(baseRateNumerator, 1_000n, graceMonths),
  );
  const preVariableFraction = annuityFactor(5n, 1_000n, preInstallments);
  const postVariableFraction = multiplyFractions(
    ratePower(5n, 1_000n, preInstallments),
    annuityFactor(15n, 1_000n, postInstallments),
  );
  const variableTotal = addFractions(preVariableFraction, postVariableFraction);
  const prePercentageFraction =
    preInstallments === 0
      ? fraction(0n)
      : postInstallments === 0
        ? fraction(1n)
        : divideFractions(postVariableFraction, variableTotal);
  const postPercentageFraction =
    postInstallments === 0
      ? fraction(0n)
      : preInstallments === 0
        ? fraction(1n)
        : divideFractions(preVariableFraction, variableTotal);
  const prePeriodTotalFraction = multiplyFractions(
    prePercentageFraction,
    correctedProSolutoFraction,
  );
  const postPeriodTotalFraction = multiplyFractions(
    postPercentageFraction,
    correctedProSolutoFraction,
  );
  const adjustedPostFraction = multiplyFractions(
    postPeriodTotalFraction,
    ratePower(5n, 1_000n, preInstallments),
  );
  const prePaymentFraction = annuityPayment(5n, 1_000n, preInstallments, prePeriodTotalFraction);
  const postPaymentFraction = annuityPayment(15n, 1_000n, postInstallments, adjustedPostFraction);
  const correctedInstallmentCents =
    fractionToCents(prePaymentFraction) > fractionToCents(postPaymentFraction)
      ? fractionToCents(prePaymentFraction)
      : fractionToCents(postPaymentFraction);
  const correctedProSolutoCents = fractionToCents(correctedProSolutoFraction);
  const correctedWithAnnualsCents = correctedProSolutoCents + annualCorrectedTotalCents;

  if (proSolutoCents === 0n)
    warnings.push("O pró-soluto ficou zerado após as deduções informadas.");
  if (preInstallments + postInstallments !== installments)
    errors.push("A divisão entre parcelas pré e pós não fecha a quantidade total.");
  if (nominalSchedule.total !== centsToMoney(proSolutoCents))
    errors.push("O cronograma nominal não reconcilia o saldo do pró-soluto.");

  const prePercentage = fractionToNumber(prePercentageFraction);
  const postPercentage = fractionToNumber(postPercentageFraction);
  const audit = [
    { label: "Executor WF-13 e escopo Associativo | Fluxo Linear", ok: true },
    {
      label: "Empreendimento e produto com match oficial",
      ok: Boolean(input.development.trim() && input.product.trim() && input.stockMatch),
    },
    {
      label: "Política comercial conferida",
      ok: input.policyConfirmed && policyLimit > 0 && installments <= policyLimit,
    },
    {
      label: "Entrada e sinais respeitam valor, sequência e datas",
      ok:
        entryCents >= minimumCents &&
        signalAmountValidity.every(Boolean) &&
        !errors.some((error) => error.startsWith("Sinal ")),
    },
    {
      label: "Saldo nominal usa anuais sem correção monetária",
      ok:
        deductionsCents ===
        financingCents +
          subsidyCents +
          fgtsCents +
          housingCheckCents +
          validInitialTotalCents +
          annualNominalTotalCents,
    },
    {
      label: "Cronograma nominal reconcilia o pró-soluto",
      ok: nominalSchedule.total === centsToMoney(proSolutoCents),
    },
    {
      label: "Parcelas pré e pós fecham a quantidade total",
      ok: preInstallments + postInstallments === installments,
    },
    {
      label: "Percentuais pré e pós fecham 100%",
      ok: Math.abs(prePercentage + postPercentage - Number(installments > 0)) <= 1e-9,
    },
    {
      label: "Primeira mensal ocorre em dia 05, 10 ou 15",
      ok: Boolean(
        firstInstallmentDate &&
        PAYMENT_DAYS.includes(firstInstallmentDate.getUTCDate() as (typeof PAYMENT_DAYS)[number]),
      ),
    },
    {
      label: "Intervalo até a primeira mensal não excede 30 dias",
      ok: initialToFirstInstallmentDays > 0 && initialToFirstInstallmentDays <= 30,
    },
  ];

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    workflow: WF13_FORMULA.workflow,
    scope: WF13_FORMULA.scope,
    formulaVersion: WF13_FORMULA.version,
    calculationDate: dateText(calculationDate),
    baseSignalDate: dateText(validSignalDates.find(Boolean) ?? null),
    signalDates: enteredSignalDates.map(dateText),
    initialPaymentDate: dateText(initialPaymentDate),
    firstInstallmentDate: dateText(firstInstallmentDate),
    initialToFirstInstallmentDays,
    monthlyDueDay,
    graceMonths,
    validInitialTotal: centsToMoney(validInitialTotalCents),
    annualSchedule,
    annualNominalTotal: centsToMoney(annualNominalTotalCents),
    annualCorrectedTotal: centsToMoney(annualCorrectedTotalCents),
    realSaleValue: centsToMoney(realSaleValueCents),
    deductions: centsToMoney(deductionsCents),
    proSoluto: centsToMoney(proSolutoCents),
    nominalInstallment: nominalSchedule.baseAmount,
    nominalSchedule,
    baseRate,
    proSolutoWithInitialCorrection: fractionCentsToMoney(proSolutoWithInitialCorrectionFraction),
    correctedProSoluto: centsToMoney(correctedProSolutoCents),
    correctedWithAnnuals: centsToMoney(correctedWithAnnualsCents),
    installments,
    policyLimit,
    preInstallments,
    postInstallments,
    preVariable: fractionToNumber(preVariableFraction),
    postVariable: fractionToNumber(postVariableFraction),
    prePercentage,
    postPercentage,
    prePeriodTotal: fractionCentsToMoney(prePeriodTotalFraction),
    postPeriodTotal: fractionCentsToMoney(postPeriodTotalFraction),
    adjustedPre: fractionCentsToMoney(prePeriodTotalFraction),
    adjustedPost: fractionCentsToMoney(adjustedPostFraction),
    prePayment: fractionCentsToMoney(prePaymentFraction),
    postPayment: fractionCentsToMoney(postPaymentFraction),
    correctedInstallment: centsToMoney(correctedInstallmentCents),
    installmentOverSale:
      realSaleValueCents > 0n
        ? fractionToNumber(fraction(correctedInstallmentCents, realSaleValueCents))
        : 0,
    proSolutoOverSale:
      realSaleValueCents > 0n
        ? fractionToNumber(fraction(correctedWithAnnualsCents, realSaleValueCents))
        : 0,
    audit,
    calculationMemory: [
      { step: "Valor nominal da unidade", value: centsToMoney(salePriceCents), format: "currency" },
      {
        step: "Bônus e descontos nominais",
        value: centsToMoney(bonusCents + discountCents),
        format: "currency",
      },
      { step: "Valor real da venda", value: centsToMoney(realSaleValueCents), format: "currency" },
      {
        step: "Financiamento e recursos externos",
        value: centsToMoney(financingCents + subsidyCents + fgtsCents + housingCheckCents),
        format: "currency",
      },
      {
        step: "Ato e sinais válidos",
        value: centsToMoney(validInitialTotalCents),
        format: "currency",
      },
      { step: "Anuais nominais", value: centsToMoney(annualNominalTotalCents), format: "currency" },
      {
        step: "Saldo nominal do pró-soluto",
        value: centsToMoney(proSolutoCents),
        format: "currency",
      },
      {
        step: "Mensal nominal de referência",
        value: nominalSchedule.baseAmount,
        format: "currency",
      },
      {
        step: "Ajuste total de centavos no cronograma",
        value: nominalSchedule.remainder,
        format: "currency",
      },
      { step: "Total nominal reconciliado", value: nominalSchedule.total, format: "currency" },
      {
        step: "Pró-soluto após correção inicial",
        value: fractionCentsToMoney(proSolutoWithInitialCorrectionFraction),
        format: "currency",
      },
      { step: "Parcelas antes da obra", value: preInstallments, format: "integer" },
      { step: "Parcelas após a obra", value: postInstallments, format: "integer" },
      {
        step: "Parcela corrigida",
        value: centsToMoney(correctedInstallmentCents),
        format: "currency",
      },
      { step: "Último pagamento inicial", value: dateText(initialPaymentDate), format: "date" },
      { step: "Primeira mensal", value: dateText(firstInstallmentDate), format: "date" },
      {
        step: "Intervalo em dias corridos",
        value: initialToFirstInstallmentDays,
        format: "integer",
      },
    ],
  };
}
