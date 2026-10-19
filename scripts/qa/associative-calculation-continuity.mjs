import assert from "node:assert/strict";
import { expect as baseExpect } from "@playwright/test";
import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";
import { calculateInvestorFlow } from "../../lib/archive-investor/investor-calculator-rules.mjs";
import { buildAssociativePaymentComparison } from "../../lib/archive-investor/associative-installment-memory.mjs";

const root = ".investor-associative-table-page";
const approval = `${root} .investor-associative-approval`;
const expect = baseExpect.configure({ timeout: 30_000 });

export function isExpectedInventoryUnavailableConsoleError(message, origin) {
  return (
    message.type() === "error" &&
    message.location().url === `${origin}/api/inventory` &&
    message.text() ===
      "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
  );
}

function buildInventory(withProgress, withAppraisal) {
  const base = JSON.parse(buildSyntheticDirectTableQaSnapshot()).items[0];
  const items = [0, 1].map((index) => ({
    ...base,
    id: `qa-continuity-reference-${index}`,
    identifier: `QA-CONT-${index + 1}`,
    project: "Empreendimento QA Continuidade",
    city: "São Paulo",
    state: "SP",
    product: `Apartamento QA-CONT-${index + 1} - Referencia QA`,
    finalWithKit: 340_000 + index * 20_000,
    finalPrice: 230_000 + index * 20_000,
    appraisal: withAppraisal ? 350_000 + index * 20_000 : null,
    progress: withProgress ? 0.5 + index * 0.05 : null,
    completionDate: `${new Date().getFullYear() + 6}-12-31`,
  }));
  const reference = {
    source: "ESTOQUE SPC.xlsx",
    sourceKind: "versioned-snapshot",
    qaFixture: { synthetic: true, contract: "associative-calculation-continuity-v5" },
    count: items.length,
    items,
  };
  return {
    reference,
    live: {
      ...reference,
      source: "Estoque sintetico QA",
      sourceKind: "live",
      items: items.map((item, index) => ({
        ...item,
        id: `qa-continuity-live-${index}`,
        project: " EMPREENDIMENTO QA CONTINUIDADE ",
        product: `Apartamento QA-CONT-${index + 1} - Estoque vivo QA`,
        appraisal: null,
        progress: null,
        completionDate: `${new Date().getFullYear() + 3 + index}-12-31`,
      })),
    },
  };
}

