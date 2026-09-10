import { ASSOCIATIVE_COMMISSION_RATES } from "./associative-commercial-remuneration-rules.mjs";

const PROPOSAL_QUOTAS = Object.freeze({
  MCMV: 0.8,
  SBPE: 0.9,
});

const SEPARATED_COMMISSION_RANKINGS = Object.freeze({
  gold: Object.freeze({ label: "Ouro", rate: ASSOCIATIVE_COMMISSION_RATES.Imobiliária.Ouro }),
  silver: Object.freeze({ label: "Prata", rate: ASSOCIATIVE_COMMISSION_RATES.Imobiliária.Prata }),
  bronze: Object.freeze({ label: "Bronze", rate: ASSOCIATIVE_COMMISSION_RATES.Imobiliária.Bronze }),
});

const SEPARATED_COMMISSION_AWARD_RATE = 0.4;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMoney(value) {
  const roundedToEightDecimals = Number(Number(value).toFixed(8));
  const scaled = roundedToEightDecimals * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return (Math.sign(scaled) * Math.round(Math.abs(scaled) + tolerance)) / 100;
}

function roundUpMoney(value) {
  const roundedToEightDecimals = Number(Number(value).toFixed(8));
  const scaled = roundedToEightDecimals * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return (scaled < 0 ? Math.floor(scaled + tolerance) : Math.ceil(scaled - tolerance)) / 100;
}

