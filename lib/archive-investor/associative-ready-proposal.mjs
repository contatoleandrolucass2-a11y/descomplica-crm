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

function numberedPaymentValue(payments, label, index) {
  const expectedLabel = `${label} ${index}`.toLocaleLowerCase("pt-BR");
  return (
    payments.find(
      (payment) => String(payment.label).trim().toLocaleLowerCase("pt-BR") === expectedLabel,
    )?.value ?? 0
  );
}

function extraNumberedPayments(payments, label, after) {
  const pattern = new RegExp(`^${label}\\s+(\\d+)$`, "iu");
  return payments
    .map((payment) => ({
      payment,
      index: Number(String(payment.label).trim().match(pattern)?.[1]),
    }))
    .filter(({ index, payment }) => Number.isInteger(index) && index > after && payment.value > 0)
    .sort((left, right) => left.index - right.index);
}

/**
 * Monta a resposta comercial no mesmo grão e ordem da planilha revisada.
 * Linhas opcionais permanecem visíveis mesmo quando zeradas; valores extras ativos nunca são omitidos.
 */
export function buildAssociativeReadyProposalResponseRows(calculation = {}) {
  const proposal = calculation.proposal;
  const source = calculation.source;
  if (!proposal || !source) return [];

  const row = (key, label, operator, value, options = {}) => ({
    key,
    label,
    operator,
    value,
    currency: true,
    emptyWhenZero: false,
    ...options,
  });
  const signalRows = [1, 2, 3].map((index) =>
    row(
      `signal-${index}`,
      `Sinal ${index}`,
      "−",
      numberedPaymentValue(source.signals, "Sinal", index),
      {
        emptyWhenZero: true,
        help: `Pagamento opcional do Sinal ${index} informado no fluxo.`,
      },
    ),
  );
  const extraSignalRows = extraNumberedPayments(source.signals, "Sinal", 3).map(
    ({ payment, index }) =>
      row(`signal-${index}`, `Sinal ${index}`, "−", payment.value, {
        emptyWhenZero: true,
        help: `Pagamento adicional do Sinal ${index} informado no fluxo.`,
      }),
  );
  const annualRows = [1, 2, 3, 4].map((index) =>
    row(
      `annual-${index}`,
      `Anual ${index}`,
      "−",
      numberedPaymentValue(source.annuals, "Anual", index),
      {
        emptyWhenZero: true,
        help: `Pagamento opcional da Anual ${index} informado no fluxo.`,
      },
    ),
  );
  const extraAnnualRows = extraNumberedPayments(source.annuals, "Anual", 4).map(
    ({ payment, index }) =>
      row(`annual-${index}`, `Anual ${index}`, "−", payment.value, {
        emptyWhenZero: true,
        help: `Pagamento adicional da Anual ${index} informado no fluxo.`,
      }),
  );

  return [
    row("discount", "Desconto", "−", proposal.proposalDiscount, {
      featured: true,
      separated: true,
      help: "Diferença entre o valor final com kit e o valor de contrato.",
    }),
    row("contract", "Valor de Contrato", "=", proposal.contractValue, {
      total: true,
      help: "Valor calculado para formalização da proposta.",
    }),
    row("unit-bonus", "B.A. da Unidade", "+", proposal.proposalUnitBonus, {
      help: "Diferença entre o valor de contrato e o valor real da venda.",
    }),
    row("financing", "Financiamento", "−", proposal.financing, {
      help: "Crédito bancário considerado na proposta.",
    }),
    ...(source.subsidy > 0
      ? [
          row("subsidy", "Subsídio", "−", source.subsidy, {
            help: "Subsídio informado no fluxo e considerado na conciliação.",
          }),
        ]
      : []),
    row("fgts", "FGTS", "−", source.fgts, {
      emptyWhenZero: true,
      help: "Recurso de FGTS informado no fluxo.",
    }),
    row("housing-check", "Cheque Moradia", "−", source.housingCheck, {
      emptyWhenZero: true,
      help: "Cheque Moradia informado no fluxo.",
    }),
    row("signal-cc", "Sinal CC", "−", source.entry, {
      emptyWhenZero: true,
      help: "Entrada na assinatura do contrato informada no fluxo.",
    }),
    ...signalRows,
    ...extraSignalRows,
    ...annualRows,
    ...extraAnnualRows,
    row("installments", "Qtd. de parcelas", "÷", source.installments, {
      currency: false,
      total: true,
      help: "Quantidade de parcelas mensais definida na proposta.",
    }),
  ];
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
