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
    qaFixture: { synthetic: true, contract: "associative-calculation-continuity-v1" },
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
    contract: "associative-calculation-continuity-v1",
    synthetic: true,
    passed: false,
    stages: [],
    blockedExternalRequests: 0,
  };
  let stage = "inventory-merge";
  let fixture = buildInventory(true, true);
  let inventoryRequests = { live: 0, reference: 0 };
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
  const moneyValue = async (label) =>
    Number((await field(label).inputValue()).replace(/\D/g, "")) / 100;
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const selectUnit = (index) =>
    page
      .getByRole("button", {
        name: `Iniciar proposta com QA-CONT-${index + 1}`,
        exact: true,
      })
      .click();
  const resources = {
    Financiamento: 190_000,
    Subsídio: 0,
    FGTS: 0,
    "Cheque Moradia": 0,
    Entrada: 1_000,
  };

  async function reloadFixture() {
    inventoryRequests = { live: 0, reference: 0 };
    await page.reload({ waitUntil: "networkidle" });
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
    for (const [label, amount] of Object.entries(resources)) {
      await field(label).fill(String(amount * 100));
      await field(label).blur();
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
    for (const [label, amount] of Object.entries(resources)) {
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

    stage = "missing-appraisal";
    fixture = buildInventory(true, false);
    await reloadFixture();
    await expect(unitFact("Avaliação bancária")).toHaveText("Não informada");
    result.stages.push({ stage, appraisalAvailable: false });
    assert.equal(result.blockedExternalRequests, 0, "Unexpected external requests were blocked");
    result.passed = true;
  } catch (error) {
    result.error = `${stage}: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    await page.unroute("**/*", handler);
  }
  return result;
}
