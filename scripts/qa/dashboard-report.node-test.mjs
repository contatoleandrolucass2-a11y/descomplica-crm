import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { observeDashboardStatusReads, startServer } from "./dashboard-report.mjs";

test("status probes wait for browser JSON consumption before the next resume event", async (t) => {
  assert.match(process.version, /^v24\.19\./, "Use Node 24.19.x");
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === server.origin
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    const page = await context.newPage();
    await page.goto(server.origin, { waitUntil: "networkidle" });
    const now = new Date("2026-10-14T15:00:00.000Z");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    // Hold the browser's first body read after the complete HTTP response arrives.
    await page.evaluate(() => {
      window.qaHoldStatusJson = false;
      const fetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await fetch(...args);
        if (new URL(response.url).pathname === "/api/dashboard/status") {
          const json = response.json.bind(response);
          response.json = async () => {
            const value = await json();
            if (window.qaHoldStatusJson) {
              await new Promise((resolve) => {
                window.qaReleaseStatusJson = () => {
                  window.qaHoldStatusJson = false;
                  resolve();
                };
              });
            }
            return value;
          };
        }
        return response;
      };
    });
    const waitForStatusReads = await observeDashboardStatusReads(page);
    let statusReads = 0;
    let releaseResponse;
    const pendingResponse = new Promise((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/dashboard/status", async (route) => {
      statusReads += 1;
      if (statusReads === 3) await pendingResponse;
      await route.fulfill({
        json: {
          generatedAt: "2026-10-13T15:00:00.000Z",
          updatedAt: "2026-10-13T15:00:00.000Z",
        },
      });
    });
    for (const event of ["focus", "online"]) {
      const previousReads = statusReads;
      await page.evaluate((type) => window.dispatchEvent(new Event(type)), event);
      await expect.poll(() => statusReads).toBeGreaterThan(previousReads);
      await waitForStatusReads(statusReads);
    }
    await page.evaluate(() => {
      window.qaHoldStatusJson = true;
      window.dispatchEvent(new Event("focus"));
    });
    await expect.poll(() => statusReads).toBe(3);
    // A counted request is still in flight while its response is held.
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    assert.equal(statusReads, 3);
    assert.equal(await page.evaluate(() => window.qaStatusReadsCompleted), 2);
    const response = page.waitForResponse("**/api/dashboard/status");
    releaseResponse();
    await (await response).finished();
    await expect
      .poll(() => page.evaluate(() => typeof window.qaReleaseStatusJson))
      .toBe("function");
    // Even HTTP completion does not release the component's JSON read/controller.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await assert.rejects(
      () => expect.poll(() => statusReads).toBeGreaterThan(3),
      /Expected: > 3[\s\S]*Received:\s+3[\s\S]*Timeout 5000ms/,
    );
    t.diagnostic("Original request-only wait reproduced: Expected > 3, Received 3, Timeout 5000ms");
    assert.equal(await page.evaluate(() => window.qaStatusReadsCompleted), 2);
    let readCompleted = false;
    const completed = waitForStatusReads(3).then(() => {
      readCompleted = true;
    });
    await page.evaluate(() => window.qaStatusReadsCompleted);
    assert.equal(readCompleted, false, "The waiter must not accept an unconsumed JSON response");
    await page.evaluate(() => window.qaReleaseStatusJson());
    await completed;
    for (const event of ["focus", "online", "focus"]) {
      const previousReads = statusReads;
      await page.evaluate((type) => window.dispatchEvent(new Event(type)), event);
      await expect.poll(() => statusReads).toBeGreaterThan(previousReads);
      await waitForStatusReads(statusReads);
    }
    assert.equal(statusReads, 6);
    assert.equal(await page.evaluate(() => window.qaRefreshes), 0);
    assert.deepEqual(server.requests, []);
    assert.deepEqual(server.refreshes, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
