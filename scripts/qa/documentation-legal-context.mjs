import { expect } from "@playwright/test";

export const legalConfirmationLabel =
  "Conferi as bases, as datas e o enquadramento fiscal com os documentos da compra.";

export async function openDocumentationLegalContext(scope) {
  const disclosure = scope.locator("details[data-documentation-legal]");
  await expect(disclosure).toHaveCount(1);
  if (!(await disclosure.evaluate((element) => element.open)))
    await disclosure.locator(":scope > summary").click();
  await expect(disclosure).toHaveJSProperty("open", true);
}

export async function checkDocumentationHiddenRequiredField(scope) {
  const disclosure = scope.locator("details[data-documentation-legal]");
  const summary = disclosure.locator(":scope > summary");
  if (await disclosure.evaluate((element) => element.open)) await summary.click();
  const required = disclosure.locator(":is(input, select):required:invalid").first();
  await expect(required).toHaveCount(1);
  await expect(required).toHaveAttribute("required", "");
  await expect(required).toBeHidden();
  expect(await required.evaluate((element) => element.reportValidity())).toBe(false);
  await expect(disclosure).toHaveJSProperty("open", true);
  await expect(required).toBeVisible();
  await expect(required).toBeFocused();
}

// Synthetic contract declarations, independent of the simulator's commercial profile.
export async function fillDocumentationLegalContext(scope, overrides = {}) {
  await openDocumentationLegalContext(scope);
  const context = {
    municipality: "sao-paulo-sp",
    transactionDate: "2026-10-02",
    financingContractDate: "2026-10-01",
    registrationDate: "2026-10-10",
    registryTable: "ARISP_2",
    specialRegime: "NONE",
    naturalPerson: "SIM",
    residential: "SIM",
    firstAcquisition: "SIM",
    program: "MCMV",
    financingSystem: "SFH",
    funding: "OTHER",
    firstTransfer: "",
    iptuValue: 0,
    ...overrides,
  };
  for (const [key, label] of [
    ["municipality", "Município do imóvel"],
    ["registryTable", "Tabela de registro conferida"],
    ["naturalPerson", "Pessoa física?"],
    ["residential", "Imóvel residencial?"],
    ["firstAcquisition", "Primeira aquisição imobiliária?"],
    ["program", "Programa habitacional"],
    ["financingSystem", "Sistema de financiamento"],
    ["funding", "Origem dos recursos do financiamento"],
    ["specialRegime", "Outros benefícios fiscais ou de registro?"],
  ]) {
    await scope.getByLabel(label, { exact: true }).selectOption(context[key]);
  }
  await scope
    .getByLabel("Data da transmissão (ITBI)", { exact: true })
    .fill(context.transactionDate);
  await scope
    .getByLabel("Data do contrato de financiamento", { exact: true })
    .fill(context.financingContractDate);
  await scope.getByLabel("Data do registro", { exact: true }).fill(context.registrationDate);
  if (context.funding === "FGTS") {
    await scope
      .getByLabel("Primeira transmissão?", { exact: true })
      .selectOption(context.firstTransfer);
  }
  if (context.itbiBase !== undefined) {
    await scope
      .getByLabel("Base de cálculo do ITBI (R$)", { exact: true })
      .fill(String(Math.round(context.itbiBase * 100)));
  }
  await scope
    .getByLabel("Valor venal do IPTU (R$)", { exact: true })
    .fill(String(Math.round(context.iptuValue * 100)));
  await scope.getByLabel(legalConfirmationLabel, { exact: true }).check();
  const confirmedBase = await scope
    .getByLabel("Base de cálculo do ITBI (R$)", { exact: true })
    .inputValue();
  return {
    ...context,
    itbiBase: Number(confirmedBase.replace(/\./g, "").replace(",", ".")),
    basesConfirmed: true,
  };
}
