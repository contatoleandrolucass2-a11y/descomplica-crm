import { expect } from "@playwright/test";

// Run only after the authenticated visual runner has seeded and verified its dashboard.
export async function checkDashboardAutoRefresh(page, origin) {
  let timer;
  try {
    return await Promise.race([
      verifyDashboardAutoRefresh(page, origin),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Dashboard refresh QA exceeded 60s")), 60_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function verifyDashboardAutoRefresh(page, origin) {
  process.stdout.write("[dashboard-auto-refresh] initial-snapshot\n");
  const selectedChannel = "SPC - CANAL IMOB PJ";
  const pathname = `/app?view=with_canal_imob&channel=${encodeURIComponent(selectedChannel)}`;
  await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle" });
  const statusResponse = await page.request.get(`${origin}/api/dashboard/status`);
  expect(statusResponse.status()).toBe(200);
  const status = await statusResponse.json();
  expect(status.generatedAt).toEqual(expect.any(String));
  expect(status.updatedAt).toEqual(expect.any(String));
  const channelFilter = page
    .getByRole("region", { name: "Filtros do relatório", exact: true })
    .locator("details")
    .first();
  await channelFilter.locator("summary").click();
  const channelSelection = channelFilter.getByRole("checkbox", {
    name: selectedChannel,
    exact: true,
  });
  await expect(channelSelection).toBeChecked();
  const details = page.locator('[aria-labelledby="report-monthly-title"] details').first();
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const urlBefore = page.url();
  const startedAt = await page.evaluate(() => performance.now());
  let refreshes = 0;
  let releaseRefresh;
  const pendingRefresh = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  const statusPattern = "**/api/dashboard/status";
  const refreshPattern = "**/app?**";
  await page.route(statusPattern, (route) =>
    route.fulfill({
      json: {
        ...status,
        updatedAt: new Date(Date.parse(status.updatedAt) + 1_000).toISOString(),
      },
    }),
  );
  await page.route(refreshPattern, async (route) => {
    if (route.request().headers().rsc === "1") {
      refreshes += 1;
      await pendingRefresh;
    }
    await route.continue();
  });
  const refreshed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/app" && response.request().headers().rsc === "1",
  );
  // Handle early assertion failures without leaving a rejected response waiter behind.
  void refreshed.catch(() => {});
  try {
    process.stdout.write("[dashboard-auto-refresh] pending-rsc\n");
    for (const [index, event] of ["focus", "online", "focus"].entries()) {
      process.stdout.write(`[dashboard-auto-refresh] probe-${index + 1}\n`);
      const probe = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/dashboard/status",
      );
      await page.evaluate((type) => window.dispatchEvent(new Event(type)), event);
      await (await probe).finished();
      await page.waitForFunction(
        () => new Promise((resolve) => requestAnimationFrame(() => resolve(true))),
        undefined,
        { timeout: 10_000 },
      );
    }
    await expect.poll(() => refreshes).toBe(1);
    process.stdout.write("[dashboard-auto-refresh] release-rsc\n");
    releaseRefresh();
    const response = await refreshed;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/x-component");
    process.stdout.write("[dashboard-auto-refresh] rsc-headers\n");
    // Resource Timing measures the last received byte without waiting on Playwright's
    // completion bookkeeping for a routed, streamed response.
    await expect
      .poll(
        () =>
          page.evaluate(
            ({ url, since }) =>
              performance
                .getEntriesByName(url, "resource")
                .some(
                  (entry) =>
                    entry.startTime >= since &&
                    entry.responseEnd > entry.startTime &&
                    entry.decodedBodySize > 0,
                ),
            { url: response.url(), since: startedAt },
          ),
        { timeout: 10_000, message: "The complete RSC payload must reach the browser" },
      )
      .toBe(true);
    process.stdout.write("[dashboard-auto-refresh] state-preservation\n");
    await page.waitForFunction(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))),
        ),
      undefined,
      { timeout: 10_000 },
    );
    expect(page.url()).toBe(urlBefore);
    await expect(details).toHaveAttribute("open", "");
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore),
    ).toBeLessThanOrEqual(2);
    await expect(channelFilter).toHaveAttribute("open", "");
    await expect(channelSelection).toBeChecked();
    process.stdout.write("[dashboard-auto-refresh] passed\n");
    return {
      passed: true,
      refreshes,
      responseComplete: true,
      completionGauge: "resource-timing",
      filters: true,
      scroll: true,
      openDetails: true,
    };
  } finally {
    releaseRefresh();
    await page.unroute(statusPattern);
    await page.unroute(refreshPattern);
  }
}
