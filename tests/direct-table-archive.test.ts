import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "vitest";

// @ts-expect-error — módulo de regras preservado do artefato anexado em JavaScript.
import * as directTableRules from "../lib/archive-investor/direct-table-file-rules.mjs";
// @ts-expect-error — módulo legado JavaScript exercitado pela fixture visual compartilhada.
import * as associativeReadyProposalRules from "../lib/archive-investor/associative-ready-proposal.mjs";
// @ts-expect-error — fixture JavaScript usada somente pela QA visual isolada.
import * as directTableQaFixture from "../scripts/qa/direct-table-snapshot-fixture.mjs";

type ProposalOptionId =
  | "without-signal-without-intermediary"
  | "with-signal-without-intermediary"
  | "without-signal-with-intermediary"
  | "with-signal-with-intermediary";

type DirectInput = {
  selectedUnitId: string;
  developmentName: string;
  businessUnit: string;
  product: string;
  plant: string | null | undefined;
  description: string | null | undefined;
  baseDate: string;
  completionDate: string;
  salePrice: number;
  discountAuthorized: boolean;
  discount: number;
  entryValue: number;
  income: number;
  signals: number[];
  intermediaries: number[];
};

type PaymentSignal = {
  value: number;
  date: string;
  active: boolean;
  approved: boolean;
  reason: string;
};

type Intermediary = {
  value: number;
  approved: boolean;
  reason: string;
};

type DirectResult = {
  ok: boolean;
  status: string;
  proposalReady: boolean;
  audit: Array<{ id: string; label: string; ok: boolean }>;
  standardScenarios: Array<{
    code: string;
    entry: number;
    signals: Array<{ value: number }>;
    balance: number;
    postKeysBalance: number;
    postKeysInstallments: number;
  }>;
  context: {
    valueReal: number;
    intermediaryInputLimit: number;
    parkingPolicy: boolean;
    preKeysRate: number;
    postKeysRate: number;
  };
  custom: {
    signals: PaymentSignal[];
    signalTotal: number;
    totalEntryValue: number;
    minimumActValue: number;
    minimumEntryValue: number;
    maximumEntryValue: number;
    entryExcess: number;
    basePreKeysBudget: number;
    preKeysBudget: number;
    validIntermediaryTotal: number;
    validIntermediaryCount: number;
    intermediaries: Intermediary[];
    entryValue: number;
    balance: number;
    desiredInstallments: number;
    installmentValue: number;
    lastInstallmentValue: number;
    postKeysBalance: number;
    postKeysInstallments: number;
    postKeysPayment: number;
    firstPostKeysDate: string;
    creditApproved: boolean;
    status: string;
  };
};

type ProposalPreset = {
  entryValue: number;
  signals: number[];
  intermediaries: number[];
  signalFieldCount: number;
  intermediaryFieldCount: number;
  intermediaryDates: string[];
};

const buildDirectTableProposalPreset = directTableRules.buildDirectTableProposalPreset as (
  optionId: ProposalOptionId,
  value: number,
  dates?: { baseDate?: string; completionDate?: string; plant?: string | null },
) => ProposalPreset;
const calculateDirectTableFileFlow = directTableRules.calculateDirectTableFileFlow as (
  input: DirectInput,
) => DirectResult;
const buildDirectTablePreKeysSchedule = directTableRules.buildDirectTablePreKeysSchedule as (
  principal: number,
  installmentCount: number,
  firstPaymentDate: string,
) => Array<{ month: number; payment: number; paymentDate: string; balance: number }>;
const buildDirectTableAmortizationSchedule =
  directTableRules.buildDirectTableAmortizationSchedule as (
    principal: number,
    firstPaymentDate: string,
    installmentCount?: number,
  ) => Array<{
    month: number;
    amortization: number;
    interest: number;
    mip: number;
    dfi: number;
    totalPayment: number;
    balance: number;
  }>;
const DIRECT_TABLE_PROPOSAL_OPTIONS =
  directTableRules.DIRECT_TABLE_PROPOSAL_OPTIONS as ReadonlyArray<{
    id: ProposalOptionId;
    label: string;
  }>;
const privateSnapshotUrl = new URL("../private-data/investor-inventory.json", import.meta.url);
const itWithPrivateSnapshot = existsSync(privateSnapshotUrl) ? it : it.skip;

const base: DirectInput = {
  selectedUnitId: "stock-2",
  developmentName: "Conquista Clube Itaim Paulista",
  businessUnit: "Direcional",
  product: "Apartamento BL04-0905",
  plant: "TIPO 2Q",
  description: "HIS-2",
  baseDate: "2025-05-05",
  completionDate: "2028-12-31",
  salePrice: 400_000,
  discountAuthorized: false,
  discount: 0,
  entryValue: 40_000,
  income: 15_000,
  signals: [0, 0, 0],
  intermediaries: [0, 0, 0, 0, 0, 0, 0, 0],
};