export async function checkAssociativeCalculationContinuity(
  page,
  { onExpectedConsoleError = () => {} } = {},
) {
  const origin = new URL(page.url());
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname),
    "Continuity QA requires a local synthetic application",
  );
  const result = {
    contract: "associative-calculation-continuity-v5",
    synthetic: true,
    passed: false,
    stages: [],
    blockedExternalRequests: 0,
    expectedNetworkErrorCount: 0,
  };
  let stage = "inventory-merge";
  let fixture = buildInventory(true, true);
  let inventoryRequests = { live: 0, reference: 0 };
  let inventoryResponses = { live: 0, reference: 0 };
  let liveStatus = 200;
  let liveGate = Promise.resolve();
  let releaseLive;
  const expectedNetworkErrors = [];
  const onConsole = (message) => {
    if (
      stage === "live-failure-blocks-calculation" &&
      liveStatus === 503 &&
      isExpectedInventoryUnavailableConsoleError(message, origin.origin)
    ) {
      expectedNetworkErrors.push(message);
    }
  };
  const handler = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin.origin) {
      result.blockedExternalRequests += 1;
      await route.abort("blockedbyclient");
      return;
    }
    const source =
      url.pathname === "/api/inventory"
        ? "live"
        : url.pathname === "/api/inventory/snapshot"
          ? "reference"
          : null;
    if (source === null) return route.fallback();
    assert.equal(request.method(), "GET", "Inventory QA must be read-only");
    inventoryRequests[source] += 1;
    const status = source === "live" ? liveStatus : 200;
    const payload = fixture[source];
    if (source === "live") await liveGate;
    try {
      await route.fulfill({
        status,
        contentType: "application/json; charset=utf-8",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify(status === 200 ? payload : { error: "inventory_unavailable" }),
      });
      inventoryResponses[source] += 1;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Route is already handled")) return;
      throw error;
    }
  };
  const field = (label) =>
    page.locator(`${root} input`).and(page.getByLabel(label, { exact: true }));
  const qualification = page.locator(`${root} .investor-associative-qualification`);
  const installmentsButton = page.locator(
    `${root} button[aria-controls="investor-associative-installments"]`,
  );
  const ranking = page.getByRole("combobox", { name: "Selecione o Ranking", exact: true });
  const unitFact = (label) =>
    page
      .locator(`${root} .investor-property-summary dl > div`)
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator("dd");
  const rule = (label) =>
    page.locator(`${approval} tbody tr`).filter({ has: page.getByText(label, { exact: true }) });
  const moneyValue = async (label) => {
    const rawValue = (await field(label).inputValue()).trim();
    return rawValue === "" ? null : Number(rawValue.replace(/\D/g, "")) / 100;
  };
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const percent = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const selectUnit = (index) =>
    page
      .getByRole("button", {
        name: `Iniciar proposta com QA-CONT-${index + 1}`,
        exact: true,
      })
      .click();
  const resources = [
    { label: "Financiamento", amount: 190_000, next: "Subsídio" },
    { label: "Subsídio", amount: 0, next: "FGTS" },
    { label: "FGTS", amount: 0, next: "Cheque Moradia" },
    { label: "Cheque Moradia", amount: 0, next: "Entrada" },
    { label: "Entrada", amount: 1_000, next: "Quantidade de parcelas" },
  ];

  async function restoreTheme(theme) {
    const themeGroup = page.getByRole("group", {
      name: "Aparência da página",
      exact: true,
    });
    if ((page.viewportSize()?.width ?? 1440) <= 600) {
      const cycle = themeGroup.locator("[data-theme-cycle-mobile]");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if ((await page.locator("html").getAttribute("data-theme")) === theme) return;
        await cycle.click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      return;
    }
    await themeGroup
      .getByRole("button", {
        name: { light: "Claro", balanced: "Médio", dark: "Escuro" }[theme] ?? "Claro",
        exact: true,
      })
      .click();
  }

  async function reloadPage(waitUntil = "networkidle") {
    inventoryRequests = { live: 0, reference: 0 };
    inventoryResponses = { live: 0, reference: 0 };
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload({ waitUntil });
    await restoreTheme(theme);
  }

  async function reloadFixture() {
    await reloadPage();
    await expect(page.locator(`${root} .investor-stock-product-text`).first()).toContainText(
      "Estoque vivo QA",
    );
    assert.ok(inventoryRequests.live > 0 && inventoryRequests.reference > 0);
    await selectUnit(0);
  }

  async function assertNoProposal() {
    await expect(
      page.locator(`${root} .investor-stock-table tr[aria-selected="true"]`),
    ).toHaveCount(0);
    await expect(qualification).toHaveCount(0);
    await expect(page.locator(`${root} .investor-associative-ledger`)).toHaveCount(0);
    await expect(page.locator(approval)).toHaveCount(0);
  }

  async function assertCalendarForUnit(index) {
    await expect(
      page.locator(`${root} .investor-associative-calendar, ${root} input[type="date"]`),
    ).toHaveCount(0);
    const completionDate = fixture.live.items[index].completionDate;
    assert.notEqual(completionDate, fixture.reference.items[index].completionDate);
    const baseDate = await page.evaluate(() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });
    const signals = [];
    for (let signal = 1; signal <= 3; signal += 1) {
      signals.push(
        (await field(`Sinal ${signal}`).count()) ? await moneyValue(`Sinal ${signal}`) : 0,
      );
    }
    const installments = Number(await field("Quantidade de parcelas").inputValue());
    const engine = calculateInvestorFlow({
      selectedUnitId: fixture.live.items[index].id,
      baseDate,
      completionDate,
      salePrice: fixture.live.items[index].finalPrice,
      propertyValue: fixture.live.items[index].finalWithKit,
      unitBonus: fixture.live.items[index].unitBonus,
      tableSlack: fixture.live.items[index].tableSlack,
      financing: await moneyValue("Financiamento"),
      subsidy: await moneyValue("Subsídio"),
      fgts: await moneyValue("FGTS"),
      housingCheck: await moneyValue("Cheque Moradia"),
      entryValue: await moneyValue("Entrada"),
      income: await moneyValue("Renda Familiar"),
      installments: String(installments),
      signals,
      intermediaries: [],
      annualMode: true,
    });
    await expect(installmentsButton).toBeEnabled();
    await installmentsButton.click();
    const dialog = page.locator("#investor-associative-installments");
    await expect(dialog).toBeVisible();
    const monthlyDates = await dialog
      .locator("tbody tr.is-monthly time")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime")));
    assert.equal(monthlyDates.length, installments);
    assert.deepEqual(monthlyDates, engine.context.monthlyDates.slice(0, installments));
    const comparison = buildAssociativePaymentComparison({
      monthlyDates,
      installments,
      income: await moneyValue("Renda Familiar"),
      constructionProgress:
        fixture.live.items[index].progress ?? fixture.reference.items[index].progress ?? 0,
      baseDate,
      completionDate,
    });
    await expect(dialog.locator('tbody tr.is-monthly td[data-label="% Obra"]')).toHaveText(
      comparison.rows.map((row) => percent.format(row.constructionProgress)),
    );
    await expect(dialog.locator('tbody tr.is-monthly td[data-label="Evolução Obra"]')).toHaveText(
      comparison.rows.map((row) =>
        row.workEvolution == null ? "—" : money.format(row.workEvolution),
      ),
    );
    const firstMonthly = monthlyDates[0];
    for (const date of monthlyDates) {
      assert.match(date, /^\d{4}-\d{2}-(05|10|15)$/);
      assert.equal(new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10), date);
    }
    await expect(dialog.locator("tbody tr.is-entry time")).toHaveAttribute("datetime", baseDate);
    const signalDates = await dialog
      .locator("tbody tr.is-signal time")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime")));
    for (const date of signalDates) {
      assert.match(date, /^\d{4}-\d{2}-(05|10|15)$/);
      assert.ok(firstMonthly > date);
    }
    const [completionYear, completionMonth] = completionDate.split("-").map(Number);
    const [monthlyYear, monthlyMonth] = firstMonthly.split("-").map(Number);
    // The construction-end month belongs to post-construction, independently of its day.
    const pre = Math.min(
      installments,
      Math.max(0, (completionYear - monthlyYear) * 12 + completionMonth - monthlyMonth),
    );
    const post = installments - pre;
    await expect(dialog.locator(".investor-associative-dialog-summary")).toContainText(
      `${installments} mensais: ${pre} parcelas pré-chaves e ${post} parcelas pós-chaves.`,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    return { baseDate, completionDate, firstMonthly, signalDates, pre, post };
  }

  async function completeProposal() {
    await field("Renda Familiar").fill("500000");
    await field("Renda Familiar").blur();
    await qualification.getByRole("button", { name: "MCMV", exact: true }).click();
    await qualification.getByRole("radio", { name: "Sim", exact: true }).check();
    // Qualification moves focus asynchronously; finish that handoff before entering resources.
    await expect(field("Financiamento")).toBeFocused();
    for (const { label, amount, next } of resources) {
      const input = field(label);
      await expect(input).toBeEnabled({ timeout: 60_000 });
      await expect
        .poll(
          async () => {
            await input.fill(String(amount * 100));
            await input.blur();
            return moneyValue(label);
          },
          { timeout: 60_000 },
        )
        .toBe(amount);
      await expect(field(next)).toBeEnabled({ timeout: 60_000 });
    }
    await field("Quantidade de parcelas").fill("84");
    await ranking.selectOption("bronze");
  }

  async function assertAnswers(income) {
    await expect.poll(() => moneyValue("Renda Familiar")).toBe(income);
    await expect(qualification.getByRole("button", { name: "MCMV", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(qualification.getByRole("radio", { name: "Sim", exact: true })).toBeChecked();
    for (const { label, amount } of resources) {
      await expect.poll(() => moneyValue(label)).toBe(amount);
    }
    await expect(field("Quantidade de parcelas")).toHaveValue("84");
    await expect(ranking).toHaveValue("bronze");
  }

  async function assertPositivePercentages(label) {
    const values = [];
    for (const flow of ["Linear", "Decrescente"]) {
      const cell = rule(label).locator(`td[data-label="${flow}"]`);
      await expect(cell).toContainText("%");
      await expect
        .poll(async () =>
          Number((await cell.innerText()).replace(/[^\d,.-]/g, "").replace(",", ".")),
        )
        .toBeGreaterThan(0);
      values.push((await cell.innerText()).trim());
    }
    return values;
  }

  await page.route("**/*", handler);
  try {
    await reloadFixture();
    await expect(
      page
        .locator(`${root} .investor-property-summary dt`)
        .filter({ hasText: /^Status no Salesforce$/i }),
    ).toHaveCount(0);
    await expect(unitFact("Avaliação bancária")).toHaveText(money.format(350_000));
    await expect(unitFact("Andamento da obra")).toContainText("50");
    await completeProposal();
    await assertAnswers(5_000);
    const firstCalendar = await assertCalendarForUnit(0);
    result.stages.push({
      stage,
      calendar: firstCalendar,
      commitment: await assertPositivePercentages("% Comprometimento da Renda"),
      maximum: await assertPositivePercentages("% Máximo da renda mensal"),
    });

    stage = "income-continuity";
    await field("Renda Familiar").fill("600000");
    await field("Renda Familiar").blur();
    await assertAnswers(6_000);
    result.stages.push({ stage, passed: true });

    stage = "unit-continuity";
    await selectUnit(1);
    await assertAnswers(6_000);
    await expect(unitFact("Avaliação bancária")).toHaveText(money.format(370_000));
    await expect(page.locator(`${root} .investor-unit-price strong`)).toHaveText(
      money.format(250_000),
    );
    const secondCalendar = await assertCalendarForUnit(1);
    assert.equal(secondCalendar.pre, firstCalendar.pre + 12);
    assert.equal(secondCalendar.post, firstCalendar.post - 12);
    result.stages.push({
      stage,
      calendar: secondCalendar,
      commitment: await assertPositivePercentages("% Comprometimento da Renda"),
    });

    stage = "automatic-calendar-and-signals";
    const beforeSignals = await assertCalendarForUnit(1);
    for (let index = 1; index <= 3; index += 1) {
      await page.getByRole("button", { name: "Inserir Sinal", exact: true }).click();
      await field(`Sinal ${index}`).fill("50000");
      await field(`Sinal ${index}`).blur();
      await expect.poll(() => moneyValue(`Sinal ${index}`)).toBe(500);
      const calendar = await assertCalendarForUnit(1);
      assert.equal(calendar.signalDates.length, index);
      assert.ok(calendar.firstMonthly > beforeSignals.firstMonthly);
      await expect(rule("Status da proposta")).not.toContainText("PENDENTE");
      result.stages.push({ stage, signalCount: index, calendar });
    }
    for (let index = 3; index >= 1; index -= 1) {
      const hideLabel =
        index === 3
          ? `Ocultar Sinal ${index} e zerar valor`
          : `Ocultar Sinal ${index} e os sinais seguintes; os valores serão zerados`;
      await page.getByRole("button", { name: hideLabel, exact: true }).click();
      await expect(field(`Sinal ${index}`)).toHaveCount(0);
    }
    assert.deepEqual(await assertCalendarForUnit(1), beforeSignals);
    await assertAnswers(6_000);

    stage = "missing-progress-default-zero";
    fixture = buildInventory(false, true);
    // Null and absent values must both resolve to zero without user input.
    for (const source of ["reference", "live"]) delete fixture[source].items[1].progress;
    await reloadFixture();
    await completeProposal();
    for (let index = 0; index < 2; index += 1) {
      await selectUnit(index);
      await assertAnswers(5_000);
      await expect(page.getByLabel("Andamento oficial da obra (%)", { exact: true })).toHaveCount(
        0,
      );
      await expect(unitFact("Andamento da obra")).toHaveText("0%");
      await assertPositivePercentages("% Comprometimento da Renda");
      await assertPositivePercentages("% Máximo da renda mensal");
      await expect(rule("Status da proposta")).not.toContainText("PENDENTE");
      await assertCalendarForUnit(index);
      await installmentsButton.click();
      const dialog = page.locator("#investor-associative-installments");
      await expect(dialog.locator(".investor-associative-comparison-formula")).toContainText(
        `parte de ${percent.format(0)}`,
      );
      await page.keyboard.press("Escape");
    }
    const zeroMaximum = await assertPositivePercentages("% Máximo da renda mensal");
    await field("Renda Familiar").fill("600000");
    await field("Renda Familiar").blur();
    await assertAnswers(6_000);
    const recalculatedMaximum = await assertPositivePercentages("% Máximo da renda mensal");
    assert.notDeepEqual(recalculatedMaximum, zeroMaximum);
    result.stages.push({
      stage,
      defaultProgress: 0,
      nullAndAbsent: true,
      recalculated: true,
      unitIsolation: true,
    });

    stage = "reported-progress-boundaries";
    for (const progress of [0, 0.15, 1, 1.01]) {
      fixture = buildInventory(true, true);
      for (const source of ["reference", "live"]) {
        fixture[source].items[0].progress = progress;
        fixture[source].items[1].progress = null;
      }
      await reloadFixture();
      await completeProposal();
      await expect(page.getByLabel("Andamento oficial da obra (%)", { exact: true })).toHaveCount(
        progress <= 1 ? 0 : 1,
      );
      if (progress <= 1) {
        await assertPositivePercentages("% Máximo da renda mensal");
        await expect(rule("Status da proposta")).not.toContainText("PENDENTE");
        await installmentsButton.click();
        await expect(
          page.locator(
            "#investor-associative-installments .investor-associative-comparison-formula",
          ),
        ).toContainText(`parte de ${percent.format(progress)}`);
        await page.keyboard.press("Escape");
      } else {
        for (const flow of ["Linear", "Decrescente"]) {
          await expect(
            rule("% Máximo da renda mensal").locator(`td[data-label="${flow}"]`),
          ).toHaveText("—");
        }
        await expect(
          page.locator(`${approval} .investor-associative-flow-status.approved`),
        ).toHaveCount(0);
      }
      await selectUnit(1);
      await assertAnswers(5_000);
      await expect(unitFact("Andamento da obra")).toHaveText("0%");
      await assertPositivePercentages("% Máximo da renda mensal");
      await expect(rule("Status da proposta")).not.toContainText("PENDENTE");
      result.stages.push({ stage, progress, invalidBlocked: progress > 1, unitIsolation: true });
    }

    stage = "missing-appraisal";
    fixture = buildInventory(true, false);
    await reloadFixture();
    await expect(unitFact("Avaliação bancária")).toHaveText("Não informada");
    await expect(field("Avaliação bancária oficial da unidade")).toHaveAttribute(
      "placeholder",
      "Não informada",
    );
    result.stages.push({ stage, appraisalAvailable: false });

    stage = "official-appraisal-recovery";
    await completeProposal();
    await assertPositivePercentages("% Máximo da renda mensal");
    const documentation = page.locator(`${root} .investor-associative-documentation`);
    await expect(documentation).toHaveClass(/waiting/);
    await field("Avaliação bancária oficial da unidade").fill("35000000");
    await expect(documentation).toHaveClass(/ready/);
    await expect(
      documentation.locator("[data-documentation-legal], select, input[type=checkbox]"),
    ).toHaveCount(0);
    await expect(documentation.getByRole("note")).toContainText("Estimativa automática");
    await expect(unitFact("Avaliação bancária")).toHaveText("Não informada");
    await selectUnit(1);
    await assertAnswers(5_000);
    await expect(field("Avaliação bancária oficial da unidade")).toHaveValue("");
    await expect(documentation).toHaveClass(/waiting/);
    await expect(
      documentation.locator("[data-documentation-legal], select, input[type=checkbox]"),
    ).toHaveCount(0);
    await expect(documentation.locator(".investor-associative-documentation-summary")).toHaveCount(
      0,
    );
    result.stages.push({
      stage,
      calculationRecovered: true,
      automaticEstimate: true,
      appraisalResetOnUnitChange: true,
      inventoryUnchanged: true,
      unitIsolation: true,
    });

    stage = "delayed-live-authority";
    fixture = buildInventory(true, true);
    fixture.live.items = fixture.live.items.map((item, index) => ({
      ...item,
      appraisal: fixture.reference.items[index].appraisal,
      progress: fixture.reference.items[index].progress,
      finalPrice: item.finalPrice + 10_000,
      finalWithKit: item.finalWithKit + 10_000,
    }));
    fixture.reference.items = fixture.reference.items.map((item) => ({
      ...item,
      appraisal: null,
      progress: null,
    }));
    liveGate = new Promise((resolve) => {
      releaseLive = resolve;
    });
    const snapshotResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/inventory/snapshot",
    );
    await reloadPage("domcontentloaded");
    await (await snapshotResponse).finished();
    await expect.poll(() => inventoryResponses.reference).toBeGreaterThan(0);
    await expect.poll(() => inventoryRequests.live).toBeGreaterThan(0);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    assert.equal(inventoryResponses.live, 0);
    await expect(page.locator(`${root} .investor-stock-results`)).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.locator(`${root} .investor-stock-product-text`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Iniciar proposta com QA-CONT-/ })).toHaveCount(
      0,
    );
    await assertNoProposal();
    releaseLive();
    liveGate = Promise.resolve();
    await expect(page.locator(`${root} .investor-stock-product-text`).first()).toContainText(
      "Estoque vivo QA",
    );
    await selectUnit(0);
    await completeProposal();
    await expect(unitFact("Avaliação bancária")).toHaveText(money.format(350_000));
    await expect(unitFact("Andamento da obra")).toContainText("50");
    await expect(page.locator(`${root} .investor-unit-price strong`)).toHaveText(
      money.format(240_000),
    );
    await assertAnswers(5_000);
    await assertPositivePercentages("% Máximo da renda mensal");
    await expect(page.locator(`${root} .investor-stock-product-text`).first()).toContainText(
      "Estoque vivo QA",
    );
    await expect(page.locator(`${root} .investor-associative-unit-facts`)).toHaveCount(0);
    result.stages.push({
      stage,
      snapshotSelectable: false,
      liveFactsApplied: true,
      calendar: await assertCalendarForUnit(0),
    });

    stage = "missing-live-completion-date";
    fixture = buildInventory(true, true);
    fixture.live.items[0].completionDate = null;
    delete fixture.live.items[1].completionDate;
    await reloadPage();
    await expect(page.locator(`${root} .investor-stock-product-text`)).toHaveCount(2);
    await expect(
      page.locator(`${root} .investor-stock-table td[data-label="Data de término da obra"]`),
    ).toHaveText(["Não informada", "Não informada"]);
    for (let index = 0; index < 2; index += 1) {
      await expect(
        page.getByRole("button", {
          name: `QA-CONT-${index + 1} sem data de término da obra`,
          exact: true,
        }),
      ).toBeDisabled();
    }
    await assertNoProposal();
    result.stages.push({ stage, nullAndAbsentBlocked: true, snapshotDateIgnored: true });

    stage = "live-failure-blocks-calculation";
    fixture = buildInventory(true, true);
    liveStatus = 503;
    page.on("console", onConsole);
    await reloadPage();
    await expect.poll(() => inventoryResponses.reference).toBeGreaterThan(0);
    await expect.poll(() => inventoryResponses.live).toBeGreaterThan(0);
    await expect(page.locator(`${root} .investor-empty-result`)).toContainText(
      "Estoque indisponível.",
    );
    await expect(page.locator(`${root} .investor-stock-product-text`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Iniciar proposta com QA-CONT-/ })).toHaveCount(
      0,
    );
    await assertNoProposal();
    await expect.poll(() => expectedNetworkErrors.length).toBe(1);
    assert.equal(inventoryResponses.live, 1, "Exactly one synthetic 503 response is expected");
    page.off("console", onConsole);
    result.expectedNetworkErrorCount = expectedNetworkErrors.length;
    result.stages.push({ stage, liveStatus, snapshotFallback: false, calculationBlocked: true });
    liveStatus = 200;

    stage = "annual-ledger-reconciliation";
    fixture = buildInventory(true, true);
    for (const source of ["reference", "live"]) {
      fixture[source].items[0].finalPrice = 233444.22;
      fixture[source].items[0].finalWithKit = 233444.22;
      fixture[source].items[0].unitBonus = 0;
      fixture[source].items[0].tableSlack = 0;
    }
    await reloadFixture();
    await completeProposal();
    await field("Entrada").fill("150000");
    await field("Entrada").blur();
    const balance = page.locator(
      `${root} .investor-associative-ledger [aria-label^="Saldo parcelado:"]`,
    );
    const afterResources = page.locator(
      `${root} .investor-associative-ledger [aria-label^="Saldo após recursos:"]`,
    );
    await expect(afterResources).toHaveAttribute(
      "aria-label",
      `Saldo após recursos: ${money.format(43444.22)}`,
    );
    await expect(balance).toHaveAttribute(
      "aria-label",
      `Saldo parcelado: ${money.format(41944.22)}`,
    );
    const originalProSoluto = await rule("% Pró-Soluto").innerText();
    const originalCommitment = await assertPositivePercentages("% Comprometimento da Renda");
    const originalMaximum = await assertPositivePercentages("% Máximo da renda mensal");
    await expect(page.locator(`${root} .investor-associative-documentation`)).toHaveClass(/ready/);
    const documentationTotal = await page
      .locator(`${root} .investor-associative-documentation-summary`)
      .innerText();
    for (let index = 1; index <= 4; index += 1) {
      await page.getByRole("button", { name: "Inserir Anual", exact: true }).click();
      await expect(field(`Anual ${index}`)).toBeVisible();
      if (index > 1) {
        await field(`Anual ${index}`).fill("245000");
        await field(`Anual ${index}`).blur();
        await expect(balance).toHaveAttribute(
          "aria-label",
          `Saldo parcelado: ${money.format(41944.22 - (index - 1) * 2450)}`,
        );
      }
    }
    await expect(balance).toHaveAttribute(
      "aria-label",
      `Saldo parcelado: ${money.format(34594.22)}`,
    );
    await expect(rule("% Pró-Soluto")).toHaveText(originalProSoluto, { useInnerText: true });
    const reducedCommitment = await assertPositivePercentages("% Comprometimento da Renda");
    const reducedMaximum = await assertPositivePercentages("% Máximo da renda mensal");
    const percentValue = (text) => Number(text.replace(/[^\d,.-]/g, "").replace(",", "."));
    for (let index = 0; index < 2; index += 1) {
      assert.ok(percentValue(reducedCommitment[index]) < percentValue(originalCommitment[index]));
      assert.ok(percentValue(reducedMaximum[index]) < percentValue(originalMaximum[index]));
    }
    await expect(page.locator(`${root} .investor-associative-documentation-summary`)).toHaveText(
      documentationTotal,
      { useInnerText: true },
    );
    await expect(rule("Status da proposta")).not.toContainText("PENDENTE");
    await expect(
      page.locator(
        `${root} .simulation-canvas-eyebrow, ${root} .simulation-canvas-description, ${root} .simulation-canvas-status`,
      ),
    ).toHaveCount(0);
    for (let index = 4; index >= 2; index -= 1) {
      await page
        .getByRole("button", { name: `Ocultar Anual ${index} e zerar valor`, exact: true })
        .click();
    }
    await expect(balance).toHaveAttribute(
      "aria-label",
      `Saldo parcelado: ${money.format(41944.22)}`,
    );
    await expect(rule("% Pró-Soluto")).toHaveText(originalProSoluto, { useInnerText: true });
    assert.deepEqual(
      await assertPositivePercentages("% Comprometimento da Renda"),
      originalCommitment,
    );
    result.stages.push({
      stage,
      nominalBalance: 34594.22,
      annualTotal: 7350,
      unchangedProSoluto: true,
      bothFlowsReduced: true,
      documentationUnchanged: true,
      clearedAnnualsRestoreBalance: true,
    });
    assert.equal(result.blockedExternalRequests, 0, "Unexpected external requests were blocked");
    for (const message of expectedNetworkErrors) onExpectedConsoleError(message);
    result.passed = true;
  } catch (error) {
    result.error = `${stage}: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    page.off("console", onConsole);
    releaseLive?.();
    await page.unroute("**/*", handler);
  }
  return result;
}
