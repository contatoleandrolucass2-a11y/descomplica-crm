import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import {
  captureDashboardScreenshot,
  observeDashboardStatusReads,
  startServer,
  verifyAnalysisInteractions,
} from "./dashboard-report.mjs";

test("screenshots reset native sticky chrome without scrolling section crops or modal viewports", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    await page.setContent(`<!doctype html><style>
      body { margin: 0; }
      header { position: sticky; top: 0; height: 60px; background: rgb(0, 128, 0); }
      section { height: 2000px; background: rgb(0, 0, 128); }
      dialog { width: 300px; height: 200px; }
    </style><div data-protected-shell><header>Native sticky header</header>
      <section id="funnel">Synthetic funnel</section>
      <dialog><button>Close</button></dialog>
    </div>`);
    const inspect = async (buffer, points) =>
      page.evaluate(
        async ({ bytes, points }) => {
          const bitmap = await createImageBitmap(
            new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          );
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          const pixels = points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
          bitmap.close();
          return { width: canvas.width, height: canvas.height, pixels };
        },
        { bytes: [...buffer], points },
      );
    await page.evaluate(() => window.scrollTo(0, 900));
    assert.ok(await page.evaluate(() => window.scrollY > 0));
    const whole = await inspect(await captureDashboardScreenshot(page), [
      [2, 30],
      [2, 930],
    ]);
    assert.equal(whole.height, 2060, "Full document must not be clipped to the viewport");
    assert.deepEqual(whole.pixels, [
      [0, 128, 0, 255],
      [0, 0, 128, 255],
    ]);
    await page.evaluate(() => window.scrollTo(0, 900));
    const crop = await inspect(
      await captureDashboardScreenshot(page, { section: page.locator("#funnel") }),
      [
        [2, 30],
        [2, 930],
      ],
    );
    assert.equal(crop.height, 2000);
    assert.deepEqual(crop.pixels, [
      [0, 0, 128, 255],
      [0, 0, 128, 255],
    ]);
    assert.equal(
      await page.evaluate(() => window.scrollY),
      0,
      "Section capture must not auto-scroll",
    );
    await expect(page.locator("header")).toHaveCSS("position", "sticky");
    await expect(page.locator("header")).not.toHaveAttribute("style");
    await page.evaluate(() => {
      window.scrollTo(0, 900);
      document.querySelector("dialog").showModal();
    });
    const before = await page.evaluate(() => window.scrollY);
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
    const modal = await inspect(await captureDashboardScreenshot(page, { dialog: true }), []);
    assert.deepEqual([modal.width, modal.height], [640, 480]);
    assert.equal(await page.evaluate(() => window.scrollY), before);
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  } finally {
    await browser.close();
  }
});

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

test("synthetic analysis recalculates filtered history and per-broker goals with keyboard-safe Info dialogs", async () => {
  assert.match(process.version, /^v24\.19\./, "Use Node 24.19.x");
  const server = await startServer();
  let browser;
  const errors = [];
  const blocked = [];
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === server.origin) return route.continue();
      blocked.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${server.origin}/app?scenario=analysis`, { waitUntil: "networkidle" });
    await verifyAnalysisInteractions(page);
    assert.deepEqual(errors, [], "Browser errors");
    assert.deepEqual(blocked, [], "External requests");
    assert.deepEqual(server.requests, [], "Unknown local requests");
    assert.deepEqual(server.refreshes, [], "Filtering must never trigger ingestion");
  } finally {
    await browser?.close();
    await server.close();
  }
});
