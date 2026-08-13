import { z } from "zod";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_NEGATIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const NON_NEGATIVE_INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/;
const MAX_MONEY = 1_000_000_000_000;

const boundedText = z
  .string()
  .max(200)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));
const moneyInput = z
  .union([z.literal(""), z.string().regex(NON_NEGATIVE_DECIMAL_PATTERN)])
  .refine((value) => value === "" || Number(value) <= MAX_MONEY);
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
    signal2: moneyInput,
    signal3: moneyInput,
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
  version: "wf13-1.0.0",
  sourceRoute: "https://descomplicapro.com.br/simulacao/associativo-fluxo-linear",
  sourceAsset: "https://descomplicapro.com.br/assets/AssociativeLinearCalculator-zNaz753O.js",
  sourceSha256: "fb55931f353857afc4164ed395a7d86e71ee1fa903985407ceca9e52075f449d",
  observedAt: "2026-08-13T00:00:00.000Z",
  preRate: 0.005,
  postRate: 0.015,
  minimumEntryOrSignal: 150,
  annualRate: 0.005,
  annualIncomeLimit: 0.5,
  paymentDays: [5, 10, 15] as const,
});

type AnnualScheduleItem = {
  index: number;
  amount: number;
  dueDate: string;
  months: number;
  corrected: number;
  valid: boolean;
  reason: string;
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
  firstInstallmentDate: string;
  graceMonths: number;
  validInitialTotal: number;
  annualSchedule: AnnualScheduleItem[];
  annualCorrectedTotal: number;
  realSaleValue: number;
  deductions: number;
  proSoluto: number;
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
  calculationMemory: Array<{ step: string; value: number | string }>;
};

function numeric(value: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
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

function lastPaymentDayWithin31Days(value: Date): Date | null {
  const limit = addDays(value, 31);
  const candidates: Date[] = [];
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    for (const day of WF13_FORMULA.paymentDays) {
      const candidate = new Date(
        Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + monthOffset, day),
      );
      if (candidate > value && candidate <= limit) candidates.push(candidate);
    }
  }
  return candidates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function annuityPayment(rate: number, periods: number, presentValue: number): number {
  if (!periods || periods <= 0) return 0;
  if (rate === 0) return -(presentValue / periods);
  const factor = (1 + rate) ** periods;
  return -((rate * presentValue * factor) / (factor - 1));
}

