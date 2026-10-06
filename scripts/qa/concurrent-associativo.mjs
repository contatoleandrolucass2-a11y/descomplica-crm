import { isDeepStrictEqual } from "node:util";
import { chromium, request as playwrightRequest } from "@playwright/test";

import goldenFixture from "../../tests/fixtures/wf13-reference-golden.json" with { type: "json" };
import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";
import { assertLocalQaEnvironment, inventoryIsolationContract } from "./concurrent-inventory.mjs";
import {
  ConcurrentQaError,
  assertBatchPassed,
  check,
  loopbackOrigin,
  runConcurrentBatch,
} from "./concurrent-core.mjs";

export const simulatorEndpoint = "/api/official-simulator/associativo-fluxo-linear";
const simulatorPage = "/app/simulacao/associativo-fluxo-linear";
const snapshotEndpoint = "/api/inventory/snapshot";
const requestTimeoutMs = 30_000;
const suiteTimeoutMs = 240_000;
const snapshot = JSON.parse(buildSyntheticDirectTableQaSnapshot());

export function syntheticProposal(index) {
  check(Number.isInteger(index) && index >= 0 && index < 20, "invalid_proposal_index");
  const { annual1, annual2, annual3, annual4, annual5, policyConfirmed, policyLimit, ...input } =
    goldenFixture[0].input;
  void [annual1, annual2, annual3, annual4, annual5, policyConfirmed, policyLimit];
  // Fixed day 15 keeps the initial-to-first-payment interval within 30 days.
  const year = new Date().getUTCFullYear();
  return {
    ...input,
    development: snapshot.items[index].project,
    product: snapshot.items[index].product,
    entryDate: `${year}-01-15`,
    constructionEnd: `${year + 3}-12-31`,
    financing: String(240_000 + index * 137),
    entry: String(15_000 + index * 11),
    income: String(10_000 + index * 17),
    ranking: "DIAMANTE",
    cashback: "0",
    cashbackDiscount: "0",
    annuals: [],
    monthlyDueDay: "10",
    signal1Date: "",
    signal2Date: "",
    signal3Date: "",
  };
}

export function assertCalculation(payload, input, baseline) {
  check(
    payload?.schemaVersion === 1 && payload.engineKey === "simulator.wf13",
    "calculation_envelope",
  );
  check(
    typeof payload.correlationId === "string" && /^[a-f0-9-]{36}$/i.test(payload.correlationId),
    "calculation_correlation",
  );
  const result = payload.result;
  check(result?.ok === true && result.errors?.length === 0, "calculation_rejected");
  check(
    result.financing === Number(input.financing) &&
      result.entryAmount === Number(input.entry) &&
      result.realSaleValue === Number(input.salePrice) &&
      result.installments === Number(input.installments),
    "proposal_response_mixed",
  );
  if (baseline) {
    check(
      isDeepStrictEqual(result, baseline.result) &&
        payload.formulaVersion === baseline.formulaVersion &&
        payload.sourceSha256 === baseline.sourceSha256,
      "serial_concurrent_result_mismatch",
    );
    check(payload.correlationId !== baseline.correlationId, "reused_correlation");
  }
}

export async function requestJson(
  client,
  origin,
  pathname,
  {
    method = "GET",
    input,
    expectedStatus = 200,
    expectedError,
    requestOrigin = origin,
    signal,
    inventoryIsolation,
  } = {},
) {
  loopbackOrigin(origin);
  check(
    [simulatorEndpoint, snapshotEndpoint, "/api/inventory"].includes(pathname),
    "endpoint_not_allowed",
  );
  // Even negative live probes require the QA-only server preload: a regression
  // in authorization must not make a test contact the production feed.
  if (pathname === "/api/inventory")
    check(inventoryIsolation === inventoryIsolationContract, "inventory_isolation_required");
  signal?.throwIfAborted();
  let response;
  try {
    response = await client.fetch(`${origin}${pathname}`, {
      method,
      timeout: requestTimeoutMs,
      maxRedirects: 0,
      maxRetries: 0,
      headers: { origin: requestOrigin, accept: "application/json" },
      ...(method === "POST" ? { data: { schemaVersion: 1, input } } : {}),
    });
    check(
      response.status() === expectedStatus,
      `http_status_${response.status()}_expected_${expectedStatus}`,
    );
    check(response.headers()["cache-control"]?.includes("no-store"), "missing_no_store");
    const payload = await response.json();
    if (expectedError)
      check(isDeepStrictEqual(payload, { error: expectedError }), "denial_payload_leaked");
    return payload;
  } finally {
    await response?.dispose();
  }
}

