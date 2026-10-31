import assert from "node:assert/strict";
import { expect } from "@playwright/test";

const charts = [
  { id: "appointments-today-comparison", title: "Previstos e realizados hoje" },
  { id: "appointments-weekly", title: "Agendamentos por semana" },
];

export async function runAppointmentsFirstSave({ page, origin, evidence }) {
  page.on("dialog", (dialog) => dialog.accept());
  evidence.firstSave = [];
  const requests = [];
  let holdNextResponse = false;
  let releaseResponse;
  let failureStatus = null;
  await page.setViewportSize({ width: 1265, height: 578 });
  await page.route("**/api/dashboard-profiles/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    requests.push(route.request().postDataJSON());
    if (failureStatus) {
      const status = failureStatus;
      failureStatus = null;
      return route.fulfill({ status, json: { error: "synthetic_failure" } });
    }
    const response = await route.fetch();
    if (holdNextResponse) {
      holdNextResponse = false;
      await new Promise((resolve) => {
        releaseResponse = resolve;
        setTimeout(resolve, 20_000).unref();
      });
    }
    await route.fulfill({ response });
  });
  const card = (chart) => page.locator(`[data-dashboard-card-id="${chart.id}"]`);
  const read = (chart) =>
    card(chart).evaluate((element) => ({
      width: element.style.width,
      height: element.style.height,
    }));
  async function open(chart) {
    await card(chart)
      .getByRole("button", { name: `Editar ${chart.title}`, exact: true })
      .press("Enter");
    return page.getByRole("dialog");
  }
  async function enter(chart, width, height) {
    const dialog = await open(chart);
    await dialog.getByLabel("Largura do card", { exact: false }).fill(String(width));
    await dialog.getByLabel("Altura do card", { exact: false }).fill(String(height));
    return dialog;
  }
  async function reloadAndCheck(chart, width, height) {
    await page.reload();
    await expect.poll(() => read(chart)).toEqual({ width: `${width}px`, height: `${height}px` });
    const dialog = await open(chart);
    await expect(dialog.getByLabel("Largura do card", { exact: false })).toHaveValue(String(width));
    await expect(dialog.getByLabel("Altura do card", { exact: false })).toHaveValue(String(height));
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  }
  await page.goto(`${origin}?editable`);
  await page.getByRole("button", { name: "House", exact: true }).click();
  await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");

  for (const [index, chart] of charts.entries()) {
    const width = 397 + index * 100;
    const height = 417 + index * 40;
    const before = requests.length;
    const dialog = await enter(chart, width, height);
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    assert.equal(requests.length, before + 1, "One confirmation must send exactly one PATCH");
    await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
    // No debounce wait: closing the editor must already mean server acknowledgement.
    await reloadAndCheck(chart, width, height);
    evidence.firstSave.push({
      scenario: "one-confirmation-immediate-reload",
      chart: chart.title,
      width,
      height,
    });
  }

  // An autosave from a corner/keyboard resize can still be in flight when the editor opens.
  const beforeQueue = requests.length;
  holdNextResponse = true;
  await card(charts[0])
    .getByRole("button", { name: `Redimensionar ${charts[0].title}`, exact: true })
    .press("ArrowDown");
  await expect.poll(() => Boolean(releaseResponse)).toBe(true);
  const dialog = await enter(charts[1], 503, 463);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Salvando…", exact: true })).toBeDisabled();
  await expect(dialog.getByLabel("Largura do card", { exact: false })).toBeDisabled();
  await expect(dialog.getByLabel("Altura do card", { exact: false })).toBeDisabled();
  assert.equal(requests.length, beforeQueue + 1, "Do not send a stale concurrent version");
  releaseResponse();
  releaseResponse = undefined;
  await expect(dialog).toHaveCount(0);
  assert.equal(requests.length, beforeQueue + 2);
  assert.equal(requests.at(-1).version, requests.at(-2).version + 1);
  await reloadAndCheck(charts[1], 503, 463);
  evidence.firstSave.push({
    scenario: "queued-after-in-flight-autosave",
    width: 503,
    height: 463,
    consecutiveVersions: true,
  });

  failureStatus = 503;
  const failed = await enter(charts[1], 507, 467);
  await failed.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(failed.getByRole("alert")).toContainText("Sua edição foi mantida");
  await expect(failed.getByLabel("Largura do card", { exact: false })).toHaveValue("507");
  await expect(failed.getByLabel("Altura do card", { exact: false })).toHaveValue("467");
  await expect(failed.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
  await failed.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(failed).toHaveCount(0);
  await reloadAndCheck(charts[1], 507, 467);
  evidence.firstSave.push({
    scenario: "server-error-retains-draft-and-allows-retry",
    width: 507,
    height: 467,
  });

  const peer = await page
    .context()
    .browser()
    .newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
      viewport: { width: 1265, height: 578 },
    });
  try {
    await peer.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.externalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const other = await peer.newPage();
    other.setDefaultTimeout(15_000);
    other.setDefaultNavigationTimeout(20_000);
    other.on("dialog", (dialog) => dialog.accept());
    other.on("pageerror", (error) => evidence.browserErrors.push(error.message));
    other.on("console", (message) => {
      if (message.type() === "error") evidence.browserErrors.push(message.text());
    });
    const peerRequests = [];
    other.on("response", async (response) => {
      if (!response.url().includes("/api/dashboard-profiles")) return;
      const request = response.request();
      peerRequests.push({
        method: request.method(),
        status: response.status(),
        ...(request.method() === "PATCH" ? { version: request.postDataJSON().version } : {}),
      });
    });
    const snapshot = (target) =>
      target.locator("article[data-dashboard-card-id]").evaluateAll((elements) =>
        elements.map((element) => ({
          id: element.getAttribute("data-dashboard-card-id"),
          width: element.style.width,
          height: element.style.height,
        })),
      );
    async function editIn(target, item, width, height) {
      await target
        .locator(`[data-dashboard-card-id="${item.id}"]`)
        .getByRole("button", { name: `Editar ${item.title}`, exact: true })
        .press("Enter");
      const dialog = target.getByRole("dialog");
      await dialog.getByLabel("Largura do card", { exact: false }).fill(String(width));
      await dialog.getByLabel("Altura do card", { exact: false }).fill(String(height));
      await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
      return dialog;
    }
    await other.goto(`${origin}?editable`);
    await other.getByRole("button", { name: "House", exact: true }).click();
    await expect.poll(() => snapshot(other)).toEqual(await snapshot(page));

    const visits = { id: "visits-total", title: "Visitas realizadas" };
    const savedA = await editIn(page, visits, 283, 347);
    await expect(savedA).toHaveCount(0);
    await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
    // B still owns the prior version. Combine reorder and editor dimensions in one save.
    await other
      .locator(`[data-dashboard-card-id="${charts[1].id}"]`)
      .getByRole("button", { name: `Mover ${charts[1].title}`, exact: true })
      .press("ArrowUp");
    const savedB = await editIn(other, charts[1], 519, 479);
    await expect(savedB).toHaveCount(0);
    await expect(other.getByRole("toolbar")).toContainText("Salvo automaticamente");
    const expected = await snapshot(other);
    assert.deepEqual(
      expected.find(({ id }) => id === visits.id),
      {
        id: visits.id,
        width: "283px",
        height: "347px",
      },
      "Rebase must retain the other session's saved card dimensions",
    );
    assert.deepEqual(
      expected.find(({ id }) => id === charts[1].id),
      {
        id: charts[1].id,
        width: "519px",
        height: "479px",
      },
    );
    const casResponses = [...peerRequests];
    const conflictIndex = casResponses.findIndex(
      ({ method, status }) => method === "PATCH" && status === 409,
    );
    assert.ok(conflictIndex >= 0, "Synthetic server must reject the stale CAS version");
    assert.ok(
      casResponses
        .slice(conflictIndex + 1)
        .some(({ method, status }) => method === "GET" && status === 200),
    );
    const retried = casResponses
      .slice(conflictIndex + 1)
      .find(({ method, status }) => method === "PATCH" && status === 200);
    assert.ok(retried, "Disjoint edits must be retried after fetching the latest profile");
    assert.equal(retried.version, casResponses[conflictIndex].version + 1);
    await page.reload();
    await other.reload();
    await expect.poll(() => snapshot(page)).toEqual(expected);
    await expect.poll(() => snapshot(other)).toEqual(expected);
    evidence.firstSave.push({
      scenario: "two-context-disjoint-dimensions-and-order-cas-rebase",
      cards: expected,
      requests: casResponses,
    });

    // Both contexts now share a base. Competing writes to the SAME field must not overwrite.
    await expect(await editIn(page, charts[1], 527, 479)).toHaveCount(0);
    const beforeRealConflict = peerRequests.length;
    const conflicting = await editIn(other, charts[1], 531, 479);
    await expect(conflicting.getByRole("alert")).toContainText("mudou em outra sessão");
    await expect(conflicting.getByLabel("Largura do card", { exact: false })).toHaveValue("531");
    assert.equal(
      peerRequests.slice(beforeRealConflict).filter(({ method }) => method === "PATCH").length,
      1,
      "A real same-field conflict must not be retried or overwrite the remote value",
    );
    await conflicting.getByRole("button", { name: "Cancelar", exact: true }).click();
    const beforeBlockedEdit = peerRequests.filter(({ method }) => method === "PATCH").length;
    await other
      .locator(`[data-dashboard-card-id="${charts[1].id}"]`)
      .getByRole("button", { name: `Redimensionar ${charts[1].title}`, exact: true })
      .press("ArrowDown");
    // The debounce must elapse to prove a new edit cannot silently bypass a real conflict.
    await other.waitForTimeout(1_000);
    assert.equal(
      peerRequests.filter(({ method }) => method === "PATCH").length,
      beforeBlockedEdit,
      "Further local edits must not overwrite remote state before resolving the conflict",
    );
    await expect(other.getByRole("toolbar")).toContainText("Conflito automaticamente");
    await other.reload();
    await expect.poll(() => snapshot(other)).toEqual(await snapshot(page));
    assert.equal((await snapshot(other)).find(({ id }) => id === charts[1].id).width, "527px");
    evidence.firstSave.push({
      scenario: "two-context-same-field-conflict-preserves-remote-and-draft",
      persistedWidth: 527,
      draftWidth: 531,
      furtherEditsBlockedUntilReload: true,
    });
  } finally {
    await peer.close();
  }
  assert.ok(
    evidence.browserErrors.every((message) =>
      /^Failed to load resource: the server responded with a status of (503|409) /u.test(message),
    ),
    `Only deliberate HTTP failures are expected: ${JSON.stringify(evidence.browserErrors)}`,
  );
  evidence.expectedHttpFailures = [503, 409];
  assert.equal(evidence.externalRequests.length, 0);
}
