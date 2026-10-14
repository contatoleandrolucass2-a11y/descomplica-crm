// Sources and scope are versioned together. Never extend dates without checking the publications.
export const SP_DOCUMENTATION_POLICY = Object.freeze({
  version: "sp-capital-2026.1",
  verifiedAt: "2026-10-10",
  itbiFrom: "2026-01-01",
  registrationFrom: "2026-01-08",
  validThrough: "2026-12-31",
  exemptionLimit: 245527.77,
  reducedFinancingLimit: 120968,
  reducedPropertyLimit: 725808,
  fgtsCombinedLimit: 230520,
  fgtsCombinedFee: 516.81,
  registrationPdfSha256: "3db252fc16b72058f888ee6d0702ebdb4554503c7019b975eb763c3048439835",
  sources: Object.freeze([
    "https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517",
    "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513",
    "https://arisp.com.br/wp-content/uploads/2026/01/2.pdf",
    "https://www.al.sp.gov.br/repositorio/legislacao/lei/2002/lei-11331-26.12.2002.html",
    "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l11977.htm",
    "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
    "https://extrajudicial.tjsp.jus.br/pexPtl/visualizarDetalhesPublicacao.do?cdTipopublicacao=5&nuSeqpublicacao=2462",
    "https://extrajudicial.tjsp.jus.br/pexPtl/visualizarDetalhesPublicacao.do?cdTipopublicacao=5&nuSeqpublicacao=2680",
    "https://www.quinto.com.br/informe-se/tabela-de-custas",
  ]),
});

// ARISP, Tabela II, item 1, ISS 2% sobre o Oficial. Each row starts at an inclusive cent.
export const REGISTRATION_TABLE = Object.freeze(
  [
    [0.01, 260.32],
    [2306.01, 417.73],
    [5761.01, 749.41],
    [9603.01, 1111.9],
    [19210.01, 1351.81],
    [38420.01, 1507.54],
    [115260.01, 1924.16],
    [192100.01, 2339.94],
    [230520.01, 2547.41],
    [268940.01, 2756.07],
    [307360.01, 2905.45],
    [345780.01, 2981.18],
    [384200.01, 3324.04],
    [768400.01, 3892.78],
    [1152600.01, 4481.53],
    [1536800.01, 5070.33],
    [1921000.01, 5374.75],
    [2305200.01, 6896.75],
    [3842000.01, 9636.36],
    [5763000.01, 12680.37],
    [7684000.01, 15724.39],
    [9605000.01, 18768.41],
    [11526000.01, 21812.42],
    [13447000.01, 24856.43],
    [15368000.01, 27900.45],
    [17289000.01, 30944.47],
    [19210000.01, 35510.5],
    [23052000.01, 41598.52],
    [26894000.01, 47686.57],
    [30736000.01, 53774.61],
    [34578000.01, 59862.65],
    [38420000.01, 65950.68],
    [42262000.01, 72038.71],
    [46104000.01, 78126.73],
    [49946000.01, 84214.77],
    [53788000.01, 90302.81],
    [57630000.01, 99434.85],
    [65314000.01, 111610.92],
    [72998000.01, 123787.0],
    [80682000.01, 135963.06],
    [88366000.01, 148139.13],
    [96050000.01, 160315.18],
    [103734000.01, 172491.26],
    [111418000.01, 184667.33],
    [119102000.01, 196843.38],
    [126786000.01, 209019.46],
    [134470000.01, 221195.52],
    [142154000.01, 234080.84],
  ].map((row) => Object.freeze(row)),
);

// Published totals include the office's ISS treatment; do not infer it for other offices.
export const QUINTO_REGISTRATION_TABLE = Object.freeze(
  [
    260.39, 417.83, 749.59, 1112.17, 1352.14, 1507.9, 1924.63, 2340.51, 2548.04, 2756.74, 2906.16,
    2981.91, 3324.85, 3893.73, 4482.62, 5071.57, 5376.06, 6898.44, 9638.72, 12683.48, 15728.24,
    18773.0, 21817.76, 24862.51, 27907.28, 30952.04, 35519.18, 41608.7, 47698.24, 53787.77, 59877.3,
    65966.81, 72056.34, 78145.85, 84235.38, 90324.9, 99459.19, 111638.23, 123817.29, 135996.33,
    148175.38, 160354.41, 172533.47, 184712.51, 196891.55, 209070.61, 221249.65, 234138.12,
  ].map((total, index) => Object.freeze([REGISTRATION_TABLE[index][0], total])),
);

function money(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !value.trim()) return Number.NaN;
  const normalized = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  return /^\d+(?:\.\d{1,2})?$/.test(decimal) ? Number(decimal) : Number.NaN;
}

const cents = (value) => Math.round((value + Number.EPSILON) * 100);
const round = (value) => cents(value) / 100;
const validMoney = (value) =>
  Number.isFinite(value) &&
  value >= 0 &&
  Number.isSafeInteger(cents(value)) &&
  Math.abs(value * 100 - cents(value)) < 0.0001;