function assertSnapshot(payload) {
  check(
    payload?.sourceKind === "versioned-snapshot" &&
      payload.qaFixture?.synthetic === true &&
      payload.count === snapshot.count &&
      isDeepStrictEqual(payload.items, snapshot.items),
    "snapshot_not_synthetic",
  );
}

function assertSyntheticLiveInventory(payload) {
  check(
    payload?.sourceKind === "live" &&
      payload.qaFixture?.synthetic === true &&
      payload.count === snapshot.count &&
      isDeepStrictEqual(payload.items, snapshot.items),
    "live_inventory_not_synthetic",
  );
}

export function selectConcurrentAccounts(accounts) {
  const masters = accounts.filter((account) => account.role === "master");
  const selected = [
    masters[0],
    masters[1],
    accounts.find((account) => account.role === "broker_house"),
    accounts.find((account) => account.role === "pending"),
  ];
  check(
    selected.every(
      (account) =>
        account &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(account.id) &&
        /^qa\.rls-[a-z_]+-[a-f0-9]+@local\.invalid$/.test(account.email) &&
        typeof account.password === "string" &&
        account.password.length >= 20,
    ),
    "synthetic_accounts_required",
  );
  check(
    new Set(selected.map((account) => account.id)).size === 4 &&
      new Set(selected.map((account) => account.email)).size === 4,
    "distinct_qa_users_required",
  );
  return selected;
}

// Same form/session flow as e2e/release-candidate.spec.ts. No cookie injection,
// storageState cloning or personal browser connection; every login creates a session.
async function login(page, account, origin) {
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  const essential = page.getByRole("button", { name: "Somente essenciais", exact: true });
  if (await essential.isVisible()) await essential.click();
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const expectedHome = account.role === "pending" ? "/conta/seguranca" : "/app";
  await page.waitForURL((url) => url.origin === origin && url.pathname === expectedHome);
  await page.locator("h1").first().waitFor({ state: "visible" });
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function browserStep(stage, action) {
  check(/^[a-z_]+$/u.test(stage), "invalid_browser_stage");
  try {
    return await action();
  } catch (error) {
    if (error instanceof ConcurrentQaError) throw error;
    throw new ConcurrentQaError(`browser_${stage}_failed`);
  }
}

async function fillProposal(page, index, origin) {
  const unit = snapshot.items[index];
  await browserStep("open_simulator", () =>
    page.goto(`${origin}${simulatorPage}`, { waitUntil: "domcontentloaded" }),
  );
  await browserStep("select_project", () =>
    page
      .getByRole("combobox", { name: "Nome do Empreendimento", exact: true })
      .selectOption(unit.project),
  );
  await browserStep("select_unit", () =>
    page
      .getByRole("button", { name: `Iniciar proposta com ${unit.identifier}`, exact: true })
      .click(),
  );
  await browserStep("fill_income", () =>
    page
      .getByRole("textbox", { name: "Renda Familiar", exact: true })
      .fill(String((5_000 + index * 100) * 100)),
  );
  await browserStep("confirm_modality", () =>
    page.getByRole("button", { name: "MCMV", exact: true }).click(),
  );
  await browserStep("first_property", () =>
    page.getByRole("radio", { name: "Sim", exact: true }).check(),
  );
  await browserStep("fill_financing", () =>
    page
      .getByRole("textbox", { name: "Financiamento", exact: true })
      .fill(String((190_000 + index * 1_000) * 100)),
  );
  for (const name of ["Subs\u00eddio", "FGTS", "Cheque Moradia"]) {
    await browserStep("fill_resources", () =>
      page.getByRole("textbox", { name, exact: true }).fill("0"),
    );
  }
  await browserStep("fill_entry", () =>
    page
      .getByRole("textbox", { name: "Entrada", exact: true })
      .fill(String((1_000 + index * 100) * 100)),
  );
  await browserStep("fill_installments", () =>
    page.locator('input[name="quantidade-de-parcelas"]').fill("84"),
  );
  await browserStep("select_ranking", () =>
    page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }).selectOption("gold"),
  );
}

