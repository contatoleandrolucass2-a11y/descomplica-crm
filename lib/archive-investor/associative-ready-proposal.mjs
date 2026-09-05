const PROPOSAL_QUOTAS = Object.freeze({
  MCMV: 0.8,
  SBPE: 0.9,
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundUpMoney(value) {
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

function roundDownMoney(value) {
  const roundedToEightDecimals = Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;
  return Math.floor((roundedToEightDecimals + Number.EPSILON) * 100) / 100;
}

function normalizePayments(payments = []) {
  return payments
    .map((payment, index) => ({
      label: payment?.label || `Pagamento ${index + 1}`,
      date: payment?.date || "",
      value: finiteNumber(payment?.value),
    }))
    .filter((payment) => payment.value !== null && payment.value > 0)
    .map((payment) => ({ ...payment, value: roundMoney(payment.value) }));
}

function sumPayments(payments) {
  return roundMoney(payments.reduce((total, payment) => total + payment.value, 0));
}

/**
 * Replica a memória de cálculo da planilha Pasta1_revisada.xlsx.
 * Subsídio e listas dinâmicas de sinais/anuais são extensões do fluxo real do CRM.
 */
export function buildAssociativeReadyProposal(input = {}) {
  const modality = String(input.modality || "").toUpperCase();
  const quota = PROPOSAL_QUOTAS[modality];
  const grossSaleValue = finiteNumber(input.grossSaleValue);
  const netSaleValue = finiteNumber(input.netSaleValue);
  const appraisal = finiteNumber(input.appraisal);
  const requestedFinancing = finiteNumber(input.requestedFinancing);
  const originalUnitBonus = finiteNumber(input.originalUnitBonus) ?? 0;
  const tableSlack = finiteNumber(input.tableSlack) ?? 0;
  const sourceDiscount = finiteNumber(input.sourceDiscount) ?? 0;
  const subsidy = finiteNumber(input.subsidy) ?? 0;
  const fgts = finiteNumber(input.fgts) ?? 0;
  const housingCheck = finiteNumber(input.housingCheck) ?? 0;
  const entry = finiteNumber(input.entry) ?? 0;
  const installments = finiteNumber(input.installments);
  const signals = normalizePayments(input.signals);
  const annuals = normalizePayments(input.annuals);
  const errors = [];

  if (grossSaleValue === null || grossSaleValue <= 0) errors.push("Valor final com kit inválido.");
  if (netSaleValue === null || netSaleValue <= 0) errors.push("Valor real da venda inválido.");
  if (appraisal === null || appraisal <= 0)
    errors.push("Informe a avaliação bancária para calcular a proposta.");
  if (requestedFinancing === null || requestedFinancing < 0)
    errors.push("Financiamento solicitado inválido.");
  if (!quota) errors.push("Modalidade de financiamento inválida.");
  if (installments === null || !Number.isInteger(installments) || installments <= 0)
    errors.push("Quantidade de parcelas inválida.");

  const nonNegativeValues = [
    originalUnitBonus,
    tableSlack,
    sourceDiscount,
    subsidy,
    fgts,
    housingCheck,
    entry,
  ];
  if (nonNegativeValues.some((value) => value < 0))
    errors.push("A proposta contém um valor negativo não permitido.");

  const source = {
    grossSaleValue: roundMoney(Math.max(0, grossSaleValue ?? 0)),
    originalUnitBonus: roundMoney(originalUnitBonus),
    tableSlack: roundMoney(tableSlack),
    sourceDiscount: roundMoney(sourceDiscount),
    netSaleValue: roundMoney(Math.max(0, netSaleValue ?? 0)),
    requestedFinancing: roundMoney(Math.max(0, requestedFinancing ?? 0)),
    appraisal: roundMoney(Math.max(0, appraisal ?? 0)),
    subsidy: roundMoney(subsidy),
    fgts: roundMoney(fgts),
    housingCheck: roundMoney(housingCheck),
    entry: roundMoney(entry),
    signals,
    annuals,
    installments: Number.isInteger(installments) ? installments : 0,
  };

  if (errors.length > 0) {
    return {
      ok: false,
      status: "blocked",
      errors,
      warnings: [],
      modality,
      quota: quota ?? 0,
      source,
      proposal: null,
    };
  }

  const contractMinimum = roundUpMoney(source.requestedFinancing / quota);
  const appraisalLimit = roundDownMoney(source.appraisal * quota);
  const contractValue = roundMoney(
    Math.max(
      source.netSaleValue,
      Math.min(contractMinimum, source.appraisal, source.grossSaleValue),
    ),
  );
  const financingCapacity = roundDownMoney(Math.min(source.appraisal, contractValue) * quota);
  const financing = roundMoney(Math.min(source.requestedFinancing, financingCapacity));
  const proposalUnitBonus = roundMoney(Math.max(0, contractValue - source.netSaleValue));
  const proposalDiscount = roundMoney(Math.max(0, source.grossSaleValue - contractValue));
  const signalTotal = sumPayments(signals);
  const annualTotal = sumPayments(annuals);
  const resourceTotal = roundMoney(financing + source.subsidy + source.fgts + source.housingCheck);
  const balanceAfterResources = roundMoney(source.netSaleValue - resourceTotal);
  const monthlyBalance = roundMoney(
    balanceAfterResources - source.entry - signalTotal - annualTotal,
  );
  const averageInstallment = roundMoney(monthlyBalance / source.installments);
  const creditShortfall = roundMoney(Math.max(0, source.requestedFinancing - financing));
  const reconciliationDifference = roundMoney(
    contractValue -
      proposalUnitBonus -
      financing -
      source.subsidy -
      source.fgts -
      source.housingCheck -
      source.entry -
      signalTotal -
      annualTotal -
      monthlyBalance,
  );
  const warnings = [];

  if (creditShortfall > 0)
    warnings.push("O financiamento solicitado supera a capacidade desta proposta.");
  if (monthlyBalance < 0) warnings.push("Os recursos informados superam o valor real da venda.");
  if (Math.abs(reconciliationDifference) > 0.01)
    warnings.push("A conciliação da proposta precisa ser revisada.");

  return {
    ok: true,
    status: warnings.length > 0 ? "review" : "ready",
    errors,
    warnings,
    modality,
    quota,
    source,
    proposal: {
      contractMinimum,
      appraisalLimit,
      contractValue,
      financingCapacity,
      financing,
      proposalUnitBonus,
      proposalDiscount,
      signalTotal,
      annualTotal,
      resourceTotal,
      balanceAfterResources,
      monthlyBalance,
      averageInstallment,
      creditShortfall,
      reconciliationDifference,
    },
  };
}

export { PROPOSAL_QUOTAS as ASSOCIATIVE_READY_PROPOSAL_QUOTAS };
