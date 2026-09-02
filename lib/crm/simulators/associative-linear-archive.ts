export type AssociativeLinearForm = {
  development: string;
  product: string;
  stockMatch: boolean;
  policyConfirmed: boolean;
  policyLimit: string;
  installments: string;
  entryDate: string;
  constructionEnd: string;
  salePrice: string;
  bonus: string;
  discount: string;
  financing: string;
  subsidy: string;
  fgts: string;
  housingCheck: string;
  entry: string;
  signal1: string;
  signal2: string;
  signal3: string;
  annual1: string;
  annual2: string;
  annual3: string;
  annual4: string;
  annual5: string;
};

type AnnualSchedule = {
  index: number;
  amount: number;
  dueDate: string;
  months: number;
  corrected: number;
  valid: boolean;
  reason: string;
};

export type AssociativeLinearArchiveResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  firstInstallmentDate: string;
  graceMonths: number;
  validInitialTotal: number;
  annualSchedule: AnnualSchedule[];
  annualCorrectedTotal: number;
  proSoluto: number;
  correctedInstallmentBalance: number;
  installments: number;
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
};

const PARAMETERS = {
  preRate: 0.005,
  postRate: 0.015,
  minimumEntryOrSignal: 150,
  annualRate: 0.005,
  paymentDays: [5, 10, 15],
} as const;