function latestDate(...values: Array<Date | null>): Date | null {
  const available = values.filter((value): value is Date => value !== null);
  return available.length ? new Date(Math.max(...available.map((value) => value.getTime()))) : null;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculateWf13(input: Wf13Input, options: { today?: string } = {}): Wf13Result {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entryDate = parseDate(input.entryDate);
  const constructionEnd = parseDate(input.constructionEnd);
  const calculationDate = parseDate(options.today ?? utcToday());
  const salePrice = numeric(input.salePrice);
  const income = numeric(input.income);
  const bonus = numeric(input.bonus);
  const discount = numeric(input.discount);
  const financing = numeric(input.financing);
  const subsidy = numeric(input.subsidy);
  const fgts = numeric(input.fgts);
  const housingCheck = numeric(input.housingCheck);
  const entry = numeric(input.entry);
  const signal1 = numeric(input.signal1);
  const signal2 = numeric(input.signal2);
  const signal3 = numeric(input.signal3);
  const installments = Math.trunc(numeric(input.installments));
  const policyLimit = Math.trunc(numeric(input.policyLimit));

  if (!input.development.trim()) errors.push("Informe o nome completo do empreendimento.");
  if (!input.product.trim()) errors.push("Informe o produto ou a unidade exata do estoque.");
  if (!input.stockMatch) {
    errors.push("Confirme o match de empreendimento e produto na fonte oficial.");
  }
  if (!entryDate) errors.push("Informe uma data vigente válida.");
  if (!constructionEnd) errors.push("Informe a data oficial de término da obra.");
  if (entryDate && constructionEnd && constructionEnd <= entryDate) {
    errors.push("A data de término da obra deve ser posterior à data vigente.");
  }
  if (salePrice <= 0) errors.push("Informe um valor de imóvel maior que zero.");
  if (bonus + discount > salePrice) {
    errors.push("Bônus e desconto não podem superar o valor do imóvel.");
  }
  if (entry < WF13_FORMULA.minimumEntryOrSignal) {
    errors.push("A entrada deve ser de pelo menos R$ 150,00.");
  }
  if (!input.policyConfirmed) {
    errors.push("Confirme a consulta à política comercial do empreendimento.");
  }
  if (policyLimit <= 0) {
    errors.push("Informe o limite de parcelas aprovado na política comercial.");
  }
  if (installments <= 0) errors.push("Informe a quantidade de parcelas mensais.");
  if (policyLimit > 0 && installments > policyLimit) {
    errors.push(`A quantidade solicitada supera o limite comercial de ${policyLimit} parcelas.`);
  }

  const signal1Valid = signal1 === 0 || signal1 >= WF13_FORMULA.minimumEntryOrSignal;
  const signal2Valid =
    signal2 === 0 ||
    (signal1 >= WF13_FORMULA.minimumEntryOrSignal &&
      signal2 >= WF13_FORMULA.minimumEntryOrSignal &&
      signal2 <= signal1);
  const signal3Valid =
    signal3 === 0 ||
    (signal2 >= WF13_FORMULA.minimumEntryOrSignal &&
      signal3 >= WF13_FORMULA.minimumEntryOrSignal &&
      signal3 <= signal2);
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

  const baseSignalDate = entryDate ? lastPaymentDayWithin31Days(entryDate) : null;
  const signal1Date =
    signal1 >= WF13_FORMULA.minimumEntryOrSignal && signal1Valid ? baseSignalDate : null;
  const signal2Date =
    signal2 >= WF13_FORMULA.minimumEntryOrSignal && signal2Valid && signal1Date
      ? lastPaymentDayWithin31Days(signal1Date)
      : null;
  const signal3Date =
    signal3 >= WF13_FORMULA.minimumEntryOrSignal && signal3Valid && signal2Date
      ? lastPaymentDayWithin31Days(signal2Date)
      : null;
  const latestSignalDate = latestDate(baseSignalDate, signal1Date, signal2Date, signal3Date);
  const firstInstallmentDate = latestSignalDate
    ? lastPaymentDayWithin31Days(latestSignalDate)
    : null;
  if (entryDate && !baseSignalDate) {
    errors.push("Não foi possível localizar uma data válida nos dias 5, 10 ou 15.");
  }
  if (entryDate && !firstInstallmentDate) {
    errors.push("Não foi possível definir a data de início das mensais.");
  }

  const validInitialTotal =
    entry +
    (signal1 >= WF13_FORMULA.minimumEntryOrSignal && signal1Valid ? signal1 : 0) +
    (signal2 >= WF13_FORMULA.minimumEntryOrSignal && signal2Valid ? signal2 : 0) +
    (signal3 >= WF13_FORMULA.minimumEntryOrSignal && signal3Valid ? signal3 : 0);
  const graceMonths = signal3Date ? 3 : signal2Date ? 2 : Number(Boolean(signal1Date));

  const annualSchedule = [input.annual1, input.annual2, input.annual3, input.annual4, input.annual5]
    .map(numeric)
    .map((amount, index): AnnualScheduleItem => {
      const dueDate = calculationDate
        ? new Date(Date.UTC(calculationDate.getUTCFullYear() + index, 11, 15))
        : null;
      let valid = amount <= 0;
      let reason = amount <= 0 ? "Não informado" : "";
      if (amount > 0) {
        if (income <= 0) reason = "Informe a renda para validar a anual.";
        else if (amount > income * WF13_FORMULA.annualIncomeLimit) {
          reason = "A anual supera 50% da renda.";
        } else if (!dueDate || !constructionEnd || dueDate > constructionEnd) {
          reason = "A anual ultrapassa o término da obra.";
        } else if (!calculationDate || dueDate < calculationDate) {
          reason = "A data da anual já passou.";
        } else {
          valid = true;
          reason = "Válida";
        }
      }
      const months =
        valid && amount > 0 && calculationDate && dueDate
          ? completedMonths(calculationDate, dueDate)
          : 0;
      const corrected =
        valid && amount > 0
          ? amount * (1 + WF13_FORMULA.annualRate) * (1 + WF13_FORMULA.annualRate) ** months
          : 0;
      if (amount > 0 && !valid) errors.push(`Anual ${index + 1}: ${reason}`);
      return {
        index: index + 1,
        amount,
        dueDate: dateText(dueDate),
        months,
        corrected,
        valid,
        reason,
      };
    });

  const annualCorrectedTotal = annualSchedule.reduce((total, item) => total + item.corrected, 0);
  const realSaleValue = salePrice - bonus - discount;
  const deductions =
    financing + subsidy + fgts + housingCheck + validInitialTotal + annualCorrectedTotal;
  const proSoluto = Math.max(0, realSaleValue - deductions);
  let preInstallments = 0;
  if (firstInstallmentDate && constructionEnd && installments > 0) {
    preInstallments = Math.max(
      0,
      Math.min(installments, monthDifference(firstInstallmentDate, constructionEnd)),
    );
  }
  const postInstallments = Math.max(0, installments - preInstallments);
  const baseRate =
    installments > 0 && preInstallments >= 1
      ? WF13_FORMULA.preRate
      : installments > 0 && postInstallments >= 1
        ? WF13_FORMULA.postRate
        : 0;
  const proSolutoWithInitialCorrection = proSoluto * (1 + baseRate);
  const correctedProSoluto = proSolutoWithInitialCorrection * (1 + baseRate) ** graceMonths;
  const preVariable =
    preInstallments === 0
      ? 0
      : ((1 + WF13_FORMULA.preRate) ** preInstallments * WF13_FORMULA.preRate) /
        ((1 + WF13_FORMULA.preRate) ** preInstallments - 1);
  const postVariable =
    postInstallments === 0
      ? 0
      : (1 + WF13_FORMULA.preRate) ** preInstallments *
        (((1 + WF13_FORMULA.postRate) ** postInstallments * WF13_FORMULA.postRate) /
          ((1 + WF13_FORMULA.postRate) ** postInstallments - 1));
  const prePercentage =
    preInstallments === 0
      ? 0
      : postInstallments === 0
        ? 1
        : 1 - preVariable / (preVariable + postVariable);
  const postPercentage = postInstallments === 0 ? 0 : preInstallments === 0 ? 1 : 1 - prePercentage;
  const prePeriodTotal = prePercentage * correctedProSoluto;
  const postPeriodTotal = correctedProSoluto - prePeriodTotal;
  const adjustedPre = prePeriodTotal;
  const adjustedPost = postPeriodTotal * (1 + WF13_FORMULA.preRate) ** preInstallments;
  const prePayment =
    preInstallments > 0 ? -annuityPayment(WF13_FORMULA.preRate, preInstallments, adjustedPre) : 0;
  const postPayment =
    postInstallments > 0
      ? -annuityPayment(WF13_FORMULA.postRate, postInstallments, adjustedPost)
      : 0;
  const correctedInstallment = Math.max(prePayment, postPayment, 0);
  const correctedWithAnnuals = correctedProSoluto + annualCorrectedTotal;

  if (proSoluto === 0) {
    warnings.push("O pró-soluto ficou zerado após as deduções informadas.");
  }
  if (preInstallments + postInstallments !== installments) {
    errors.push("A divisão entre parcelas pré e pós não fecha a quantidade total.");
  }
  if (Math.abs(prePercentage + postPercentage - Number(installments > 0)) > 1e-6) {
    errors.push("Os percentuais pré e pós não fecham 100%.");
  }

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
      label: "Entrada e sinais respeitam a sequência mínima",
      ok:
        entry >= WF13_FORMULA.minimumEntryOrSignal && signal1Valid && signal2Valid && signal3Valid,
    },
    { label: "D59 + D60 fecha D61", ok: preInstallments + postInstallments === installments },
    {
      label: "F59 + F60 fecha 100%",
      ok: Math.abs(prePercentage + postPercentage - Number(installments > 0)) <= 1e-6,
    },
    {
      label: "G59 + G60 fecha C48",
      ok: Math.abs(prePeriodTotal + postPeriodTotal - correctedProSoluto) <= 0.01,
    },
    {
      label: "Parcela final acompanha data 5/10/15",
      ok: Boolean(
        firstInstallmentDate &&
        WF13_FORMULA.paymentDays.includes(
          firstInstallmentDate.getUTCDate() as (typeof WF13_FORMULA.paymentDays)[number],
        ),
      ),
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
    baseSignalDate: dateText(baseSignalDate),
    signalDates: [dateText(signal1Date), dateText(signal2Date), dateText(signal3Date)],
    firstInstallmentDate: dateText(firstInstallmentDate),
    graceMonths,
    validInitialTotal,
    annualSchedule,
    annualCorrectedTotal,
    realSaleValue,
    deductions,
    proSoluto,
    baseRate,
    proSolutoWithInitialCorrection,
    correctedProSoluto,
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
    proSolutoOverSale: realSaleValue > 0 ? correctedWithAnnuals / realSaleValue : 0,
    audit,
    calculationMemory: [
      { step: "Valor real da venda", value: realSaleValue },
      { step: "Recursos e pagamentos deduzidos", value: deductions },
      { step: "Saldo do pró-soluto", value: proSoluto },
      { step: "Pró-soluto corrigido", value: correctedProSoluto },
      { step: "Parcelas antes da obra", value: preInstallments },
      { step: "Parcelas após a obra", value: postInstallments },
      { step: "Parcela corrigida", value: correctedInstallment },
    ],
  };
}