describe("Tabela Direta integral do arquivo anexado", () => {
  it("publica a composição completa na rota protegida e no item correto do menu", () => {
    const page = readFileSync(
      new URL("../app/(protected)/app/simulacao/[simulator]/page.tsx", import.meta.url),
      "utf8",
    );
    const archive = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/DirectTableArchive.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const menu = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/SiteMenu.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const calculator = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(page, /simulator === ["']tabela-direta["']/);
    assert.ok(page.includes("<DirectTableArchive />"));
    assert.ok(archive.includes("investor-direct-table-page"));
    assert.match(archive, /<InvestorCalculator\s+directTable/);
    assert.ok(archive.includes("Simulador Tabela Direta"));
    assert.ok(menu.includes('href="/app/simulacao/tabela-direta"'));
    assert.ok(!menu.includes('href="/simulacao/tabela-investidor?ficha=2"'));
    assert.ok(calculator.includes("DIRECT_TABLE_PROPOSAL_OPTIONS"));
    assert.ok(calculator.includes("DIRECT_TABLE_PROPOSAL_GUIDE_STEPS"));
    assert.ok(calculator.includes("DIRECT_PERSON_DOCUMENTATION"));
    assert.ok(calculator.includes("buildDirectTableAmortizationSchedule"));
  });

  itWithPrivateSnapshot("valida o snapshot SPC integral, sem substituir dados por mock", () => {
    const payload = JSON.parse(readFileSync(privateSnapshotUrl, "utf8")) as {
      count: number;
      items: Array<{
        id: string;
        finalPrice: number | null;
        completionDate: string | null;
      }>;
    };

    assert.equal(payload.count, payload.items.length);
    assert.equal(payload.items.length, 3_301);
    assert.equal(new Set(payload.items.map((item) => item.id)).size, 3_301);
    assert.equal(
      payload.items.filter(
        (item) => !Number.isFinite(item.finalPrice) || Number(item.finalPrice) <= 0,
      ).length,
      314,
    );
    assert.equal(payload.items.filter((item) => !item.completionDate).length, 0);
    assert.equal(
      payload.items.filter(
        (item) => Number(item.finalPrice) > 0 && item.completionDate! <= "2026-09-05",
      ).length,
      60,
    );
  });

  it("gera estoque visual sintético determinístico sem versionar dados comerciais", () => {
    const first = directTableQaFixture.buildSyntheticDirectTableQaSnapshot();
    const second = directTableQaFixture.buildSyntheticDirectTableQaSnapshot();
    const payload = JSON.parse(first) as {
      source: string;
      qaFixture: { synthetic: boolean; contract: string };
      count: number;
      items: Array<{
        id: string;
        businessUnit: string;
        project: string;
        finalPrice: number;
        finalWithKit: number;
        unitBonus: number;
        tableSlack: number;
        appraisal: number;
        completionDate: string;
        plant: string;
      }>;
    };

    assert.equal(first, second);
    assert.equal(payload.source, "ESTOQUE SPC.xlsx");
    assert.deepEqual(payload.qaFixture, {
      synthetic: true,
      contract: "direct-table-visual-v1",
    });
    assert.equal(payload.count, directTableQaFixture.directTableQaInventoryCount);
    assert.equal(payload.items.length, 3_301);
    assert.equal(new Set(payload.items.map((item) => item.id)).size, 3_301);
    assert.deepEqual(
      new Set(payload.items.map((item) => item.businessUnit)),
      new Set(["Direcional", "Riva"]),
    );
    assert.ok(payload.items.every((item) => item.id.startsWith("qa-stock-")));
    assert.ok(payload.items.every((item) => item.project.startsWith("Empreendimento QA ")));
    assert.equal(new Set(payload.items.map((item) => item.finalPrice)).size, 121);

    const selectedUnit = payload.items[0]!;
    assert.equal(selectedUnit.project, "Empreendimento QA 01");
    assert.deepEqual(
      {
        finalPrice: selectedUnit.finalPrice,
        finalWithKit: selectedUnit.finalWithKit,
        unitBonus: selectedUnit.unitBonus,
        tableSlack: selectedUnit.tableSlack,
        appraisal: selectedUnit.appraisal,
      },
      {
        finalPrice: 230_000,
        finalWithKit: 340_000,
        unitBonus: 95_000,
        tableSlack: 15_000,
        appraisal: 350_000,
      },
    );
    const readyProposal = associativeReadyProposalRules.buildAssociativeReadyProposal({
      grossSaleValue: selectedUnit.finalWithKit,
      originalUnitBonus: selectedUnit.unitBonus,
      tableSlack: selectedUnit.tableSlack,
      sourceDiscount: 0,
      netSaleValue: selectedUnit.finalPrice,
      requestedFinancing: 190_000,
      subsidy: 0,
      fgts: 0,
      housingCheck: 0,
      entry: 1_000,
      signals: [],
      annuals: [],
      installments: 84,
      appraisal: selectedUnit.appraisal,
      modality: "MCMV",
    });
    assert.equal(readyProposal.status, "ready");
    assert.deepEqual(
      associativeReadyProposalRules
        .buildAssociativeReadyProposalResponseRows(readyProposal)
        .map((row: { label: string }) => row.label),
      [
        "Desconto",
        "Valor de Contrato",
        "B.A. da Unidade",
        "Financiamento",
        "Sinal CC",
        "Qtd. de parcelas",
      ],
    );
    const option = DIRECT_TABLE_PROPOSAL_OPTIONS.at(-1)!;
    const preset = buildDirectTableProposalPreset(option.id, selectedUnit.finalPrice, {
      baseDate: "2026-09-06",
      completionDate: selectedUnit.completionDate,
      plant: selectedUnit.plant,
    });
    const result = calculateDirectTableFileFlow({
      selectedUnitId: selectedUnit.id,
      developmentName: selectedUnit.project,
      businessUnit: selectedUnit.businessUnit,
      product: selectedUnit.project,
      plant: selectedUnit.plant,
      description: "Unidade sintética para QA visual isolada",
      baseDate: "2026-09-06",
      completionDate: selectedUnit.completionDate,
      salePrice: selectedUnit.finalPrice,
      discountAuthorized: false,
      discount: 0,
      entryValue: preset.entryValue,
      income: 100_000,
      signals: preset.signals,
      intermediaries: preset.intermediaries,
    });
    assert.equal(result.ok, true);
    assert.equal(result.custom.status, "APROVADO");
    assert.equal(result.custom.signals.filter((item) => item.active).length, 3);
    assert.equal(result.custom.intermediaries.filter((item) => item.value > 0).length, 6);
  });

  it("mantém o snapshot fora de public e exige permissão nas duas fontes", () => {
    assert.equal(
      existsSync(new URL("../public/data/investor-inventory.json", import.meta.url)),
      false,
    );
    assert.equal(existsSync(new URL("../data/investor-inventory.json", import.meta.url)), false);
    const snapshotRoute = readFileSync(
      new URL("../app/api/inventory/snapshot/route.ts", import.meta.url),
      "utf8",
    );
    const liveRoute = readFileSync(
      new URL("../app/api/inventory/route.ts", import.meta.url),
      "utf8",
    );
    const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
    const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
    const productionCompose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
    const releaseWrapper = readFileSync(
      new URL("../scripts/release/compose-with-runtime-secret.mjs", import.meta.url),
      "utf8",
    );
    for (const source of [snapshotRoute, liveRoute]) {
      assert.ok(source.includes('authorizeRoute("crm.simulators.view")'));
    }
    assert.ok(snapshotRoute.includes('noStoreHeaders({ "content-type"'));
    assert.ok(snapshotRoute.includes("INVESTOR_INVENTORY_SNAPSHOT_PATH"));
    assert.ok(snapshotRoute.includes('sourceKind: "versioned-snapshot"'));
    assert.ok(!nextConfig.includes("investor-inventory.json"));
    assert.ok(gitignore.includes("/private-data/"));
    assert.ok(dockerignore.includes("private-data"));
    assert.ok(productionCompose.includes("target: /run/data/investor-inventory.json"));
    assert.ok(
      productionCompose.includes(
        "source: /etc/descomplica-crm/data/investor-inventory-2026-09-05.json",
      ),
    );
    assert.ok(
      releaseWrapper.includes('"f31e6fe6a8dac204e767744903a6ae957f9bd526ed190e8cdf193c3479e61b24"'),
    );
  });

  it("mantém cálculo-base da distribuição direta", () => {
    const result = calculateDirectTableFileFlow(base);
    assert.deepEqual(
      result.standardScenarios.map((scenario) => scenario.code),
      ["C1", "C2"],
    );
    assert.equal(result.standardScenarios[0]!.entry, 40_000);
    assert.deepEqual(
      result.standardScenarios[1]!.signals.map((signal) => signal.value),
      [5_360, 5_320, 5_320],
    );
  });

  it("usa o mesmo arredondamento em centavos no limite mínimo do ato", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      salePrice: 50_000,
      discountAuthorized: true,
      discount: 0.75,
      entryValue: 2_999.95,
    });

    assert.equal(result.context.valueReal, 49_999.25);
    assert.equal(result.custom.minimumActValue, 2_999.96);
    assert.equal(result.audit.find((item) => item.id === "act")?.ok, false);

    const exactBoundary = calculateDirectTableFileFlow({
      ...base,
      salePrice: 50_000,
      discountAuthorized: true,
      discount: 0.75,
      entryValue: 2_999.96,
    });
    assert.equal(exactBoundary.audit.find((item) => item.id === "act")?.ok, true);
  });

  it("falha fechado no snapshot e imprime somente o cálculo atual aprovado", () => {
    const calculator = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const styles = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
        import.meta.url,
      ),
      "utf8",
    );

    assert.ok(
      calculator.includes(
        'const snapshotPayload = await fetchInventory("/api/inventory/snapshot")',
      ),
    );
    assert.ok(!calculator.includes('return { ...payload, sourceKind: "live" as const }'));
    assert.ok(calculator.includes("flow: directResult"));
    assert.ok(calculator.includes("Composição atual da Tabela Direta"));
    assert.ok(calculator.includes("Sinais informados"));
    assert.ok(calculator.includes("Intermediárias informadas"));
    assert.ok(calculator.includes("Auditoria integral do cálculo"));
    assert.ok(calculator.includes("flow.audit.map"));
    assert.ok(calculator.includes("`Ato de ${percent.format(flow.custom.actRate)}`"));
    assert.ok(!calculator.includes("option.entrySummary, signalSummary"));
    assert.ok(calculator.includes("disabled={!directPrintReady}"));
    assert.ok(calculator.includes("{directPrintReady ? <DirectPrintComposition"));
    assert.ok(calculator.includes("investor-direct-print-blocked-notice"));
    assert.ok(calculator.includes("<h2>Impressão indisponível</h2>"));
    assert.ok(!calculator.includes("<h1>Impressão indisponível</h1>"));
    assert.ok(styles.includes(".investor-direct-workspace.investor-direct-print-blocked>:not"));
    assert.ok(
      styles.includes(
        ".investor-page-shell.investor-direct-table-page .investor-stock-unit-button",
      ),
    );
    assert.ok(
      styles.includes(
        ".investor-page-shell.investor-direct-table-page>.simulation-topbar #site-menu-settings",
      ),
    );
    assert.ok(styles.includes("details.investor-proposal-audit"));
    assert.ok(styles.includes('background-image:url("/boravender-logo192.png")'));
    assert.ok(styles.includes('background-image:url("/salesforce-no-type-logo.svg")'));
    assert.ok(!styles.includes("boravender.app.br/logo192.png"));
    assert.ok(!styles.includes("a.sfdcstatic.com/shared/images/c360-nav"));
    assert.ok(calculator.includes("Nenhuma fonte alternativa foi usada"));
    assert.ok(calculator.includes("investor-stock-retry-button"));
    assert.ok(calculator.includes("A proposta em edição foi preservada"));
    assert.ok(calculator.includes("Trocar a unidade descartará a renda e a composição atual"));
    assert.ok(calculator.includes('window.addEventListener("beforeunload", warnBeforeUnload)'));
    assert.ok(
      calculator.includes('browserNavigation?.addEventListener("navigate", confirmNavigationApi)'),
    );
    assert.ok(
      calculator.includes('window.addEventListener("popstate", confirmHistoryNavigation, true)'),
    );
    assert.ok(
      calculator.includes("window.history.go(protectedHistoryIndex - destinationHistoryIndex)"),
    );
    assert.ok(calculator.includes("Sair da Tabela Direta descartará a proposta em edição"));
    assert.ok(calculator.includes("paginationFocusRequested.current = true"));
    assert.ok(calculator.includes('scrollIntoView({ behavior: "auto", block: "center" })'));
    assert.ok(calculator.includes('aria-live="polite" aria-atomic="true"'));
  });

  it("oferece somente quatro combinações de sinal e intermediária", () => {
    assert.deepEqual(
      DIRECT_TABLE_PROPOSAL_OPTIONS.map((option) => option.label),
      [
        "Opção sem sinal e sem intermediária",
        "Opção com sinal e sem intermediária",
        "Opção sem sinal e com intermediária",
        "Opção com sinal e com intermediária",
      ],
    );
  });

  it("prepara entrada, sinais e intermediária nas quatro opções", () => {
    const dates = { baseDate: "2026-08-19", completionDate: "2028-12-31" };
    const withoutPayments = buildDirectTableProposalPreset(
      "without-signal-without-intermediary",
      400_000,
      dates,
    );
    const withAll = buildDirectTableProposalPreset("with-signal-with-intermediary", 400_000, dates);
    assert.deepEqual(
      [
        withoutPayments.entryValue,
        withoutPayments.signals,
        withoutPayments.intermediaries,
        withoutPayments.intermediaryFieldCount,
      ],
      [40_000, [0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], 0],
    );
    assert.deepEqual(
      [
        withAll.entryValue,
        withAll.signals,
        withAll.intermediaries,
        withAll.signalFieldCount,
        withAll.intermediaryFieldCount,
      ],
      [24_000, [5_360, 5_320, 5_320], [20_000, 20_000, 20_000, 20_000, 0, 0, 0, 0], 3, 4],
    );
  });

  it("acompanha a entrega nas intermediárias e preserva o bloco de 30%", () => {
    const dates = { baseDate: "2026-08-19", completionDate: "2028-12-31" };
    const validIntermediaryBase = { ...base, ...dates };
    for (const optionId of [
      "without-signal-with-intermediary",
      "with-signal-with-intermediary",
    ] as const) {
      const preset = buildDirectTableProposalPreset(optionId, 400_000, dates);
      const result = calculateDirectTableFileFlow({
        ...validIntermediaryBase,
        entryValue: preset.entryValue,
        signals: preset.signals,
        intermediaries: preset.intermediaries,
      });
      assert.equal(preset.intermediaryFieldCount, 4);
      assert.deepEqual(preset.intermediaryDates, [
        "2027-02-15",
        "2027-08-15",
        "2028-02-15",
        "2028-08-15",
      ]);
      assert.equal(result.custom.validIntermediaryTotal, 80_000);
      assert.equal(result.custom.balance, 40_000);
    }
  });

  it("limita a seis intermediárias de 5% na proposta pronta", () => {
    const dates = { baseDate: "2026-08-19", completionDate: "2030-12-31" };
    const preset = buildDirectTableProposalPreset(
      "without-signal-with-intermediary",
      400_000,
      dates,
    );
    const result = calculateDirectTableFileFlow({
      ...base,
      ...dates,
      entryValue: preset.entryValue,
      intermediaries: preset.intermediaries,
    });
    assert.equal(preset.intermediaryFieldCount, 6);
    assert.equal(
      preset.intermediaries.reduce((total, value) => total + value, 0),
      120_000,
    );
    assert.equal(result.custom.balance, 0);
    assert.equal(
      result.custom.intermediaries.filter((item) => item.value > 0 && item.approved).length,
      6,
    );
  });

  it("fecha seis intermediárias no centavo", () => {
    const dates = { baseDate: "2026-08-19", completionDate: "2030-12-31" };
    const preset = buildDirectTableProposalPreset(
      "with-signal-with-intermediary",
      333_729.55,
      dates,
    );
    const total = preset.intermediaries.reduce((sum, value) => sum + value, 0);
    const result = calculateDirectTableFileFlow({
      ...base,
      ...dates,
      salePrice: 333_729.55,
      entryValue: preset.entryValue,
      signals: preset.signals,
      intermediaries: preset.intermediaries,
    });
    assert.equal(Number(total.toFixed(2)), 100_118.86);
    assert.ok(preset.intermediaries.every((value) => value <= 16_686.48));
    assert.equal(result.custom.balance, 0);
    assert.equal(result.audit.find((item) => item.id === "distribution")?.ok, true);
  });

  it("reduz automaticamente intermediárias quando a entrega é curta", () => {
    const dates = { baseDate: "2026-08-19", completionDate: "2027-06-30" };
    const preset = buildDirectTableProposalPreset("with-signal-with-intermediary", 400_000, dates);
    const result = calculateDirectTableFileFlow({
      ...base,
      ...dates,
      entryValue: preset.entryValue,
      signals: preset.signals,
      intermediaries: preset.intermediaries,
    });
    assert.equal(preset.intermediaryFieldCount, 1);
    assert.deepEqual(preset.intermediaryDates, ["2027-02-15"]);
    assert.equal(result.context.intermediaryInputLimit, 1);
  });

  it("trata o limite de três meses antes da entrega como inclusivo", () => {
    const baseDate = "2026-08-19";
    const atDeadline = buildDirectTableProposalPreset("without-signal-with-intermediary", 400_000, {
      baseDate,
      completionDate: "2027-05-15",
    });
    const afterDeadline = buildDirectTableProposalPreset(
      "without-signal-with-intermediary",
      400_000,
      { baseDate, completionDate: "2027-05-14" },
    );
    const lockedAfterDeadline = calculateDirectTableFileFlow({
      ...base,
      baseDate,
      completionDate: "2027-05-14",
    });
    assert.equal(atDeadline.intermediaryFieldCount, 1);
    assert.equal(afterDeadline.intermediaryFieldCount, 0);
    assert.equal(lockedAfterDeadline.context.intermediaryInputLimit, 0);
  });

  it("alinha intermediárias ao dia das mensais pré-chaves", () => {
    const examples = [
      { baseDate: "2026-08-05", expected: "2027-02-05" },
      { baseDate: "2026-08-10", expected: "2027-02-10" },
      { baseDate: "2026-08-14", expected: "2027-02-10" },
    ];
    for (const example of examples) {
      const dates = { baseDate: example.baseDate, completionDate: "2028-12-31" };
      const preset = buildDirectTableProposalPreset(
        "without-signal-with-intermediary",
        400_000,
        dates,
      );
      const result = calculateDirectTableFileFlow({
        ...base,
        ...dates,
        entryValue: preset.entryValue,
        intermediaries: preset.intermediaries,
      });
      assert.equal(preset.intermediaryDates[0], example.expected);
      assert.ok(result.context.intermediaryInputLimit > 0);
      assert.equal(result.custom.intermediaries[0]!.reason, "Dentro da regra");
    }
  });

  it("preserva a intermediária de 5% após arredondamento monetário", () => {
    const dates = { baseDate: "2026-08-19", completionDate: "2027-06-30" };
    const preset = buildDirectTableProposalPreset(
      "without-signal-with-intermediary",
      244_499,
      dates,
    );
    const roundTripIntermediaries = preset.intermediaries.map((value) => Number(value.toFixed(2)));
    const result = calculateDirectTableFileFlow({
      ...base,
      ...dates,
      salePrice: 244_499,
      entryValue: preset.entryValue,
      intermediaries: roundTripIntermediaries,
    });
    assert.equal(roundTripIntermediaries[0], 12_224.95);
    assert.equal(result.custom.intermediaries[0]!.approved, true);
    assert.equal(result.custom.validIntermediaryTotal, 12_224.95);
  });

  it("fecha sinais em 10% após arredondamento monetário", () => {
    for (const optionId of [
      "with-signal-without-intermediary",
      "with-signal-with-intermediary",
    ] as const) {
      const preset = buildDirectTableProposalPreset(optionId, 333_729.55);
      const result = calculateDirectTableFileFlow({
        ...base,
        salePrice: 333_729.55,
        entryValue: Number(preset.entryValue.toFixed(2)),
        signals: preset.signals.map((value) => Number(value.toFixed(2))),
        intermediaries: preset.intermediaries.map((value) => Number(value.toFixed(2))),
      });
      assert.equal(
        result.custom.signals.filter((signal) => signal.active && !signal.approved).length,
        0,
      );
      assert.equal(result.custom.totalEntryValue, 33_372.96);
      assert.equal(result.audit.find((item) => item.id === "act")?.ok, true);
      assert.equal(result.audit.find((item) => item.id === "entry")?.ok, true);
    }
  });

  it("preserva a distribuição 10%, 30% e 60%", () => {
    const result = calculateDirectTableFileFlow(base);
    const c1 = result.standardScenarios[0];
    assert.equal(c1!.entry, 40_000);
    assert.equal(c1!.balance, 120_000);
    assert.equal(c1!.postKeysBalance, 240_000);
    assert.equal(c1!.postKeysInstallments, 120);
  });

  it("aplica 10%, 40%, 50% e 66 pós-chaves à planta com Vaga", () => {
    const parking = calculateDirectTableFileFlow({ ...base, plant: "VAGA DESCOBERTA" });
    assert.equal(parking.context.parkingPolicy, true);
    assert.equal(parking.context.preKeysRate, 0.4);
    assert.equal(parking.context.postKeysRate, 0.5);
    assert.equal(parking.custom.entryValue, 40_000);
    assert.equal(parking.custom.balance, 160_000);
    assert.equal(parking.custom.postKeysBalance, 200_000);
    assert.equal(parking.custom.postKeysInstallments, 66);
  });

  it("distribui ato de 6%, sinais de 4% e até oito intermediárias para Vaga", () => {
    const dates = {
      baseDate: "2026-08-19",
      completionDate: "2031-12-31",
      plant: "Planta com Vaga",
    };
    const preset = buildDirectTableProposalPreset("with-signal-with-intermediary", 400_000, dates);
    const result = calculateDirectTableFileFlow({
      ...base,
      ...dates,
      entryValue: preset.entryValue,
      signals: preset.signals,
      intermediaries: preset.intermediaries,
    });
    assert.equal(preset.entryValue, 24_000);
    assert.equal(
      preset.signals.reduce((total, value) => total + value, 0),
      16_000,
    );
    assert.equal(preset.intermediaryFieldCount, 8);
    assert.equal(result.custom.validIntermediaryTotal, 160_000);
    assert.equal(result.custom.balance, 0);
  });

  it("inclui juros, MIP e DFI no pós-chaves", () => {
    const result = calculateDirectTableFileFlow(base);
    assert.equal(result.custom.postKeysPayment, 3_425.93);
    assert.equal(result.custom.postKeysInstallments, 120);
  });

  it("decide crédito pelo mesmo centavo exibido e quita o principal sem resíduo", () => {
    const boundary = calculateDirectTableFileFlow({ ...base, income: 8_564.83 });
    assert.equal(boundary.custom.postKeysPayment, 3_425.93);
    assert.equal(boundary.custom.creditApproved, true);
    assert.equal(boundary.status, "APROVADO");

    const schedule = buildDirectTableAmortizationSchedule(155_119.45, "2026-10-05", 120);
    assert.equal(schedule.length, 120);
    assert.equal(
      Number(schedule.reduce((total, item) => total + item.amortization, 0).toFixed(2)),
      155_119.45,
    );
    assert.equal(schedule.at(-1)!.balance, 0);
    for (const item of schedule) {
      for (const amount of [
        item.amortization,
        item.interest,
        item.mip,
        item.dfi,
        item.totalPayment,
        item.balance,
      ]) {
        assert.equal(Number(amount.toFixed(2)), amount);
      }
    }
  });

  it("rateia as mensais pré-chaves no centavo e ajusta somente a última", () => {
    const schedule = buildDirectTablePreKeysSchedule(120_000, 43, "2026-06-05");
    assert.equal(schedule.length, 43);
    assert.equal(schedule[0]!.payment, 2_790.7);
    assert.equal(schedule.at(-1)!.payment, 2_790.6);
    assert.equal(
      Number(schedule.reduce((total, item) => total + item.payment, 0).toFixed(2)),
      120_000,
    );
    assert.equal(schedule.at(-1)!.balance, 0);

    const result = calculateDirectTableFileFlow(base);
    assert.equal(result.custom.installmentValue, schedule[0]!.payment);
    assert.equal(result.custom.lastInstallmentValue, schedule.at(-1)!.payment);
  });

  it("aprova crédito até 40% e reprova acima", () => {
    const approved = calculateDirectTableFileFlow(base);
    const reproved = calculateDirectTableFileFlow({ ...base, income: 7_000 });
    assert.equal(approved.custom.creditApproved, true);
    assert.equal(approved.ok, true);
    assert.equal(reproved.custom.creditApproved, false);
    assert.equal(reproved.status, "REPROVADO");
  });

  it("só altera a base com desconto autorizado", () => {
    const ignored = calculateDirectTableFileFlow({
      ...base,
      discount: 10_000,
      discountAuthorized: false,
    });
    const applied = calculateDirectTableFileFlow({
      ...base,
      discount: 10_000,
      discountAuthorized: true,
      entryValue: 39_000,
    });
    assert.equal(ignored.context.valueReal, 400_000);
    assert.equal(applied.context.valueReal, 390_000);
  });

  it("disponibiliza oito intermediárias e aplica limite individual de 5%", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      intermediaries: [20_001, 0, 0, 0, 0, 0, 0, 0],
    });
    assert.equal(result.custom.intermediaries.length, 8);
    assert.equal(result.custom.intermediaries[0]!.approved, false);
    assert.equal(result.custom.intermediaries[0]!.reason, "Intermediária acima de 5%");
  });

  it("impede a oitava posição de ultrapassar o bloco pré-chaves", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      baseDate: "2026-08-19",
      completionDate: "2030-12-31",
      intermediaries: [20_000, 20_000, 20_000, 20_000, 20_000, 20_000, 20_000, 20_000],
    });
    assert.equal(result.custom.validIntermediaryCount, 6);
    assert.equal(result.custom.validIntermediaryTotal, 120_000);
    assert.deepEqual(
      result.custom.intermediaries.slice(6).map((item) => item.reason),
      [
        "Intermediárias acima do saldo pré-chaves de 30%",
        "Intermediárias acima do saldo pré-chaves de 30%",
      ],
    );
  });

  it("usa a cascata de datas 5, 10 ou 15 em 31 dias", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      entryValue: 24_000,
      signals: [5_360, 5_320, 5_320],
    });
    assert.deepEqual(
      result.custom.signals.map((signal) => signal.date),
      ["2025-06-05", "2025-07-05", "2025-08-05"],
    );
    assert.equal(result.custom.firstPostKeysDate, "2029-01-05");
  });

  it("exige sinais consecutivos na ordem 1, 2 e 3", () => {
    const withoutFirst = calculateDirectTableFileFlow({ ...base, signals: [0, 1_000, 0] });
    assert.equal(withoutFirst.custom.signals[1]!.approved, false);
    assert.equal(withoutFirst.custom.signals[1]!.reason, "Preencha o Sinal 1 primeiro");
    assert.equal(withoutFirst.custom.signalTotal, 0);

    const withoutSecond = calculateDirectTableFileFlow({ ...base, signals: [1_000, 0, 500] });
    assert.equal(withoutSecond.custom.signals[0]!.approved, true);
    assert.equal(withoutSecond.custom.signals[2]!.approved, false);
    assert.equal(withoutSecond.custom.signals[2]!.reason, "Preencha o Sinal 2 primeiro");
    assert.equal(withoutSecond.custom.signalTotal, 1_000);
  });

  it("não soma sinais posteriores quando o predecessor existe, mas é inválido", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      entryValue: 10_000,
      signals: [11_000, 10_000, 9_000],
    });
    assert.equal(result.custom.signals[0]!.reason, "Sinal 1 não pode ser maior que o ato");
    assert.equal(result.custom.signals[1]!.reason, "Corrija o Sinal 1 primeiro");
    assert.equal(result.custom.signals[2]!.reason, "Corrija o Sinal 2 primeiro");
    assert.equal(result.custom.signalTotal, 0);
    assert.equal(result.proposalReady, false);
  });

  it("fecha presets de 10% e a distribuição no centavo", () => {
    for (const salePrice of [258_532.41, 364_296.34]) {
      for (const optionId of [
        "without-signal-without-intermediary",
        "with-signal-without-intermediary",
      ] as const) {
        const preset = buildDirectTableProposalPreset(optionId, salePrice);
        const result = calculateDirectTableFileFlow({
          ...base,
          salePrice,
          entryValue: preset.entryValue,
          signals: preset.signals,
        });
        assert.equal(result.custom.totalEntryValue, result.custom.minimumEntryValue);
        assert.equal(
          Number(
            (
              result.custom.minimumEntryValue +
              result.custom.basePreKeysBudget +
              result.custom.postKeysBalance
            ).toFixed(2),
          ),
          result.context.valueReal,
        );
        assert.equal(result.audit.find((item) => item.id === "entry")?.ok, true);
        assert.equal(result.audit.find((item) => item.id === "distribution")?.ok, true);
        assert.equal(result.proposalReady, true);
      }
    }
  });

  it("reduz pré-chaves quando a entrada ultrapassa 10%, sem sobrepagamento", () => {
    const result = calculateDirectTableFileFlow({ ...base, entryValue: 50_000 });
    assert.equal(result.custom.minimumEntryValue, 40_000);
    assert.equal(result.custom.maximumEntryValue, 160_000);
    assert.equal(result.custom.entryExcess, 10_000);
    assert.equal(result.custom.preKeysBudget, 110_000);
    assert.equal(result.custom.balance, 110_000);
    assert.equal(
      result.custom.totalEntryValue +
        result.custom.validIntermediaryTotal +
        result.custom.balance +
        result.custom.postKeysBalance,
      result.context.valueReal,
    );
    assert.equal(result.status, "APROVADO");
  });

  it("não deixa a entrada consumir o bloco pós-chaves", () => {
    const result = calculateDirectTableFileFlow({ ...base, entryValue: 160_000.01 });
    assert.equal(result.audit.find((item) => item.id === "entry-maximum")?.ok, false);
    assert.equal(result.audit.find((item) => item.id === "distribution")?.ok, false);
    assert.equal(result.proposalReady, false);
    assert.equal(result.custom.status, "AJUSTE NECESSÁRIO");
    assert.equal(result.ok, false);
  });

  it("dispensa pré-chaves na entrada máxima e ancora pós-chaves após a obra", () => {
    const result = calculateDirectTableFileFlow({ ...base, entryValue: 160_000 });
    assert.equal(result.custom.balance, 0);
    assert.equal(
      result.audit.find((item) => item.id === "pre-keys")?.label,
      "Mensais pré-chaves dispensadas",
    );
    assert.equal(result.audit.find((item) => item.id === "pre-keys")?.ok, true);
    assert.equal(result.custom.firstPostKeysDate, "2029-01-05");
    assert.equal(result.proposalReady, true);
    assert.equal(result.status, "APROVADO");
  });

  it("mantém o cálculo pós-chaves independente em entrega curta", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      baseDate: "2026-09-05",
      completionDate: "2026-10-31",
    });
    assert.equal(result.standardScenarios.length, 0);
    assert.equal(result.custom.desiredInstallments, 1);
    assert.equal(result.custom.firstPostKeysDate, "2026-11-05");
    assert.ok(result.custom.postKeysPayment > 0);
    assert.equal(result.audit.find((item) => item.id === "post-keys")?.ok, true);
    assert.equal(result.status, "APROVADO");
  });

  it("exige ajuste sem dividir por zero quando sinais esgotam o pré-chaves", () => {
    const preset = buildDirectTableProposalPreset("with-signal-without-intermediary", 400_000);
    const result = calculateDirectTableFileFlow({
      ...base,
      baseDate: "2026-09-05",
      completionDate: "2026-10-31",
      entryValue: preset.entryValue,
      signals: preset.signals,
    });
    assert.ok(result.custom.balance > 0);
    assert.equal(result.custom.desiredInstallments, 0);
    assert.equal(result.custom.installmentValue, 0);
    assert.equal(
      result.audit.find((item) => item.id === "pre-keys")?.label,
      "Prazo insuficiente para mensais pré-chaves",
    );
    assert.equal(result.audit.find((item) => item.id === "pre-keys")?.ok, false);
    assert.equal(result.proposalReady, false);
    assert.equal(result.status, "AJUSTE NECESSÁRIO");
  });

  it("nunca aprova sinal posterior à entrega", () => {
    const result = calculateDirectTableFileFlow({
      ...base,
      baseDate: "2026-09-05",
      completionDate: "2026-10-31",
      entryValue: 136_000,
      signals: [8_000, 8_000, 8_000],
    });
    assert.equal(result.custom.signals[0]!.approved, true);
    assert.equal(result.custom.signals[1]!.approved, false);
    assert.equal(result.custom.signals[1]!.reason, "Sinal após a data de entrega");
    assert.equal(result.custom.signals[2]!.approved, false);
    assert.equal(result.audit.find((item) => item.id === "signals")?.ok, false);
    assert.equal(result.proposalReady, false);
    assert.equal(result.status, "AJUSTE NECESSÁRIO");
  });

  it("rejeita data ISO impossível", () => {
    const result = calculateDirectTableFileFlow({ ...base, completionDate: "2028-02-31" });
    assert.equal(result.audit.find((item) => item.id === "context")?.ok, false);
    assert.equal(result.proposalReady, false);
    assert.equal(result.status, "AJUSTE NECESSÁRIO");
  });

  it("separa pendência, ajuste operacional e recusa de crédito", () => {
    const pending = calculateDirectTableFileFlow({ ...base, income: 0 });
    const adjustment = calculateDirectTableFileFlow({ ...base, entryValue: 1_000 });
    const rejected = calculateDirectTableFileFlow({ ...base, income: 7_000 });
    assert.equal(pending.status, "PENDENTE");
    assert.equal(adjustment.status, "AJUSTE NECESSÁRIO");
    assert.equal(rejected.status, "REPROVADO");
  });

  itWithPrivateSnapshot(
    "valida as quatro opções em todas as 2.987 unidades calculáveis do snapshot",
    () => {
      const payload = JSON.parse(readFileSync(privateSnapshotUrl, "utf8")) as {
        items: Array<{
          id: string;
          project: string;
          businessUnit: string;
          product: string;
          plant: string | null;
          description: string | null;
          finalPrice: number | null;
          completionDate: string | null;
        }>;
      };
      const calculable = payload.items.filter(
        (item) => Number(item.finalPrice) > 0 && item.completionDate,
      );
      let ready = 0;
      let adjustment = 0;
      let unexpected = 0;

      for (const item of calculable) {
        for (const option of DIRECT_TABLE_PROPOSAL_OPTIONS) {
          const dates = {
            baseDate: "2026-09-05",
            completionDate: item.completionDate!,
            plant: item.plant,
          };
          const preset = buildDirectTableProposalPreset(option.id, Number(item.finalPrice), dates);
          const result = calculateDirectTableFileFlow({
            selectedUnitId: item.id,
            developmentName: item.project,
            businessUnit: item.businessUnit,
            product: item.product,
            plant: item.plant,
            description: item.description,
            baseDate: dates.baseDate,
            completionDate: dates.completionDate,
            salePrice: Number(item.finalPrice),
            discountAuthorized: false,
            discount: 0,
            entryValue: preset.entryValue,
            income: 1_000_000,
            signals: preset.signals,
            intermediaries: preset.intermediaries,
          });

          if (result.proposalReady) ready += 1;
          else adjustment += 1;
          if (result.status !== (result.proposalReady ? "APROVADO" : "AJUSTE NECESSÁRIO")) {
            unexpected += 1;
          }
        }
      }

      assert.equal(calculable.length, 2_987);
      assert.equal(calculable.length * DIRECT_TABLE_PROPOSAL_OPTIONS.length, 11_948);
      assert.equal(ready, 11_692);
      assert.equal(adjustment, 256);
      assert.equal(unexpected, 0);
    },
    300_000,
  );
});
