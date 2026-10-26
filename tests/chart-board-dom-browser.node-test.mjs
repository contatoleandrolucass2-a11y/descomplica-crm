import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";

test(
  "ChartBoard reconciles real DOM order, focus and native dialog without remounts",
  { timeout: 60_000 },
  async () => {
    const require = createRequire(import.meta.url);
    const { build } = await import(
      pathToFileURL(createRequire(require.resolve("vitest/package.json")).resolve("vite")).href
    );
    const root = path.resolve(".");
    const entry = path.resolve("tests/chart-board-dom-memory.tsx").replaceAll("\\", "/");
    const built = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      resolve: { alias: { "@": root } },
      oxc: { jsx: { runtime: "automatic", development: false } },
      plugins: [
        {
          name: "chart-board-dom-fixture",
          resolveId(id) {
            if (id.endsWith("chart-board-dom-memory.tsx")) return entry;
          },
          load(id) {
            if (id === entry)
              return `
        import {useState, Fragment} from 'react';
        import {createRoot} from 'react-dom/client';
        import {ChartBoard, ChartTile} from '@/app/(protected)/app/etapas/_components/ChartBoard';
        function Chart({title}) {
          const [count, setCount] = useState(0);
          return <ChartTile id={title} title={title} controls={<input aria-label={'Filter '+title} defaultValue="original"/>}>
            <button onClick={() => setCount(count+1)}>{title} count {count}</button>
          </ChartTile>;
        }
        createRoot(document.getElementById('root')).render(<ChartBoard ids={['A','B','C']} storageKey="dom-qa">
          <div className="group" data-group="first"><Chart key="chart-a" title="A"/><Chart key="chart-b" title="B"/></div>
          <Fragment><div className="group" data-group="second"><Chart key="chart-c" title="C"/></div></Fragment>
        </ChartBoard>);
      `;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry, name: "ChartBoardDOM", formats: ["iife"] },
      },
    });
    const files = (Array.isArray(built) ? built : [built]).flatMap((output) => output.output);
    const script = files
      .filter((file) => file.type === "chunk")
      .map((file) => file.code)
      .join("\n");
    const css = files
      .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
      .map((file) => String(file.source))
      .join("\n");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== "http://chart-board.invalid") return route.abort();
        if (url.pathname === "/fixture.js")
          return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: script });
        if (url.pathname === "/fixture.css")
          return route.fulfill({ contentType: "text/css", body: css });
        return route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><style>.group{display:contents}body{margin:16px;font-family:Arial}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
        });
      });
      await page.goto("http://chart-board.invalid");
      const tiles = page.locator("section[data-appointments-chart]");
      const tile = (id) => page.locator(`section[data-appointments-chart="${id}"]`);
      const order = () =>
        tiles.evaluateAll((nodes) => nodes.map((node) => node.dataset.appointmentsChart));
      const c = tile("C");
      const handle = c.getByRole("button", { name: "Reordenar C", exact: true });
      await expect(tiles).toHaveCount(3);
      await page.getByLabel("Filter C").fill("retained");
      await c.getByRole("button", { name: "C count 0", exact: true }).click();
      await page.evaluate(() => {
        window.savedNodes = [...document.querySelectorAll("section[data-appointments-chart]")].map(
          (tile) => ({
            tile,
            dialog: tile.querySelector("dialog"),
            input: tile.querySelector("input"),
          }),
        );
      });
      await c.getByRole("button", { name: "Mover C para antes", exact: true }).click();
      assert.deepEqual(await order(), ["A", "C", "B"]);
      await expect(
        c.getByRole("button", { name: "Mover C para antes", exact: true }),
      ).toBeFocused();
      await c.getByRole("button", { name: "Mover C para antes", exact: true }).click();
      assert.deepEqual(await order(), ["C", "A", "B"]);
      await expect(handle).toBeFocused(); // the edge arrow is now disabled
      await expect(page.getByLabel("Filter C")).toHaveValue("retained");
      await expect(c.getByRole("button", { name: "C count 1", exact: true })).toBeVisible();
      await c.getByRole("button", { name: "C count 1", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(
        tile("A").getByRole("button", { name: "Reordenar A", exact: true }),
      ).toBeFocused();
      await handle.press("ArrowRight");
      assert.deepEqual(await order(), ["A", "C", "B"]);
      await expect(handle).toBeFocused();
      await handle.dragTo(tile("B"));
      assert.deepEqual(await order(), ["A", "B", "C"]);
      await expect(handle).toBeFocused();
      assert.equal(
        await page.evaluate(() =>
          window.savedNodes.every(
            ({ tile, dialog, input }) =>
              tile.isConnected &&
              tile.querySelector("dialog") === dialog &&
              tile.querySelector("input") === input,
          ),
        ),
        true,
      );
      assert.equal(
        await tiles.evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node.parentElement).display === "contents"),
        ),
        true,
      );
      const boxes = await tiles.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().y),
      );
      assert.equal(new Set(boxes).size, 1, "Cloned group wrappers retain the desktop grid");
      await c.getByRole("button", { name: "Expandir C", exact: true }).click();
      await expect(c.locator("dialog")).toHaveJSProperty("open", true);
      await expect(c.getByRole("button", { name: "Fechar C", exact: true })).toBeFocused();
      await page.getByLabel("Filter C").fill("modal retained");
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog:modal")).toHaveCount(0);
      await expect(c.getByRole("button", { name: "Expandir C", exact: true })).toBeFocused();
      await expect(page.getByLabel("Filter C")).toHaveValue("modal retained");
      await handle.press("ArrowUp");
      assert.deepEqual(await order(), ["A", "C", "B"]);
      assert.equal(
        await page.evaluate(() =>
          window.savedNodes.every(
            ({ tile, dialog, input }) =>
              tile.isConnected &&
              tile.querySelector("dialog") === dialog &&
              tile.querySelector("input") === input,
          ),
        ),
        true,
      );
      await page.reload();
      await expect.poll(order).toEqual(["A", "C", "B"]);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
