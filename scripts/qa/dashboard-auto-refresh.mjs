import { expect } from "@playwright/test";

// Run only after the authenticated visual runner has seeded and verified its dashboard.
export async function checkDashboardAutoRefresh(page, origin) {
  const pathname = "/app?view=with_canal_imob&period=week";
  await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle" });
  const statusResponse = await page.request.get(`${origin}/api/dashboard/status`);
  expect(statusResponse.status()).toBe(200);
  const status = await statusResponse.json();
  expect(status.generatedAt).toEqual(expect.any(String));
  expect(status.updatedAt).toEqual(expect.any(String));
  const details = page.locator('[aria-labelledby="report-monthly-title"] details').first();
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const urlBefore = page.url();
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
    for (const event of ["focus", "online", "focus"]) {
      const probe = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/dashboard/status",
      );
      await page.evaluate((type) => window.dispatchEvent(new Event(type)), event);
      await (await probe).finished();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    }
    await expect.poll(() => refreshes).toBe(1);
    releaseRefresh();
    await (await refreshed).finished();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(page.url()).toBe(urlBefore);
    await expect(details).toHaveAttribute("open", "");
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore),
    ).toBeLessThanOrEqual(2);
    await expect(page.locator(`a[aria-current="page"][href="${pathname}"]`).first()).toBeVisible();
    return { passed: true, refreshes, filters: true, scroll: true, openDetails: true };
  } finally {
    releaseRefresh();
    await page.unroute(statusPattern);
    await page.unroute(refreshPattern);
  }
}
