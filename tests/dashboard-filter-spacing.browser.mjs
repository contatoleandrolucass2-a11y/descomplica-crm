import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const reproduce = process.argv.includes("--reproduce");
const out = path.join(root, "test-results/dashboard-filter-spacing");
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const entry = path.join(out, "fixture-memory.tsx").replaceAll("\\", "/");
const source = `import {createRoot} from 'react-dom/client';
import {DashboardFilters} from '@/app/(protected)/app/_components/DashboardFilters';
import reportStyles from '@/app/(protected)/app/_components/DashboardReport.module.css';
import {emptyDashboardFilters} from '@/lib/crm/dashboard/analysis';
import '@/app/globals.css';
createRoot(document.getElementById('root')).render(<main className={reportStyles.report} data-filter-spacing-fixture><section data-filter-scenario="unavailable"><DashboardFilters values={emptyDashboardFilters()} options={emptyDashboardFilters()} available={false} authorizedViews={['all']} /><div data-after-filters>Conteúdo após os filtros</div></section><section data-filter-scenario="pending"><DashboardFilters values={emptyDashboardFilters()} options={emptyDashboardFilters()} available={true} authorizedViews={['all']} /><div data-after-filters>Conteúdo após atualização</div></section></main>);`;
const built = await build({
  root,
  configFile: false,
  envFile: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
  resolve: { alias: { "@": root } },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [
    {
      name: "dashboard-filter-spacing-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("fixture-memory.tsx")) return entry;
        if (id === "next/navigation") return "virtual:filter-navigation";
      },
      load(id) {
        if (id === entry) return source;
        if (id === "virtual:filter-navigation")
          return "export const useRouter=()=>({replace:()=>new Promise(()=>{})});export const useSearchParams=()=>new URLSearchParams();";
      },
    },
  ],
  build: { write: false, minify: true, lib: { entry, formats: ["iife"], name: "FilterSpacingQA" } },
});
const files = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
const js = files
  .filter((file) => file.type === "chunk")
  .map((file) => file.code)
  .join("\n");
const css = files
  .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
  .map((file) => String(file.source))
  .join("\n");
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    return res.end(js);
  }
  if (req.url === "/fixture.css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    return res.end(css);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const result = {
  passed: false,
  method:
    "Real DashboardFilters and DashboardReport CSS; exact report paragraph reset appended to simulate either Next CSS chunk order. Navigation/data transport mocked; no external access.",
  checks: [],
  errors: [],
  externalRequests: [],
};
const cases = reproduce
  ? [{ theme: "light", width: 1440 }]
  : ["light", "balanced", "dark"].flatMap((theme) =>
      [320, 390, 768, 1440].map((width) => ({ theme, width })),
    );
try {
  for (const { theme, width } of cases) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      result.externalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    await page.goto(origin);
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    const unavailable = page.locator('[data-filter-scenario="unavailable"]');
    const notice = unavailable.getByRole("status");
    await expect(notice).toHaveText("Filtros aguardando coleta detalhada dos relatórios.");
    const measure = (target = notice) =>
      target.evaluate((element) => ({
        marginTop: Number.parseFloat(getComputedStyle(element).marginTop),
        marginBottom: Number.parseFloat(getComputedStyle(element).marginBottom),
        noticeTop: element.getBoundingClientRect().top,
        afterTop: element
          .closest("[data-filter-scenario]")
          .querySelector("[data-after-filters]")
          .getBoundingClientRect().top,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      }));
    const before = await measure();
    const cascadeRules = await page.evaluate(() => {
      const root = document.querySelector("[data-filter-spacing-fixture]");
      const selector = `.${root.className} p`;
      const element = document.querySelector('[role="status"]');
      const rules = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules));
      const reportReset = rules
        .filter(
          (rule) =>
            rule.selectorText?.split(",").some((part) => part.trim() === selector) &&
            Number.parseFloat(rule.style?.getPropertyValue("margin")) === 0,
        )
        .map((rule) => rule.cssText)
        .join("\n");
      const noticeSpacing = rules
        .filter(
          (rule) =>
            rule.selectorText &&
            element.matches(rule.selectorText) &&
            rule.style?.marginTop === "0.625rem",
        )
        .map((rule) => rule.cssText)
        .join("\n");
      return { reportReset, noticeSpacing };
    });
    assert.ok(
      cascadeRules.reportReset,
      "The test must stress the genuine DashboardReport paragraph reset.",
    );
    assert.ok(
      cascadeRules.noticeSpacing,
      "The test must retain the genuine filter notice spacing.",
    );
    await page.addStyleTag({ content: cascadeRules.noticeSpacing });
    const filtersLast = await measure();
    await page.addStyleTag({ content: cascadeRules.reportReset });
    const resetLast = await measure();
    const passed =
      filtersLast.marginTop === 10 &&
      resetLast.marginTop === 10 &&
      filtersLast.afterTop === resetLast.afterTop &&
      resetLast.scrollWidth <= width;
    const pendingRoot = page.locator('[data-filter-scenario="pending"]');
    await pendingRoot.getByRole("button", { name: "House", exact: true }).click();
    const pendingNotice = pendingRoot.getByRole("status");
    await expect(pendingNotice).toHaveText("Atualizando resultados...");
    await page.addStyleTag({ content: cascadeRules.noticeSpacing });
    const pendingFiltersLast = await measure(pendingNotice);
    await page.addStyleTag({ content: cascadeRules.reportReset });
    const pendingResetLast = await measure(pendingNotice);
    const pendingPassed =
      pendingFiltersLast.marginTop === 10 &&
      pendingResetLast.marginTop === 10 &&
      pendingFiltersLast.afterTop === pendingResetLast.afterTop;
    result.checks.push({
      theme,
      width,
      before,
      filtersLast,
      resetLast,
      pendingFiltersLast,
      pendingResetLast,
      cascadeRules,
      passed: passed && pendingPassed,
    });
    if (theme === "light" && width === 1440)
      await page.screenshot({
        path: path.join(out, reproduce ? "before-fix.png" : "after-fix.png"),
      });
    await page.close();
  }
  result.passed =
    result.checks.every((check) => check.passed) &&
    result.errors.length === 0 &&
    result.externalRequests.length === 0;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    path.join(out, reproduce ? "before-fix.json" : "result.json"),
    JSON.stringify(result, null, 2),
  );
}
console.log(
  JSON.stringify({
    passed: result.passed,
    checks: result.checks.length,
    errors: result.errors,
    externalRequests: result.externalRequests,
  }),
);
assert.ok(result.passed, "Filter notice spacing changed with CSS chunk order.");
