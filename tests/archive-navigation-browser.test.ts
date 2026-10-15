import { chromium, expect as browserExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";
// @ts-expect-error Operational ESM script without a declaration file.
import { waitForArchiveHeaderTheme } from "../scripts/qa/archive-navigation.mjs";

type Surface = {
  theme: string;
  backgroundColor: string;
  tokenColor: string;
  transitioning: boolean;
  settled: boolean;
  samples: number;
  elapsedMs: number;
};

describe.runIf(process.env.ARCHIVE_NAVIGATION_BROWSER === "1")(
  "archive header theme browser evidence",
  () => {
    it("requires repeated stable samples and records timing without changing the color gate", async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><html data-theme="light"><head><style>
          header { --header-bg: #fff; background: #000; transition: background-color 150ms linear; }
        </style></head><body><header><nav id="authorized-navigation"></nav></header></body></html>`);
        const surfaces: Record<string, Surface> = {};
        const checking = waitForArchiveHeaderTheme(page, "light", surfaces);
        await browserExpect.poll(() => surfaces.light?.samples ?? 0).toBeGreaterThan(0);
        expect(surfaces.light!.settled).toBe(false);
        expect(surfaces.light!.backgroundColor).not.toBe(surfaces.light!.tokenColor);

        await page.locator("header").evaluate((header) => {
          header.style.backgroundColor = "var(--header-bg)";
        });
        const result: Surface = await checking;
        expect(result).toMatchObject({
          theme: "light",
          backgroundColor: "rgb(255, 255, 255)",
          tokenColor: "rgb(255, 255, 255)",
          transitioning: false,
          settled: true,
        });
        expect(result.samples).toBeGreaterThanOrEqual(3);
        expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
      } finally {
        await browser.close();
      }
    });

    it("does not accept matching colors while the selected theme is wrong", async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(`<!doctype html><html data-theme="dark"><head><style>
          header { --header-bg: #fff; background: var(--header-bg); }
        </style></head><body><header><nav id="authorized-navigation"></nav></header></body></html>`);
        const surfaces: Record<string, Surface> = {};
        const checking = waitForArchiveHeaderTheme(page, "light", surfaces);
        await browserExpect.poll(() => surfaces.light?.samples ?? 0).toBeGreaterThanOrEqual(2);
        expect(surfaces.light!.backgroundColor).toBe(surfaces.light!.tokenColor);
        expect(surfaces.light!.settled).toBe(false);

        await page.locator("html").evaluate((html) => {
          html.dataset.theme = "light";
        });
        const result: Surface = await checking;
        expect(result.theme).toBe("light");
        expect(result.settled).toBe(true);
        expect(result.samples).toBeGreaterThanOrEqual(4);
      } finally {
        await browser.close();
      }
    });
  },
);