async function assertProposal(page, index, income = 5_000 + index * 100) {
  const values = [
    ["Renda Familiar", income],
    ["Financiamento", 190_000 + index * 1_000],
    ["Entrada", 1_000 + index * 100],
  ];
  for (const [label, value] of values) {
    check(
      (await page.getByRole("textbox", { name: label, exact: true }).inputValue()) === money(value),
      "browser_proposal_mixed",
    );
  }
  await page.getByRole("button", { name: "Proposta pronta - Bora Vender", exact: true }).click();
  const dialog = page.locator("#investor-associative-ready-proposal");
  await dialog.waitFor({ state: "visible" });
  const text = await dialog.innerText();
  check(
    text.includes(snapshot.items[index].identifier) &&
      text.includes(money(190_000 + index * 1_000)),
    "ready_proposal_mixed",
  );
  check(!text.includes(snapshot.items[1 - index].identifier), "foreign_unit_in_proposal");
  await dialog.getByRole("button", { name: "Fechar proposta pronta", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

export function assertIncomeCommitmentRecalculated(before, after, oldIncome, newIncome) {
  check(before.length === 2 && after.length === 2, "income_commitment_missing");
  for (let index = 0; index < 2; index += 1) {
    const previous = Number(before[index].replace("%", "").replace(",", "."));
    const current = Number(after[index].replace("%", "").replace(",", "."));
    // The fixture keeps each schedule fixed; only the income denominator changes.
    check(
      Number.isFinite(previous) &&
        Number.isFinite(current) &&
        previous > 0 &&
        current > 0 &&
        current < previous &&
        Math.abs(current - (previous * oldIncome) / newIncome) <= 0.011,
      "income_commitment_not_recalculated",
    );
  }
}

async function checkAnnualIncomeLimit(page, index) {
  const income = 5_200 + index * 100;
  const annual = page.getByRole("textbox", { name: "Anual 1", exact: true });
  await page.getByRole("button", { name: "Inserir Anual", exact: true }).click();
  await annual.fill(String((income / 2 + 1) * 100));
  // Require both statuses to exist: absent/unmounted results cannot pass a
  // negative assertion. The input must actually retain the over-limit value.
  check((await annual.inputValue()) === money(income / 2 + 1), "annual_limit_input_not_applied");
  await page.waitForFunction(() => {
    const input = document.querySelector('[aria-label="Anual 1"]');
    const statuses = [...document.querySelectorAll(".investor-associative-flow-status")];
    return (
      input?.getAttribute("aria-invalid") === "true" &&
      statuses.length === 2 &&
      statuses.every(
        (status) =>
          !status.classList.contains("approved") && status.textContent?.trim() !== "APROVADO",
      )
    );
  });
  await page.getByRole("button", { name: "Ocultar Anual 1 e zerar valor", exact: true }).click();
}

async function checkLargeInstallmentCount(page) {
  const installments = page.locator('input[name="quantidade-de-parcelas"]');
  await installments.fill("4294967296");
  await page.waitForFunction(() => {
    const input = document.querySelector('input[name="quantidade-de-parcelas"]');
    return (
      input instanceof HTMLInputElement &&
      input.value === "4294967296" &&
      input.getAttribute("aria-invalid") === "true"
    );
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  check(
    (await installments.inputValue()) === "4294967296" &&
      (await installments.getAttribute("aria-invalid")) === "true",
    "large_quantity_silently_changed",
  );
  await installments.fill("84");
  check((await installments.inputValue()) === "84", "large_quantity_recovery_failed");
  await page
    .getByRole("heading", { name: "Simulador Tabela Associativo", exact: true })
    .waitFor({ state: "visible" });
}

export async function runConcurrentAssociativo({
  origin: suppliedOrigin,
  accounts,
  signal,
  inventoryIsolation,
}) {
  const origin = loopbackOrigin(suppliedOrigin);
  assertLocalQaEnvironment();
  const selected = selectConcurrentAccounts(accounts);
  check(inventoryIsolation === inventoryIsolationContract, "inventory_isolation_required");
  const controller = new AbortController();
  const suiteSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), suiteTimeoutMs);
  const report = {
    schemaVersion: 1,
    suite: "concurrent-associativo",
    environment: "local-ci-synthetic",
    status: "running",
    distinctUsers: 4,
    browserSessions: 4,
    authorizedProposalSessions: 2,
    limits: { logicalHttpConcurrency: 20, requestTimeoutMs, suiteTimeoutMs, latencySlo: null },
    measurement:
      "client logical in-flight; nearest-rank p50/p95 including body and assertions; no production capacity claim",
    coverage: {
      http: "real local Next/auth/calculator/synthetic snapshot",
      browserLiveInventory: "real protected endpoint with QA-only loopback synthetic upstream",
      productionUpstream: "not exercised",
      isolation: "two distinct master users; broker_house and pending users denied",
      excluded:
        "real external inventory feed, production throughput, persisted proposals, twenty distinct identities",
    },
    browserErrors: 0,
    browserHttpErrors: 0,
    remoteRequestsBlocked: 0,
    liveInventoryResponses: 0,
    phases: {},
    stage: "setup",
  };
  let browser;
  let anonymous;
  const contexts = [];
  const cleanup = async () => {
    const results = await Promise.allSettled([
      ...contexts.map(async (context) => {
        await context.request.dispose();
        await context.close();
      }),
      anonymous?.dispose(),
    ]);
    await browser?.close();
    check(
      results.every((result) => result.status === "fulfilled"),
      "concurrent_cleanup_failed",
    );
  };
  const onAbort = () => {
    void cleanup().catch(() => {});
  };
  suiteSignal.addEventListener("abort", onAbort, { once: true });
  const batch = async (name, jobs, options = {}) => {
    report.stage = name;
    const result = await runConcurrentBatch(jobs, {
      signal: suiteSignal,
      onTimeout: () => controller.abort(),
      ...options,
    });
    report.phases[name] = result;
    assertBatchPassed(result);
    return result;
  };

  try {
    suiteSignal.throwIfAborted();
    browser = await chromium.launch({ timeout: 30_000 });
    suiteSignal.throwIfAborted();
    anonymous = await playwrightRequest.newContext({ baseURL: origin, timeout: requestTimeoutMs });
    suiteSignal.throwIfAborted();
    const pages = [];
    for (const account of selected) {
      report.stage = `login-session-${contexts.length + 1}`;
      suiteSignal.throwIfAborted();
      const context = await browser.newContext({
        baseURL: origin,
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      contexts.push(context);
      suiteSignal.throwIfAborted();
      context.setDefaultTimeout(45_000);
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (!["data:", "blob:", "about:"].includes(url.protocol) && url.origin !== origin) {
          report.remoteRequestsBlocked += 1;
          await route.abort("blockedbyclient");
        } else {
          await route.continue();
        }
      });
      const page = await context.newPage();
      pages.push(page);
      await login(page, account, origin);
      page.on("pageerror", () => {
        report.browserErrors += 1;
      });
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !/^Failed to load resource: the server responded with a status of (401|403)\b/.test(
            message.text(),
          )
        )
          report.browserErrors += 1;
      });
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/api/inventory" && response.status() === 200)
          report.liveInventoryResponses += 1;
        if (
          response.status() >= 400 &&
          !(
            account.role !== "master" &&
            response.status() === 403 &&
            new URL(response.url()).pathname === simulatorPage
          )
        )
          report.browserHttpErrors += 1;
      });
    }
    const inputs = Array.from({ length: 10 }, (_, index) => syntheticProposal(index));
    const baselines = [];
    await batch(
      "serialReference",
      inputs.map((input, index) => async (operationSignal) => {
        const payload = await requestJson(contexts[index % 2].request, origin, simulatorEndpoint, {
          method: "POST",
          input,
          signal: operationSignal,
        });
        assertCalculation(payload, input);
        baselines[index] = payload;
      }),
      { concurrency: 1 },
    );

    const correlations = new Set();
    const requests = inputs.map((input, index) => async (operationSignal) => {
      const payload = await requestJson(contexts[index % 2].request, origin, simulatorEndpoint, {
        method: "POST",
        input,
        signal: operationSignal,
      });
      assertCalculation(payload, input, baselines[index]);
      check(!correlations.has(payload.correlationId), "reused_correlation");
      correlations.add(payload.correlationId);
    });
    for (const context of contexts.slice(0, 2)) {
      requests.push(async (operationSignal) =>
        assertSyntheticLiveInventory(
          await requestJson(context.request, origin, "/api/inventory", {
            signal: operationSignal,
            inventoryIsolation,
          }),
        ),
      );
      requests.push(async (operationSignal) =>
        assertSnapshot(
          await requestJson(context.request, origin, snapshotEndpoint, { signal: operationSignal }),
        ),
      );
      requests.push(async (operationSignal) => {
        const payload = await requestJson(context.request, origin, simulatorEndpoint, {
          signal: operationSignal,
        });
        check(
          payload.engineKey === "simulator.wf13" && payload.executionEnabled === true,
          "simulator_status_mixed",
        );
      });
    }
    for (const context of contexts.slice(2))
      requests.push((operationSignal) =>
        requestJson(context.request, origin, simulatorEndpoint, {
          method: "POST",
          input: inputs[0],
          expectedStatus: 403,
          expectedError: "forbidden",
          signal: operationSignal,
        }),
      );
    for (const pathname of [snapshotEndpoint, simulatorEndpoint])
      requests.push((operationSignal) =>
        requestJson(anonymous, origin, pathname, {
          expectedStatus: 401,
          expectedError: "unauthenticated",
          signal: operationSignal,
        }),
      );
    const http = await batch("httpBurst", requests);
    check(http.planned === 20 && http.peakInFlight === 20, "http_concurrency_not_reached");

    const negatives = [];
    for (const [client, status, error] of [
      [contexts[2].request, 403, "forbidden"],
      [contexts[3].request, 403, "forbidden"],
      [anonymous, 401, "unauthenticated"],
    ]) {
      for (const pathname of [snapshotEndpoint, simulatorEndpoint, "/api/inventory"])
        negatives.push((operationSignal) =>
          requestJson(client, origin, pathname, {
            expectedStatus: status,
            expectedError: error,
            signal: operationSignal,
            inventoryIsolation,
          }),
        );
      negatives.push((operationSignal) =>
        requestJson(client, origin, simulatorEndpoint, {
          method: "POST",
          input: inputs[0],
          expectedStatus: status,
          expectedError: error,
          signal: operationSignal,
        }),
      );
    }
    for (const context of contexts.slice(0, 2)) {
      negatives.push((operationSignal) =>
        requestJson(context.request, origin, simulatorEndpoint, {
          method: "POST",
          input: {},
          expectedStatus: 422,
          expectedError: "input_rejected",
          signal: operationSignal,
        }),
      );
      negatives.push((operationSignal) =>
        requestJson(context.request, origin, simulatorEndpoint, {
          method: "POST",
          input: inputs[0],
          requestOrigin: "http://localhost:1",
          expectedStatus: 403,
          expectedError: "invalid_origin",
          signal: operationSignal,
        }),
      );
    }
    await batch("negativeAuthorizationAndInput", negatives);
    await batch(
      "browserContexts",
      pages.map((page, index) => async () => {
        if (index < 2) await fillProposal(page, index, origin);
        else {
          await page.goto(`${origin}${simulatorPage}`, { waitUntil: "domcontentloaded" });
          await page
            .getByRole("heading", {
              name: "Voc\u00ea n\u00e3o possui acesso a esta p\u00e1gina",
              exact: true,
            })
            .waitFor({ state: "visible" });
          check(
            (await page.locator('input[name="quantidade-de-parcelas"]').count()) === 0,
            "denied_browser_rendered_proposal",
          );
        }
      }),
      { concurrency: 4, timeoutMs: 90_000 },
    );
    await batch(
      "proposalIsolation",
      pages.slice(0, 2).map((page, index) => async () => {
        await assertProposal(page, index);
        const commitment = page
          .locator(".investor-associative-approval tbody tr")
          .filter({ hasText: "% Comprometimento da Renda" })
          .locator('td[data-label="Linear"], td[data-label="Decrescente"]');
        const previousCommitment = await commitment.allTextContents();
        await page
          .getByRole("textbox", { name: "Renda Familiar", exact: true })
          .fill(String((5_200 + index * 100) * 100));
        await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).blur();
        check(
          (await page
            .getByRole("button", { name: "MCMV", exact: true })
            .getAttribute("aria-pressed")) === "true",
          "income_edit_reset_modality",
        );
        check(
          await page.getByRole("radio", { name: "Sim", exact: true }).isChecked(),
          "income_edit_reset_first_property",
        );
        const ranking = page.getByRole("combobox", { name: "Selecione o Ranking", exact: true });
        check((await ranking.inputValue()) === "gold", "income_edit_reset_ranking");
        assertIncomeCommitmentRecalculated(
          previousCommitment,
          await commitment.allTextContents(),
          5_000 + index * 100,
          5_200 + index * 100,
        );
        check(
          (await page
            .getByRole("button", { name: "Proposta pronta - Bora Vender", exact: true })
            .count()) === 1,
          "income_edit_lost_ready_proposal",
        );
      }),
      { concurrency: 2, timeoutMs: 90_000 },
    );
    // Barrier after both edits: a shared mutable proposal cannot pass by timing luck.
    await batch(
      "proposalAfterConcurrentEdits",
      pages
        .slice(0, 2)
        .map((page, index) => () => assertProposal(page, index, 5_200 + index * 100)),
      { concurrency: 2, timeoutMs: 90_000 },
    );
    await batch(
      "annualAboveHalfIncome",
      pages.slice(0, 2).map((page, index) => () => checkAnnualIncomeLimit(page, index)),
      { concurrency: 2, timeoutMs: 90_000 },
    );
    await batch(
      "largeInstallmentCount",
      pages
        .slice(0, 2)
        .map(
          (page) => () =>
            browserStep("large_installment_count", () => checkLargeInstallmentCount(page)),
        ),
      { concurrency: 2, timeoutMs: 90_000 },
    );
    check(report.liveInventoryResponses >= 2, "local_live_inventory_not_exercised");
    check(
      report.remoteRequestsBlocked === 0 &&
        report.browserErrors === 0 &&
        report.browserHttpErrors === 0,
      "browser_errors_detected",
    );
    suiteSignal.throwIfAborted();
    report.status = "passed";
    report.stage = "complete";
  } catch (error) {
    report.status = "failed";
    report.failureCode =
      error instanceof ConcurrentQaError
        ? error.code
        : suiteSignal.aborted
          ? "suite_cancelled_or_timed_out"
          : "browser_or_setup_failed";
  } finally {
    clearTimeout(timer);
    suiteSignal.removeEventListener("abort", onAbort);
    try {
      await cleanup();
    } catch {
      report.status = "failed";
      report.cleanupFailure = true;
    }
    process.stdout.write(`Concurrent QA: ${JSON.stringify(report)}\n`);
  }
  check(report.status === "passed", "concurrent_associativo_failed");
  return report;
}