function number(value: string): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function iso(value: Date | null): string {
  return value?.toISOString().slice(0, 10) ?? "";
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function monthsByCalendar(start: Date, end: Date): number {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
}

function fullMonthsBetween(start: Date, end: Date): number {
  const months = monthsByCalendar(start, end);
  return Math.max(0, months - Number(end.getUTCDate() < start.getUTCDate()));
}

function latestOfficialDate(date: Date, maximumDays: number): Date | null {
  const limit = addDays(date, maximumDays);
  const candidates: Date[] = [];
  for (let offset = 0; offset <= 2; offset += 1) {
    for (const day of PARAMETERS.paymentDays) {
      const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, day));
      if (candidate > date && candidate <= limit) candidates.push(candidate);
    }
  }
  return candidates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function pmt(rate: number, periods: number, presentValue: number): number {
  if (periods <= 0) return 0;
  const factor = (1 + rate) ** periods;
  return -((rate * presentValue * factor) / (factor - 1));
}

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function calculateAssociativeLinearArchive(
  raw: AssociativeLinearForm,
  options: { today?: string } = {},
): AssociativeLinearArchiveResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entryDate = parseDate(raw.entryDate);
  const constructionEnd = parseDate(raw.constructionEnd);
  const calculationDate = parseDate(options.today ?? todayIso());
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

  if (!raw.development.trim()) errors.push("Informe o nome completo do empreendimento.");
  if (!raw.product.trim()) errors.push("Informe o produto ou a unidade exata do estoque.");
  if (!raw.stockMatch) errors.push("Confirme o match de empreendimento e produto na fonte oficial.");
  if (!entryDate) errors.push("Informe uma data vigente válida.");
  if (!constructionEnd) errors.push("Informe a data oficial de término da obra.");
  if (entryDate && constructionEnd && constructionEnd <= entryDate) errors.push("A data de término da obra deve ser posterior à data vigente.");
  if (salePrice <= 0) errors.push("Informe um valor de imóvel maior que zero.");
  if (bonus + discount > salePrice) errors.push("Bônus e desconto não podem superar o valor do imóvel.");
  if (entry < 150) errors.push("A entrada deve ser de pelo menos R$ 150,00.");
  if (!raw.policyConfirmed) errors.push("Confirme a consulta à política comercial do empreendimento.");
  if (policyLimit <= 0) errors.push("Informe o limite de parcelas aprovado na política comercial.");
  if (installments <= 0) errors.push("Informe a quantidade de parcelas mensais.");
  if (policyLimit > 0 && installments > policyLimit) errors.push(`A quantidade solicitada supera o limite comercial de ${policyLimit} parcelas.`);

  const signal1Valid = signal1 === 0 || signal1 >= 150;
  const signal2Valid = signal2 === 0 || (signal1 >= 150 && signal2 >= 150 && signal2 <= signal1);
  const signal3Valid = signal3 === 0 || (signal2 >= 150 && signal3 >= 150 && signal3 <= signal2);
  if (!signal1Valid) errors.push("Sinal 1 deve ser zero ou ter valor mínimo de R$ 150,00.");
  if (!signal2Valid) errors.push("Sinal 2 exige Sinal 1 válido, mínimo de R$ 150,00 e valor menor ou igual ao Sinal 1.");
  if (!signal3Valid) errors.push("Sinal 3 exige Sinal 2 válido, mínimo de R$ 150,00 e valor menor ou igual ao Sinal 2.");

  const baseSignalDate = entryDate ? latestOfficialDate(entryDate, 31) : null;
  const signal1Date = signal1 >= 150 && signal1Valid && baseSignalDate ? baseSignalDate : null;
  const signal2Date = signal2 >= 150 && signal2Valid && signal1Date ? latestOfficialDate(signal1Date, 31) : null;
  const signal3Date = signal3 >= 150 && signal3Valid && signal2Date ? latestOfficialDate(signal2Date, 31) : null;
  const graceMonths = signal3Date ? 3 : signal2Date ? 2 : signal1Date ? 1 : 0;
  const installmentBaseDate = calculationDate ? latestOfficialDate(calculationDate, 30) : null;
  const firstInstallmentDate = entry >= 150 && installmentBaseDate ? addMonths(installmentBaseDate, graceMonths) : null;
  if (entryDate && !baseSignalDate) errors.push("Não foi possível localizar uma data válida nos dias 5, 10 ou 15.");
  if (entry >= 150 && !firstInstallmentDate) errors.push("Não foi possível definir a data de início das mensais.");

  const validInitialTotal = entry + (signal1Valid && signal1 >= 150 ? signal1 : 0) + (signal2Valid && signal2 >= 150 ? signal2 : 0) + (signal3Valid && signal3 >= 150 ? signal3 : 0);
  const annualInputs = [raw.annual1, raw.annual2, raw.annual3, raw.annual4, raw.annual5].map(number);
  const annualSchedule = annualInputs.map((amount, index): AnnualSchedule => {
    const dueDate = calculationDate ? new Date(Date.UTC(calculationDate.getUTCFullYear() + index, 11, 15)) : null;
    let valid = amount <= 0;
    let reason = amount <= 0 ? "Não informado" : "";
    if (amount > 0) {
      if (!dueDate || !constructionEnd || dueDate > constructionEnd) reason = "A anual ultrapassa o término da obra.";
      else if (!calculationDate || dueDate < calculationDate) reason = "A data da anual já passou.";
      else { valid = true; reason = "Válida"; }
    }
    const months = valid && amount > 0 && calculationDate && dueDate ? fullMonthsBetween(calculationDate, dueDate) : 0;
    const corrected = valid && amount > 0 ? amount * 1.005 * 1.005 ** months : 0;
    if (amount > 0 && !valid) errors.push(`Anual ${index + 1}: ${reason}`);
    return { index: index + 1, amount, dueDate: iso(dueDate), months, corrected, valid, reason };
  });
  const annualCorrectedTotal = annualSchedule.reduce((total, annual) => total + annual.corrected, 0);
  const realSaleValue = salePrice - bonus - discount;
  const proSoluto = Math.max(0, realSaleValue - financing - subsidy - fgts - housingCheck - validInitialTotal);
  const installmentBalance = Math.max(0, proSoluto - annualCorrectedTotal);
  if (installments > 0 && proSoluto > 0 && annualCorrectedTotal >= proSoluto) errors.push("O total corrigido das anuais deve ser menor que o Pró-Soluto para preservar ao menos uma parcela mensal.");

  const preInstallments = firstInstallmentDate && constructionEnd && installments > 0 ? Math.max(0, Math.min(installments, monthsByCalendar(firstInstallmentDate, constructionEnd))) : 0;
  const postInstallments = Math.max(0, installments - preInstallments);
  const baseRate = preInstallments >= 1 ? PARAMETERS.preRate : postInstallments >= 1 ? PARAMETERS.postRate : 0;
  const correctedInstallmentBalance = installmentBalance * (1 + baseRate) * (1 + baseRate) ** graceMonths;
  const preVariable = preInstallments === 0 ? 0 : ((1.005 ** preInstallments * 0.005) / (1.005 ** preInstallments - 1));
  const postVariable = postInstallments === 0 ? 0 : 1.005 ** preInstallments * ((1.015 ** postInstallments * 0.015) / (1.015 ** postInstallments - 1));
  const prePercentage = preInstallments === 0 ? 0 : postInstallments === 0 ? 1 : 1 - preVariable / (preVariable + postVariable);
  const postPercentage = postInstallments === 0 ? 0 : preInstallments === 0 ? 1 : 1 - prePercentage;
  const prePeriodTotal = prePercentage * correctedInstallmentBalance;
  const postPeriodTotal = correctedInstallmentBalance - prePeriodTotal;
  const adjustedPre = prePeriodTotal;
  const adjustedPost = postPeriodTotal * 1.005 ** preInstallments;
  const prePayment = preInstallments > 0 ? -pmt(0.005, preInstallments, adjustedPre) : 0;
  const postPayment = postInstallments > 0 ? -pmt(0.015, postInstallments, adjustedPost) : 0;
  const correctedInstallment = Math.max(prePayment, postPayment, 0);
  if (proSoluto === 0) warnings.push("O pró-soluto ficou zerado após as deduções informadas.");
  if (preInstallments + postInstallments !== installments) errors.push("A divisão entre parcelas pré e pós não fecha a quantidade total.");
  if (Math.abs(prePercentage + postPercentage - Number(installments > 0)) > 0.000001) errors.push("Os percentuais pré e pós não fecham 100%.");
  const audit = [
    { label: "Executor WF-13 e escopo Associativo | Fluxo Linear", ok: true },
    { label: "Empreendimento e produto com match oficial", ok: Boolean(raw.development.trim() && raw.product.trim() && raw.stockMatch) },
    { label: "Política comercial conferida", ok: Boolean(raw.policyConfirmed && policyLimit > 0 && installments <= policyLimit) },
    { label: "Entrada e sinais respeitam a sequência mínima", ok: entry >= 150 && signal1Valid && signal2Valid && signal3Valid },
    { label: "D59 + D60 fecha D61", ok: preInstallments + postInstallments === installments },
    { label: "F59 + F60 fecha 100%", ok: Math.abs(prePercentage + postPercentage - Number(installments > 0)) <= 0.000001 },
    { label: "Períodos pré e pós fecham a base mensal corrigida", ok: Math.abs(prePeriodTotal + postPeriodTotal - correctedInstallmentBalance) <= 0.01 },
    { label: "Parcela final acompanha data 5/10/15", ok: Boolean(firstInstallmentDate && PARAMETERS.paymentDays.includes(firstInstallmentDate.getUTCDate() as 5 | 10 | 15)) },
  ];
  return { ok: errors.length === 0, errors, warnings, firstInstallmentDate: iso(firstInstallmentDate), graceMonths, validInitialTotal, annualSchedule, annualCorrectedTotal, proSoluto, correctedInstallmentBalance, installments, preInstallments, postInstallments, preVariable, postVariable, prePercentage, postPercentage, prePeriodTotal, postPeriodTotal, adjustedPre, adjustedPost, prePayment, postPayment, correctedInstallment, installmentOverSale: realSaleValue > 0 ? correctedInstallment / realSaleValue : 0, proSolutoOverSale: realSaleValue > 0 ? proSoluto / realSaleValue : 0, audit };
}
