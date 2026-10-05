import assert from "node:assert/strict";
import { expect as baseExpect } from "@playwright/test";
import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";

const root = ".investor-associative-table-page";
const approval = `${root} .investor-associative-approval`;
const expect = baseExpect.configure({ timeout: 30_000 });

function buildInventory(withProgress, withAppraisal) {
  const base = JSON.parse(buildSyntheticDirectTableQaSnapshot()).items[0];
  const items = [0, 1].map((index) => ({
    ...base,
    id: `qa-continuity-reference-${index}`,
    identifier: `QA-CONT-${index + 1}`,
    project: "Empreendimento QA Continuidade",
    product: `Apartamento QA-CONT-${index + 1} - Referencia QA`,
    finalWithKit: 340_000 + index * 20_000,
    finalPrice: 230_000 + index * 20_000,
    appraisal: withAppraisal ? 350_000 + index * 20_000 : null,
    progress: withProgress ? 0.5 + index * 0.05 : null,
    completionDate: `${new Date().getFullYear() + 3}-12-31`,
  }));
  const reference = {
    source: "ESTOQUE SPC.xlsx",
    sourceKind: "versioned-snapshot",
    qaFixture: { synthetic: true, contract: "associative-calculation-continuity-v3" },
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
        completionDate: null,
      })),
    },
  };
}

export async function checkAssociativeCalculationContinuity(page) {
  const origin = new URL(page.url());
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname),
    "Continuity QA requires a local synthetic application",
  );
  const result = {
    contract: "associative-calculation-continuity-v3",
    synthetic: true,
    passed: false,
    stages: [],
    blockedExternalRequests: 0,
  };
  let stage = "inventory-merge";
  let fixture = buildInventory(true, true);
  let inventoryRequests = { live: 0, reference: 0 };
  let liveGate = Promise.resolve();
  let releaseLive;
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
    if (source === "live") await liveGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(fixture[source]),
    });
  };
  const field = (label) =>
    page.locator(`${root} input`).and(page.getByLabel(label, { exact: true }));
  const qualification = page.locator(`${root} .investor-associative-qualification`);
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

  async function reloadFixture() {
    inventoryRequests = { live: 0, reference: 0 };
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload({ waitUntil: "networkidle" });
    await restoreTheme(theme);
    await expect(page.locator(`${root} .investor-stock-product-text`).first()).toContainText(
      "Estoque vivo QA",
    );
    assert.ok(inventoryRequests.live > 0 && inventoryRequests.reference > 0);
    await selectUnit(0);
  }

  async function completeProposal() {
    await field("Renda Familiar").fill("500000");
    await field("Renda Familiar").blur();
    await qualification.getByRole("button", { name: "MCMV", exact: true }).click();
    await qualification.getByRole("radio", { name: "Sim", exact: true }).check();
    for (const { label, amount, next } of resources) {
      await expect
        .poll(async () => {
          const input = field(label);
          if (!(await input.isEnabled())) return null;
          await input.fill(String(amount * 100));
          await input.blur();
          return moneyValue(label);
        })
        .toBe(amount);
      await expect(field(next)).toBeEnabled();
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
    await expect(unitFact("Avaliação bancária")).toHaveText(money.format(350_000));
    await expect(unitFact("Andamento da obra")).toContainText("50");
    await completeProposal();
    await assertAnswers(5_000);
    result.stages.push({
      stage,
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
    result.stages.push({
      stage,
      commitment: await assertPositivePercentages("% Comprometimento da Renda"),
    });

    stage = "missing-progress";
    fixture = buildInventory(false, true);
    await reloadFixture();
    await expect(unitFact("Andamento da obra")).toHaveText("Não informado");
    await completeProposal();
    const commitment = await assertPositivePercentages("% Comprometimento da Renda");
    for (const flow of ["Linear", "Decrescente"]) {
      await expect(rule("% Máximo da renda mensal").locator(`td[data-label="${flow}"]`)).toHaveText(
        "—",
      );
    }
    await expect(
      page.locator(`${approval} .investor-associative-flow-status.approved`),
    ).toHaveCount(0);
    result.stages.push({ stage, commitment, maximumAvailable: false, approved: false });

    stage = "official-progress-recovery";
    const progress = page.getByLabel("Andamento oficial da obra (%)", { exact: true });
    for (const percentage of ["0", "15", "100"]) {
      await progress.fill(percentage);
      await assertPositivePercentages("% Máximo da renda mensal");
      await expect(rule("Status da proposta")).not.toContainText("PENDENTE");
    }
    await progress.fill("101");
    await expect(progress).toHaveAttribute("aria-invalid", "true");
    await expect(rule("% Máximo da renda mensal").locator('td[data-label="Linear"]')).toHaveText(
      "—",
    );
    await progress.fill("15");
    await selectUnit(1);
    await assertAnswers(5_000);
    await expect(progress).toHaveValue("");
    await expect(rule("% Máximo da renda mensal").locator('td[data-label="Linear"]')).toHaveText(
      "—",
    );
    result.stages.push({
      stage,
      percentages: [0, 15, 100],
      invalidBlocked: true,
      unitIsolation: true,
    });

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
    await expect(unitFact("Avaliação bancária")).toHaveText("Não informada");
    await selectUnit(1);
    await assertAnswers(5_000);
    await expect(field("Avaliação bancária oficial da unidade")).toHaveValue("");
    await expect(documentation).toHaveClass(/waiting/);
    result.stages.push({
      stage,
      calculationRecovered: true,
      inventoryUnchanged: true,
      unitIsolation: true,
    });

    stage = "late-reference-facts";
    fixture = buildInventory(true, true);
    fixture.live.items = fixture.live.items.map((item, index) => ({
      ...item,
      appraisal: fixture.reference.items[index].appraisal,
      progress: fixture.reference.items[index].progress,
      completionDate: fixture.reference.items[index].completionDate,
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
    const lateTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await restoreTheme(lateTheme);
    await expect(page.locator(`${root} .investor-stock-product-text`).first()).toContainText(
      "Referencia QA",
    );
    await selectUnit(0);
    await completeProposal();
    await expect(rule("% Máximo da renda mensal").locator('td[data-label="Linear"]')).toHaveText(
      "—",
    );
    releaseLive();
    await expect(unitFact("Avaliação bancária")).toHaveText(money.format(350_000));
    await expect(unitFact("Andamento da obra")).toContainText("50");
    await expect(page.locator(`${root} .investor-unit-price strong`)).toHaveText(
      money.format(230_000),
    );
    await assertAnswers(5_000);
    await assertPositivePercentages("% Máximo da renda mensal");
    await expect(page.locator(`${root} .investor-stock-product-text`).first()).toContainText(
      "Referencia QA",
    );
    await expect(page.locator(`${root} .investor-associative-unit-facts`)).toHaveCount(0);
    result.stages.push({ stage, automaticRecovery: true, proposalPreserved: true });
    assert.equal(result.blockedExternalRequests, 0, "Unexpected external requests were blocked");
    result.passed = true;
  } catch (error) {
    result.error = `${stage}: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    releaseLive?.();
    await page.unroute("**/*", handler);
  }
  return result;
}
