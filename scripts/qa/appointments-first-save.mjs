import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
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

  // Pixel caps share one quantitative ruler and never edit the card layout.
  const barChart = charts[1];
  const dimensionsBeforeCap = await read(barChart);
  const order = () =>
    page
      .locator("article[data-dashboard-card-id]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-dashboard-card-id")),
      );
  const orderBeforeCap = await order();
  const geometry = (target = card(barChart)) =>
    target.locator('[style*="--bar-height"]').evaluateAll((tracks) =>
      tracks.map((track) => {
        const bar = track.querySelector(":scope > div");
        const value = track.querySelector('[class*="columnValue"]');
        const goal = track.querySelector('[title^="Meta:"]');
        return {
          value: Number(value.textContent.replace(/\./gu, "").replace(",", ".")),
          height: bar.getBoundingClientRect().height,
          trackHeight: track.getBoundingClientRect().height,
          labelBottom: Number.parseFloat(getComputedStyle(value).bottom),
          goal: goal
            ? Number(goal.title.replace("Meta: ", "").replace(/\./gu, "").replace(",", "."))
            : null,
          goalBottom: goal ? Number.parseFloat(getComputedStyle(goal).bottom) : null,
        };
      }),
    );
  function checkGeometry(bars, cap) {
    assert.ok(
      bars.some(({ value }) => value > 0),
      "Synthetic bars must contain quantitative data",
    );
    const positiveBars = bars.filter(({ value }) => value > 0);
    const largest = positiveBars.reduce((best, current) =>
      current.value > best.value ? current : best,
    );
    assert.ok(largest.height > 0, "Nonzero data must remain visible");
    const pixelsPerUnit = largest.height / largest.value;
    for (const bar of bars) {
      assert.ok(bar.height <= cap + 1, `Bar ${bar.value} exceeds ${cap}px cap: ${bar.height}`);
      assert.ok(bar.height <= bar.trackHeight + 1, "Bar remains inside available plot height");
      if (bar.value > 0) {
        assert.ok(
          Math.abs(bar.height - bar.value * pixelsPerUnit) < 1,
          "Bars share the same pixels-per-unit ruler",
        );
        assert.ok(Math.abs(bar.labelBottom - bar.height) < 1, "Value label follows its bar");
        if (bar.goal != null)
          assert.ok(
            Math.abs(bar.goalBottom - bar.goal * pixelsPerUnit) < 1,
            "Goal marker shares the bar ruler",
          );
      }
    }
  }
  const proofDirectory = path.resolve("test-results/appointments-bar-height-pixels");
  await mkdir(proofDirectory, { recursive: true });
  async function savePixelCap(chart, value, target = page) {
    const article = target.locator(`[data-dashboard-card-id="${chart.id}"]`);
    await article
      .getByRole("button", { name: `Ajustar altura das torres de ${chart.title}`, exact: true })
      .press("Enter");
    const editor = target.getByRole("dialog", { name: "Altura das torres", exact: true });
    const input = editor.getByLabel("Altura máxima das torres (px)", { exact: true });
    await expect(input).toBeFocused();
    await expect(input).not.toHaveAttribute("max", /.+/u);
    await expect(editor.getByLabel("Largura do card", { exact: false })).toHaveCount(0);
    await expect(editor.getByRole("slider")).toHaveCount(0);
    await input.fill(value);
    await editor.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(target.getByRole("toolbar")).toContainText("Salvo automaticamente");
  }
  // Existing percentage layouts remain intact when only an unrelated editor field changes.
  const { profiles: legacyProfiles } = await (
    await page.request.get(`${origin}/api/dashboard-profiles`)
  ).json();
  const legacyProfile = legacyProfiles.find((profile) =>
    profile.cards.some((entry) => entry.id === barChart.id),
  );
  assert.ok(legacyProfile);
  const legacyCards = legacyProfile.cards.map((entry) =>
    entry.id === barChart.id
      ? {
          ...entry,
          presentation: { ...entry.presentation, barScale: 0.65 },
        }
      : entry,
  );
  const seedLegacy = await page.request.patch(
    `${origin}/api/dashboard-profiles/${legacyProfile.id}`,
    { data: { version: legacyProfile.version, cards: legacyCards } },
  );
  assert.equal(seedLegacy.status(), 200);
  await page.reload();
  await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
  const legacyGeometry = await geometry();
  const beforeTitleSave = requests.length;
  const legacyEditor = await open(barChart);
  await expect(
    legacyEditor.getByLabel("Altura máxima das torres (px)", { exact: true }),
  ).toHaveValue("");
  await legacyEditor.getByLabel("Título", { exact: true }).fill(`${barChart.title} QA`);
  await legacyEditor.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(legacyEditor).toHaveCount(0);
  assert.equal(requests.length, beforeTitleSave + 1);
  const afterTitle = requests.at(-1).cards.find((entry) => entry.id === barChart.id);
  assert.equal(afterTitle.presentation.barScale, 0.65);
  assert.equal(afterTitle.presentation.barMaxHeight, undefined);
  await page.reload();
  await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
  assert.deepEqual(await read(barChart), dimensionsBeforeCap);
  assert.deepEqual(
    (await geometry()).map(({ height }) => height),
    legacyGeometry.map(({ height }) => height),
  );
  await card(barChart)
    .getByRole("button", { name: `Editar ${barChart.title} QA`, exact: true })
    .press("Enter");
  const restoreTitle = page.getByRole("dialog");
  await restoreTitle.getByLabel("Título", { exact: true }).fill(barChart.title);
  await restoreTitle.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(restoreTitle).toHaveCount(0);
  evidence.firstSave.push({
    scenario: "legacy-percentage-preserved-on-title-only-edit",
    scale: 0.65,
    dimensionsBeforeCap,
  });

  // A chart without goal headroom demonstrates the exact requested pixel height.
  const noGoalChart = { id: "ranking-score", title: "Ranking Score" };
  const noGoalDimensions = await read(noGoalChart);
  for (const cap of [24, 240]) {
    const beforeExactCap = requests.length;
    await savePixelCap(noGoalChart, String(cap));
    assert.equal(requests.length, beforeExactCap + 1);
    await page.reload();
    await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
    const exactBars = await geometry(card(noGoalChart));
    assert.ok(
      exactBars.every(({ goal }) => goal == null),
      "This fixture chart has no goal headroom",
    );
    checkGeometry(exactBars, cap);
    assert.ok(
      Math.abs(Math.max(...exactBars.map(({ height }) => height)) - cap) < 1,
      "Tallest goal-free bar reaches the requested pixels",
    );
    assert.deepEqual(await read(noGoalChart), noGoalDimensions);
    await card(noGoalChart).screenshot({
      path: path.join(proofDirectory, `exact-${cap}px-after-refresh.png`),
    });
    evidence.firstSave.push({
      scenario: "exact-pixel-height-without-goal-headroom",
      cap,
      exactBars,
      noGoalDimensions,
    });
  }

  // Native constraints reject zero/fractional pixel heights without sending a write.
  await card(barChart)
    .getByRole("button", { name: `Ajustar altura das torres de ${barChart.title}`, exact: true })
    .press("Enter");
  const invalidEditor = page.getByRole("dialog", { name: "Altura das torres", exact: true });
  const invalidInput = invalidEditor.getByLabel("Altura máxima das torres (px)", { exact: true });
  for (const value of ["0", "24.5"]) {
    const beforeInvalidSave = requests.length;
    await invalidInput.fill(value);
    assert.equal(await invalidInput.evaluate((input) => input.checkValidity()), false);
    await invalidEditor.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(invalidEditor).toHaveCount(1);
    assert.equal(
      requests.length,
      beforeInvalidSave,
      "Invalid pixel height must not write a profile",
    );
  }
  await invalidEditor.getByRole("button", { name: "Cancelar", exact: true }).click();
  evidence.firstSave.push({ scenario: "pixel-cap-rejects-nonpositive-and-fractional-values" });
  for (const cap of [1, 24, 240, 10000]) {
    const beforeSave = requests.length;
    await savePixelCap(barChart, String(cap));
    assert.equal(requests.length, beforeSave + 1, "Pixel cap saves with exactly one PATCH");
    assert.equal(
      requests.at(-1).cards.find((entry) => entry.id === barChart.id).presentation.barMaxHeight,
      cap,
    );
    assert.equal(
      requests.at(-1).cards.find((entry) => entry.id === barChart.id).presentation.barScale,
      undefined,
      "Explicit pixel edit replaces legacy percentage",
    );
    await page.reload();
    await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
    await expect.poll(() => read(barChart)).toEqual(dimensionsBeforeCap);
    assert.deepEqual(await order(), orderBeforeCap, "Pixel cap does not reorder cards");
    const bars = await geometry();
    checkGeometry(bars, cap);
    if (cap === 1)
      assert.ok(
        Math.abs(Math.max(...bars.map(({ height }) => height)) - 1) < 0.1,
        "The 1px cap actually limits the largest tower below its default size",
      );
    const editor = await open(barChart);
    await expect(editor.getByLabel("Altura máxima das torres (px)", { exact: true })).toHaveValue(
      String(cap),
    );
    await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
    evidence.firstSave.push({
      scenario: "pixel-cap-one-save-refresh",
      cap,
      dimensionsBeforeCap,
      bars,
    });
  }
  // Clearing the optional cap restores the legacy/default rendering without a layout mutation.
  await savePixelCap(barChart, "");
  assert.equal(
    requests.at(-1).cards.find((entry) => entry.id === barChart.id).presentation?.barMaxHeight,
    undefined,
  );
  await page.reload();
  await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
  assert.deepEqual(await read(barChart), dimensionsBeforeCap);
  await savePixelCap(barChart, "240");
  await page.goto("about:blank");
  await page.goto(`${origin}?editable`);
  await page.getByRole("button", { name: "House", exact: true }).click();
  await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
  const returnedEditor = await open(barChart);
  await expect(
    returnedEditor.getByLabel("Altura máxima das torres (px)", { exact: true }),
  ).toHaveValue("240");
  await returnedEditor.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.deepEqual(await order(), orderBeforeCap);
  checkGeometry(await geometry(), 240);
  await card(barChart).screenshot({
    path: path.join(proofDirectory, "desktop-240px-after-refresh.png"),
  });
  evidence.firstSave.push({
    scenario: "pixel-cap-clear-and-page-return",
    cap: 240,
    dimensionsBeforeCap,
  });

  const fluidChart = { id: "appointments-monthly", title: "Agendamentos por mês" };
  const fluidDimensions = await read(fluidChart);
  const beforeFluidSave = requests.length;
  await savePixelCap(fluidChart, "80");
  assert.equal(requests.length, beforeFluidSave + 1);
  assert.equal(
    requests.at(-1).cards.find((entry) => entry.id === fluidChart.id).layout.width,
    undefined,
  );
  await page.reload();
  await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
  await expect.poll(() => read(fluidChart)).toEqual(fluidDimensions);
  checkGeometry(await geometry(card(fluidChart)), 80);
  evidence.firstSave.push({
    scenario: "pixel-cap-preserves-fluid-width",
    cap: 80,
    fluidDimensions,
  });

  // Responsive reflow changes the visible width, not the persisted layout or pixel cap.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
    assert.deepEqual(await read(barChart), dimensionsBeforeCap);
    assert.deepEqual(await read(fluidChart), fluidDimensions);
    assert.deepEqual(await order(), orderBeforeCap);
    checkGeometry(await geometry(), 240);
    checkGeometry(await geometry(card(fluidChart)), 80);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Mobile page fits without horizontal overflow",
    );
    const editor = await open(barChart);
    await expect(editor.getByLabel("Altura máxima das torres (px)", { exact: true })).toHaveValue(
      "240",
    );
    await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
    await card(barChart).screenshot({
      path: path.join(
        proofDirectory,
        `mobile-${viewport.width}x${viewport.height}-after-refresh.png`,
      ),
    });
    evidence.firstSave.push({
      scenario: "pixel-cap-mobile-rotation-refresh",
      viewport,
      cap: 240,
      dimensionsBeforeCap,
      fluidDimensions,
    });
  }
  await page.setViewportSize({ width: 1265, height: 578 });

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
  assert.equal(
    await card(barChart)
      .locator("[data-dashboard-bar-max-height]")
      .getAttribute("data-dashboard-bar-max-height"),
    "240",
  );
  checkGeometry(await geometry(), 240);
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
    const capFrom = (target, item) =>
      target
        .locator(`[data-dashboard-card-id="${item.id}"] [data-dashboard-bar-max-height]`)
        .getAttribute("data-dashboard-bar-max-height");
    assert.equal(
      await capFrom(other, barChart),
      "240",
      "Independent context loads saved pixel cap from the shared HTTP profile",
    );
    assert.equal(await capFrom(other, fluidChart), "80");
    const dimensionsBeforePeerCap = await read(barChart);
    await savePixelCap(barChart, "32", other);
    await page.reload();
    await expect(page.getByRole("toolbar")).toContainText("Salvo automaticamente");
    assert.equal(
      await capFrom(page, barChart),
      "32",
      "Reload receives the other context's saved pixel cap",
    );
    assert.deepEqual(await read(barChart), dimensionsBeforePeerCap);
    checkGeometry(await geometry(), 32);
    await card(barChart).screenshot({
      path: path.join(proofDirectory, "cross-context-32px-after-refresh.png"),
    });
    // A new browser context has no cache/localStorage from either writer.
    const freshContext = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    try {
      await freshContext.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort("blockedbyclient"),
      );
      const fresh = await freshContext.newPage();
      await fresh.goto(`${origin}?editable`);
      await fresh.getByRole("button", { name: "House", exact: true }).click();
      await expect(fresh.getByRole("toolbar")).toContainText("Salvo automaticamente");
      assert.equal(await capFrom(fresh, barChart), "32");
      assert.equal(await capFrom(fresh, fluidChart), "80");
      await expect.poll(() => snapshot(fresh)).toEqual(await snapshot(page));
      await fresh
        .locator(`[data-dashboard-card-id="${barChart.id}"]`)
        .screenshot({ path: path.join(proofDirectory, "fresh-mobile-context-32px.png") });
    } finally {
      await freshContext.close();
    }
    evidence.firstSave.push({
      scenario: "pixel-cap-cross-context-and-recreated-context",
      desktopToPeer: 240,
      peerToDesktop: 32,
      freshMobileContext: 32,
    });
    await other.reload();
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
    const blockedEditor = await editIn(other, charts[1], 535, 483);
    await expect(blockedEditor.getByRole("alert")).toContainText("mudou em outra sessão");
    await expect(blockedEditor.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
    assert.equal(peerRequests.filter(({ method }) => method === "PATCH").length, beforeBlockedEdit);
    await blockedEditor.getByRole("button", { name: "Cancelar", exact: true }).click();
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