function roundDownMoney(value) {
  const roundedToEightDecimals = Number(Number(value).toFixed(8));
  const scaled = roundedToEightDecimals * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return (scaled < 0 ? Math.ceil(scaled - tolerance) : Math.floor(scaled + tolerance)) / 100;
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

export function findAssociativeSeparatedCommissionRankingId(channel, classification) {
  if (String(channel).trim() !== "Imobiliária") return "";
  const normalizedClassification = String(classification).trim().toLocaleLowerCase("pt-BR");
  return (
    Object.entries(SEPARATED_COMMISSION_RANKINGS).find(
      ([, ranking]) => ranking.label.toLocaleLowerCase("pt-BR") === normalizedClassification,
    )?.[0] ?? ""
  );
}

/**
 * Monta a resposta comercial no mesmo grão e ordem da planilha revisada.
 * A resposta final exibe somente valores positivos; pagamentos extras ativos nunca são omitidos.
 */
export function buildAssociativeReadyProposalResponseRows(calculation = {}) {
  const proposal = calculation.proposal;
  const source = calculation.source;
  if (!proposal || !source) return [];

  const separatedCommission = calculation.separatedCommission;
  const separatedProposal = separatedCommission?.eligible ? separatedCommission.proposal : null;

  const row = (key, label, operator, value, options = {}) => {
    const responseRow = {
      key,
      label,
      operator,
      value,
      separatedCommissionValue: separatedProposal ? value : null,
      currency: true,
      ...options,
    };
    return {
      ...responseRow,
      value: responseRow.value > 0 ? responseRow.value : null,
      separatedCommissionValue:
        responseRow.separatedCommissionValue > 0 ? responseRow.separatedCommissionValue : null,
    };
  };
  const signalRows = [1, 2, 3].map((index) =>
    row(
      `signal-${index}`,
      `Sinal ${index}`,
      "−",
      numberedPaymentValue(source.signals, "Sinal", index),
      {
        help: `Pagamento opcional do Sinal ${index} informado no fluxo.`,
      },
    ),
  );
  const extraSignalRows = extraNumberedPayments(source.signals, "Sinal", 3).map(
    ({ payment, index }) =>
      row(`signal-${index}`, `Sinal ${index}`, "−", payment.value, {
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
        help: `Pagamento opcional da Anual ${index} informado no fluxo.`,
      },
    ),
  );
  const extraAnnualRows = extraNumberedPayments(source.annuals, "Anual", 4).map(
    ({ payment, index }) =>
      row(`annual-${index}`, `Anual ${index}`, "−", payment.value, {
        help: `Pagamento adicional da Anual ${index} informado no fluxo.`,
      }),
  );

  return [
    row("discount", "Desconto", "−", proposal.proposalDiscount, {
      separatedCommissionValue: separatedProposal?.proposalDiscount ?? null,
      featured: true,
      separated: true,
      help: "Na faturada, é o valor final com kit menos o contrato. Na apartada, também desconta a comissão e o prêmio.",
    }),
    row("contract", "Valor de Contrato", "=", proposal.contractValue, {
      separatedCommissionValue: separatedProposal?.contractValue ?? null,
      total: true,
      help: "Valor calculado para formalização da proposta.",
    }),
    row("unit-bonus", "B.A. da Unidade", "+", proposal.proposalUnitBonus, {
      separatedCommissionValue: separatedProposal?.proposalUnitBonus ?? null,
      help: "Na faturada, é contrato menos valor real. Na apartada, é contrato menos valor real já líquido da comissão e do prêmio.",
    }),
    row("financing", "Financiamento", "−", proposal.financing, {
      separatedCommissionValue: separatedProposal?.financing ?? null,
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
      help: "Recurso de FGTS informado no fluxo.",
    }),
    row("housing-check", "Cheque Moradia", "−", source.housingCheck, {
      help: "Cheque Moradia informado no fluxo.",
    }),
    row("signal-cc", "Sinal CC", "−", source.entry, {
      help: "Entrada na assinatura do contrato informada no fluxo.",
    }),
    ...(separatedProposal && separatedCommission.totalRemuneration > 0
      ? [
          row("signal-commission", "Sinal COM / prêmio", "−", null, {
            separatedCommissionValue: separatedCommission.totalRemuneration,
            help: "Comissão e prêmio calculados no modelo de comissão apartada.",
          }),
        ]
      : []),
    ...signalRows,
    ...extraSignalRows,
    ...annualRows,
    ...extraAnnualRows,
    row("installments", "Qtd. de parcelas", "÷", source.installments, {
      currency: false,
      total: true,
      help: "Quantidade de parcelas mensais definida na proposta.",
    }),
  ].filter(
    (responseRow) =>
      (responseRow.value !== null && responseRow.value > 0) ||
      (responseRow.separatedCommissionValue !== null && responseRow.separatedCommissionValue > 0),
  );
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
  const cashBackSlack = finiteNumber(input.cashBackSlack) ?? 0;
  const commissionRanking = SEPARATED_COMMISSION_RANKINGS[input.commissionRankingId] ?? null;
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
    cashBackSlack,
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
    cashBackSlack: roundMoney(cashBackSlack),
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
      separatedCommission: null,
    };
  }

  const appraisalLimit = roundDownMoney(source.appraisal * quota);
  const financingTableLimit = roundDownMoney(source.grossSaleValue * quota);
  const financingCapacity = roundDownMoney(Math.min(appraisalLimit, financingTableLimit));
  const financing = roundMoney(Math.min(source.requestedFinancing, financingCapacity));
  const contractMinimum = roundUpMoney(financing / quota);
  const contractValue = roundMoney(
    Math.max(
      source.netSaleValue,
      Math.min(contractMinimum, source.appraisal, source.grossSaleValue),
    ),
  );
  const proposalUnitBonus = roundMoney(Math.max(0, contractValue - source.netSaleValue));
  const proposalDiscount = roundMoney(Math.max(0, source.grossSaleValue - contractValue));
  const signalTotal = sumPayments(signals);
  const annualTotal = sumPayments(annuals);
  const resourceTotal = roundMoney(financing + source.subsidy + source.fgts + source.housingCheck);
  const balanceAfterResources = roundMoney(source.netSaleValue - resourceTotal);
  const monthlyBalance = roundMoney(
    balanceAfterResources - source.entry - signalTotal - annualTotal,
  );
  const averageInstallment = roundDownMoney(monthlyBalance / source.installments);
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

  const commissionBase = source.netSaleValue;
  const commissionValue = commissionRanking
    ? roundMoney(commissionBase * commissionRanking.rate)
    : 0;
  const commissionEntryThreshold = commissionValue;
  const awardBase = roundMoney(Math.max(0, source.cashBackSlack - source.sourceDiscount));
  const awardValue = commissionRanking
    ? roundMoney(awardBase * SEPARATED_COMMISSION_AWARD_RATE)
    : 0;
  const totalRemuneration = roundMoney(commissionValue + awardValue);
  const separatedNetSaleValue = roundMoney(Math.max(0, source.netSaleValue - totalRemuneration));
  const separatedContractMaximum = roundMoney(
    Math.max(0, source.grossSaleValue - totalRemuneration),
  );
  const separatedFinancingTableLimit = roundDownMoney(separatedContractMaximum * quota);
  const separatedFinancingCapacity = roundDownMoney(
    Math.min(appraisalLimit, separatedFinancingTableLimit),
  );
  const separatedFinancing = roundMoney(
    Math.min(source.requestedFinancing, separatedFinancingCapacity),
  );
  const separatedContractMinimum = roundUpMoney(separatedFinancing / quota);
  const separatedContractValue = roundMoney(
    Math.max(
      separatedNetSaleValue,
      Math.min(separatedContractMinimum, source.appraisal, separatedContractMaximum),
    ),
  );
  const separatedProposalUnitBonus = roundMoney(
    Math.max(0, separatedContractValue - separatedNetSaleValue),
  );
  const separatedProposalDiscount = roundMoney(
    Math.max(0, source.grossSaleValue - totalRemuneration - separatedContractValue),
  );
  const separatedResourceTotal = roundMoney(
    separatedFinancing + source.subsidy + source.fgts + source.housingCheck,
  );
  const separatedBalanceAfterResources = roundMoney(separatedNetSaleValue - separatedResourceTotal);
  const separatedMonthlyBalance = roundMoney(
    separatedBalanceAfterResources - source.entry - signalTotal - annualTotal,
  );
  const separatedAverageInstallment = roundDownMoney(separatedMonthlyBalance / source.installments);
  const separatedCreditShortfall = roundMoney(
    Math.max(0, source.requestedFinancing - separatedFinancing),
  );
  const separatedReconciliationDifference = roundMoney(
    separatedContractValue -
      separatedProposalUnitBonus -
      separatedFinancing -
      source.subsidy -
      source.fgts -
      source.housingCheck -
      source.entry -
      signalTotal -
      annualTotal -
      separatedMonthlyBalance,
  );
  const separatedCommissionEligible = Boolean(
    commissionRanking && source.entry >= commissionEntryThreshold,
  );
  if (separatedCommissionEligible && separatedCreditShortfall > 0)
    warnings.push("O financiamento solicitado supera a capacidade da comissão apartada.");
  if (separatedCommissionEligible && separatedMonthlyBalance < 0)
    warnings.push("Os recursos informados superam o saldo da comissão apartada.");
  if (separatedCommissionEligible && Math.abs(separatedReconciliationDifference) > 0.01)
    warnings.push("A conciliação da comissão apartada precisa ser revisada.");

  return {
    ok: true,
    status: warnings.length > 0 ? "review" : "ready",
    errors,
    warnings,
    modality,
    quota,
    source,
    separatedCommission: {
      eligible: separatedCommissionEligible,
      entryThreshold: commissionEntryThreshold,
      entryRate: commissionRanking?.rate ?? 0,
      ranking: commissionRanking,
      commissionBase,
      commissionValue,
      awardBase,
      awardRate: commissionRanking ? SEPARATED_COMMISSION_AWARD_RATE : 0,
      awardValue,
      totalRemuneration,
      proposal: {
        contractMinimum: separatedContractMinimum,
        appraisalLimit,
        contractMaximum: separatedContractMaximum,
        financingTableLimit: separatedFinancingTableLimit,
        contractValue: separatedContractValue,
        financingCapacity: separatedFinancingCapacity,
        financing: separatedFinancing,
        proposalUnitBonus: separatedProposalUnitBonus,
        proposalDiscount: separatedProposalDiscount,
        signalTotal,
        annualTotal,
        resourceTotal: separatedResourceTotal,
        balanceAfterResources: separatedBalanceAfterResources,
        monthlyBalance: separatedMonthlyBalance,
        averageInstallment: separatedAverageInstallment,
        creditShortfall: separatedCreditShortfall,
        reconciliationDifference: separatedReconciliationDifference,
      },
    },
    proposal: {
      contractMinimum,
      appraisalLimit,
      financingTableLimit,
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

export {
  PROPOSAL_QUOTAS as ASSOCIATIVE_READY_PROPOSAL_QUOTAS,
  SEPARATED_COMMISSION_RANKINGS as ASSOCIATIVE_SEPARATED_COMMISSION_RANKINGS,
};
