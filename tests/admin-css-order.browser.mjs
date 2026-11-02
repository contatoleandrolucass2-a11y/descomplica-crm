import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium } from "@playwright/test";

test(
  "Admin geometry is independent of global/module CSS delivery order",
  { timeout: 120_000 },
  async () => {
    const root = process.cwd();
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const adminPath = "app/(protected)/admin/admin-canvas.css";
    const reference = process.env.ADMIN_CSS_SHEET_REF;
    if (reference && !/^[a-zA-Z0-9_./-]+$/.test(reference))
      throw new Error("Invalid local Git reference.");
    const adminCss = reference
      ? execFileSync("git", ["show", `${reference}:${adminPath}`], { cwd: root, encoding: "utf8" })
      : await readFile(path.join(root, adminPath), "utf8");
    const evidenceRoot = path.join(
      root,
      "test-results/admin-css-order",
      reference ? "reference" : "current",
    );
    await mkdir(evidenceRoot, { recursive: true });
    const entry = path.join(root, "tests/admin-css-order-memory.ts").replaceAll("\\", "/");
    const built = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      resolve: { alias: { "@": root } },
      plugins: [
        {
          name: "real-admin-css-order",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("admin-css-order-memory.ts")) return entry;
          },
          load(id) {
            if (id === entry)
              return `import styles from '@/app/(protected)/_components/ManagementCanvas.module.css';import '@/app/globals.css';window.adminQaStyles=styles;`;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        lib: { entry, name: "AdminCssOrderQa", formats: ["iife"] },
      },
    });
    const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
    const moduleCss = output
      .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
      .map((item) => String(item.source))
      .join("\n");
    const script = output
      .filter((item) => item.type === "chunk")
      .map((item) => item.code)
      .join("\n");
    assert.ok(moduleCss && script, "Real CSS modules must be compiled rather than reconstructed.");
    const evidence = {
      source: reference ?? "working-tree",
      environment:
        "isolated Chromium; real CSS; minimal synthetic Admin DOM; no authentication or backend",
      passed: false,
      checks: [],
      failures: [],
    };
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ reducedMotion: "reduce" });
      await page.route("**/*", (route) => route.abort("blockedbyclient"));
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "balanced", "dark"]) {
          for (const surface of ["home", "users", "pages"]) {
            const readings = [];
            for (const order of ["global-first", "module-first"]) {
              const sheets =
                order === "global-first" ? [adminCss, moduleCss] : [moduleCss, adminCss];
              await page.setContent(
                `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin CSS synthetic QA</title>${sheets.map((css) => `<style>${css}</style>`).join("")}</head><body><div id="root"></div><script>${script}</script></body></html>`,
              );
              await page.evaluate((kind) => {
                const s = window.adminQaStyles;
                const header = `<header class="${s.pageHeader}"><div class="${s.pageHeaderCopy}"><h1 class="${s.pageTitle}">Administração sintética</h1><p class="${s.pageDescription}">Gestão de acessos e páginas</p></div></header>`;
                const home = `<section class="admin-home-links"><div class="admin-home-grid"><a data-qa-panel href="#" class="${s.panel} ${s.panelPadded} admin-home-card"><span class="${s.iconFrame}">QA</span><span class="admin-home-card-copy"><strong>Usuários sintéticos</strong><span>Catálogo de acesso</span></span></a></div></section>`;
                const controls = `<label class="${s.searchLabel}"><span class="${s.searchCopy}"><span>Buscar</span><input class="${s.searchInput}" placeholder="Nome sintético"></span></label><label class="${s.selectLabel}">Status<select class="${s.select}"><option>Todos</option></select></label><label class="${s.selectLabel}">Módulo<select class="${s.select}"><option>Todos</option></select></label>`;
                const manager = `<div class="admin-${kind}-content"><section data-qa-toolbar class="${s.panel} ${s.panelPadded} admin-${kind}-toolbar"><div class="${s.toolbar}">${controls}</div></section><section data-qa-results class="${s.panel} admin-${kind}-results"><div class="admin-${kind}-results-header"><h2 class="${s.sectionTitle}">Registros sintéticos</h2></div><div class="${s.panelPadded}">Sem dados privados</div></section></div>`;
                document.getElementById("root").innerHTML =
                  `<main data-qa-page class="${s.page} admin-canvas admin-${kind}-page"><div class="${s.pageInner}">${header}${kind === "home" ? home : manager}</div></main>`;
              }, surface);
              await page.evaluate(() => document.fonts.ready);
              const reading = await page.evaluate(() => {
                const inspect = (selector) => {
                  const element = document.querySelector(selector);
                  if (!element) return null;
                  const style = getComputedStyle(element);
                  const box = element.getBoundingClientRect();
                  return {
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    padding: style.padding,
                    margin: style.margin,
                    borderWidth: style.borderWidth,
                    borderStyle: style.borderStyle,
                    borderColor: style.borderColor,
                    borderRadius: style.borderRadius,
                    background: style.backgroundColor,
                    gap: style.gap,
                    flexWrap: style.flexWrap,
                    paddingTop: Number.parseFloat(style.paddingTop),
                    paddingLeft: Number.parseFloat(style.paddingLeft),
                    paddingBottom: Number.parseFloat(style.paddingBottom),
                  };
                };
                return {
                  viewport: innerWidth,
                  scrollWidth: document.documentElement.scrollWidth,
                  page: inspect("[data-qa-page]"),
                  panel: inspect("[data-qa-panel]"),
                  toolbar: inspect("[data-qa-toolbar]"),
                  toolbarRow: inspect("[data-qa-toolbar] > div"),
                  results: inspect("[data-qa-results]"),
                };
              });
              readings.push(reading);
              if (order === "global-first")
                await page.screenshot({
                  path: path.join(evidenceRoot, `${surface}-${theme}-${width}.png`),
                  fullPage: true,
                });
            }
            const same = JSON.stringify(readings[0]) === JSON.stringify(readings[1]);
            const noOverflow = readings.every((item) => item.scrollWidth <= item.viewport + 1);
            const expected =
              width === 390
                ? { top: 14.4, left: 12, bottom: 24 }
                : { top: 17.6, left: 28, bottom: 32 };
            const approvedPadding = readings.every(
              (item) =>
                Math.abs(item.page.paddingTop - expected.top) < 0.05 &&
                Math.abs(item.page.paddingLeft - expected.left) < 0.05 &&
                Math.abs(item.page.paddingBottom - expected.bottom) < 0.05,
            );
            evidence.checks.push({
              width,
              theme,
              surface,
              same,
              noOverflow,
              approvedPadding,
              readings,
            });
            if (!same || !noOverflow || !approvedPadding)
              evidence.failures.push({ width, theme, surface, same, noOverflow, approvedPadding });
          }
        }
      }
      assert.deepEqual(
        evidence.failures,
        [],
        "CSS order must preserve approved Admin geometry, borders and toolbar padding without overflow",
      );
      evidence.passed = true;
    } finally {
      await browser.close();
      await writeFile(path.join(evidenceRoot, "evidence.json"), JSON.stringify(evidence, null, 2));
      console.log(
        JSON.stringify({
          source: evidence.source,
          passed: evidence.passed,
          checks: evidence.checks.length,
          failures: evidence.failures.length,
          evidence: path.join(evidenceRoot, "evidence.json"),
        }),
      );
    }
  },
);