export function lookupRegistration(value, table = "ARISP_2") {
  if (!validMoney(value) || value <= 0) return null;
  const rows =
    table === "ARISP_2"
      ? REGISTRATION_TABLE
      : table === "QUINTO_SP_2026"
        ? QUINTO_REGISTRATION_TABLE
        : [];
  return rows.findLast(([start]) => cents(value) >= cents(start))?.[1] ?? null;
}

function validDate(value, minimum) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value >= minimum &&
    value <= SP_DOCUMENTATION_POLICY.validThrough
  );
}

export function calculateSpDocumentationCharges({ salePrice, financing, legalContext }) {
  const p = SP_DOCUMENTATION_POLICY;
  const c = legalContext ?? {};
  const errors = [];
  if (c.municipality !== "sao-paulo-sp")
    errors.push(
      "ITBI e registro disponíveis somente para o município de São Paulo. Confirme a cidade.",
    );
  if (!validDate(c.transactionDate, p.itbiFrom))
    errors.push(
      "ITBI: informe uma data de contrato/transmissão de 2026. Outra vigência precisa de tabela validada.",
    );
  if (!validDate(c.financingContractDate, p.itbiFrom))
    errors.push(
      "ITBI: informe a data do contrato de financiamento em 2026. Contratos de outros anos precisam de parâmetros próprios.",
    );
  if (c.financingContractDate && c.transactionDate && c.financingContractDate > c.transactionDate)
    errors.push("O contrato de financiamento não pode ser posterior à transmissão informada.");
  if (!validDate(c.registrationDate, p.registrationFrom))
    errors.push(
      "Registro: tabela validada de 08/01/2026 a 31/12/2026. Confira a data do registro.",
    );
  if (!["ARISP_2", "QUINTO_SP_2026"].includes(c.registryTable))
    errors.push(
      "Confirme a tabela usada pelo cartório responsável. Outra tabela precisa ser validada antes do cálculo.",
    );
  if (c.specialRegime !== "NONE")
    errors.push(
      "Confira outros benefícios fiscais ou de registro. FMH, COHAB, CDHU, ZEIS e decisões específicas exigem análise antes do cálculo.",
    );
  if (c.transactionDate && c.registrationDate && c.registrationDate < c.transactionDate)
    errors.push("A data do registro não pode ser anterior à compra.");
  for (const [key, label] of [
    ["naturalPerson", "O comprador é pessoa física?"],
    ["residential", "O imóvel é somente residencial?"],
    ["firstAcquisition", "Esta é a primeira aquisição do comprador?"],
  ]) {
    if (!["SIM", "NAO"].includes(c[key])) errors.push(`Confirme: ${label}`);
  }
  if (!["MCMV", "MCMV_FAR_FDS", "NONE"].includes(c.program))
    errors.push("Informe o programa habitacional do contrato.");
  if (!["SFH", "SFI", "PAR", "HIS", "CONSORCIO"].includes(c.financingSystem))
    errors.push("Informe o regime do contrato: SFH, SFI, PAR, HIS ou consórcio.");
  if (!["FGTS", "OTHER"].includes(c.funding))
    errors.push("Informe se o financiamento usa recursos do FGTS.");
  if (c.funding === "FGTS" && !["SIM", "NAO"].includes(c.firstTransfer))
    errors.push("Confirme se esta é a primeira venda da unidade no empreendimento.");
  const itbiBase = money(c.itbiBase);
  const iptuValue = money(c.iptuValue);
  if (!validMoney(itbiBase) || itbiBase <= 0)
    errors.push("Informe a base do ITBI conferida para esta compra, com até duas casas decimais.");
  if (validMoney(itbiBase) && validMoney(salePrice) && itbiBase < salePrice)
    errors.push(
      "A base do ITBI está abaixo do preço de compra. Uma decisão específica precisa de conferência fora desta estimativa.",
    );
  if (!validMoney(iptuValue))
    errors.push("Informe o valor venal do IPTU; use zero somente quando não houver lançamento.");
  if (c.basesConfirmed !== true)
    errors.push("Confirme as bases e as condições do contrato para calcular a documentação.");
  if (
    !validMoney(salePrice) ||
    salePrice <= 0 ||
    !validMoney(financing) ||
    financing <= 0 ||
    financing > salePrice
  )
    errors.push("Confira os valores da compra e do financiamento.");
  const mcmv = ["MCMV", "MCMV_FAR_FDS"].includes(c.program);
  if (mcmv && (c.naturalPerson === "NAO" || c.residential === "NAO" || c.financingSystem === "SFI"))
    errors.push("O enquadramento MCMV informado não é compatível com os dados do contrato.");
  if (c.program === "MCMV_FAR_FDS" && c.funding === "FGTS")
    errors.push("Confira a origem dos recursos: FAR/FDS e FGTS têm enquadramentos diferentes.");
  if (errors.length) return { ok: false, errors };

  const propertyValue = Math.max(salePrice, itbiBase);
  const exempt =
    c.naturalPerson === "SIM" &&
    c.residential === "SIM" &&
    (c.firstAcquisition === "SIM" || mcmv) &&
    cents(propertyValue) <= cents(p.exemptionLimit);
  const reduced =
    ["SFH", "PAR", "HIS", "CONSORCIO"].includes(c.financingSystem) &&
    propertyValue <= p.reducedPropertyLimit;
  const financedBase = reduced ? Math.min(financing, itbiBase, p.reducedFinancingLimit) : 0;
  const itbi = exempt ? 0 : round(financedBase * 0.005 + (itbiBase - financedBase) * 0.03);
  const itbiRule = exempt
    ? "Isenção SP/2026: pessoa física, uso residencial e primeira aquisição ou MCMV, até R$ 245.527,77. Apresente a declaração de isenção."
    : reduced
      ? "SP/2026: 0,5% sobre o financiamento até R$ 120.968,00 e 3% sobre o restante da base do ITBI."
      : "SP/2026: 3% sobre a base do ITBI, sem alíquota reduzida neste enquadramento.";
  const purchaseValue = Math.max(salePrice, iptuValue, itbiBase);
  const purchaseFee = lookupRegistration(purchaseValue, c.registryTable);
  const lienFee = lookupRegistration(financing, c.registryTable);
  const tableLabel =
    c.registryTable === "QUINTO_SP_2026"
      ? "Tabela publicada pelo 5º RI de São Paulo/2026, com o ISS informado pelo cartório"
      : "Tabela ARISP/2026, ISS 2% sobre o Oficial, confirmada com o cartório responsável";
  let purchaseRegistration = purchaseFee;
  let lienRegistration = lienFee;
  const registrationCombined = false;
  let registrationRule = "Tabela II SP/2026, item 1: compra e venda e garantia sem redução.";

  const fgtsOverlap =
    !mcmv &&
    c.funding === "FGTS" &&
    c.residential === "SIM" &&
    c.firstTransfer === "SIM" &&
    purchaseValue <= p.fgtsCombinedLimit;
  if (fgtsOverlap)
    return {
      ok: false,
      errors: [
        "Registro: financiamento FGTS fora do MCMV, na primeira venda até R$ 230.520,00. Confirme com o cartório a aplicação do item 14.4 ou do art. 43-B antes de calcular; não acumulamos nem escolhemos automaticamente o menor valor.",
      ],
    };
  if (c.residential === "SIM" && (mcmv || c.funding === "FGTS")) {
    const factor = c.program === "MCMV_FAR_FDS" ? 0.25 : 0.5;
    purchaseRegistration = round(purchaseFee * factor);
    lienRegistration = round(lienFee * factor);
    registrationRule = `Lei 11.977, arts. 43 e 43-B: redução de ${factor === 0.25 ? "75% (FAR/FDS)" : "50% (MCMV/FGTS)"} nos dois registros. Benefícios não acumulados.`;
  } else if (
    c.firstAcquisition === "SIM" &&
    c.residential === "SIM" &&
    c.financingSystem === "SFH"
  ) {
    if (cents(purchaseValue) !== cents(salePrice))
      return {
        ok: false,
        errors: [
          "Registro SFH: a base fiscal supera o preço de compra. O cartório precisa confirmar a proporção financiada do desconto antes de calcular.",
        ],
      };
    // The SFH reduction on the purchase applies only to its financed proportion.
    purchaseRegistration = round(purchaseFee * (1 - (0.5 * financing) / salePrice));
    lienRegistration = round(lienFee * 0.5);
    registrationRule =
      "Primeira aquisição residencial SFH: redução de 50% na proporção financiada da compra e de 50% na garantia (art. 290 e nota 1.8.1). Proporção = financiamento / preço; estimativa arredondada ao centavo no fim de cada ato. Confirme o critério de arredondamento do cartório.";
  }
  return {
    ok: true,
    itbi,
    itbiRule,
    purchaseRegistration,
    lienRegistration,
    totalRegistration: round(purchaseRegistration + lienRegistration),
    registrationCombined,
    registrationRule: `${tableLabel}. ${registrationRule}`,
    legalPolicyVersion: p.version,
    legalSources: [...p.sources],
    legalWarnings: [
      "Estimativa para compra e garantia em São Paulo, com condições declaradas. Não substitui a guia da Prefeitura ou o orçamento do cartório.",
      "Certidões, averbações e outros atos não estão incluídos. Benefícios especiais (COHAB, CDHU, ZEIS e regularização fundiária) exigem conferência do cartório.",
      "ITBI: parâmetros de 2026. Registro: tabela escolhida de 08/01/2026 a 31/12/2026. O ISS pode mudar o total entre cartórios; não aplique uma tabela sem confirmação. Fontes conferidas em 10/10/2026.",
    ],
  };
}
