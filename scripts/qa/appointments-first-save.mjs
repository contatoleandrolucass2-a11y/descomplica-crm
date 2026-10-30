import assert from "node:assert/strict";
import { expect } from "@playwright/test";

const charts = [
  { id: "appointments-today-comparison", title: "Previstos e realizados hoje" },
  { id: "appointments-weekly", title: "Agendamentos por semana" },
];

export async function runAppointmentsFirstSave({ page, origin, evidence }) {
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

  failureStatus = 409;
  const conflicting = await enter(charts[1], 509, 469);
  const beforeConflict = requests.length;
  await conflicting.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(conflicting.getByRole("alert")).toContainText("mudou em outra sessão");
  assert.equal(requests.length, beforeConflict + 1, "Do not retry conflicts automatically");
  await expect(conflicting.getByLabel("Largura do card", { exact: false })).toHaveValue("509");
  await conflicting.getByRole("button", { name: "Cancelar", exact: true }).click();
  await reloadAndCheck(charts[1], 507, 467);
  evidence.firstSave.push({
    scenario: "conflict-preserves-remote-and-draft",
    persistedWidth: 507,
    draftWidth: 509,
  });
  assert.deepEqual(
    evidence.browserErrors,
    [
      "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
      "Failed to load resource: the server responded with a status of 409 (Conflict)",
    ],
    "Only the two deliberately injected HTTP failures are expected",
  );
  evidence.expectedHttpFailures = [503, 409];
  assert.equal(evidence.externalRequests.length, 0);
}
