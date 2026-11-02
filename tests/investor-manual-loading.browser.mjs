import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

// Isolated production JS fixture. No CRM session, backend, inventory or customer data.
const root = process.cwd();
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const entry = path.join(root, "test-results/investor-manual-loading.tsx").replaceAll("\\", "/");
const source = `import {createRoot} from 'react-dom/client';
import {DeferredInvestorLearningManual} from '${path.join(root, "app/(protected)/app/simulacao/_components/archive-investor/DeferredInvestorLearningManual.tsx").replaceAll("\\", "/")}';
const variant=new URLSearchParams(location.search).get('variant');
createRoot(document.getElementById('root')).render(<DeferredInvestorLearningManual associative={variant==='associative'} directTable={variant==='direct'} />);`;
const built = await build({
  root,
  configFile: false,
  envFile: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [
    {
      name: "manual-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id === entry) return entry;
      },
      load(id) {
        if (id === entry) return source;
      },
    },
  ],
  build: { write: false, rolldownOptions: { input: entry } },
});
const files = new Map(built.output.map((asset) => ["/" + asset.fileName, asset]));
const main = built.output.find((asset) => asset.type === "chunk" && asset.isEntry);
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  const asset = files.get(pathname);
  if (asset) {
    res.setHeader("Content-Type", pathname.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(asset.type === "chunk" ? asset.code : asset.source);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script type="module" src="/${main.fileName}"></script></body></html>`,
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const evidence = {
  method:
    "isolated Vite production fixture; functional dialog/loading contract, not whole-page visual parity",
  cases: [],
  errors: [],
};
try {
  for (const width of [390, 1440])
    for (const variant of ["investor", "direct", "associative"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on("pageerror", (error) => evidence.errors.push(error.message));
      const requests = [];
      page.on("request", (request) => requests.push(request.url()));
      await page.goto(`${base}/?variant=${variant}`);
      const trigger = page.getByRole("button", { name: /^Aprenda/ });
      await expect(trigger).toBeVisible();
      assert.equal(
        requests.some((url) => url.includes("InvestorLearningManualContent")),
        false,
        "manual must remain deferred before interaction",
      );
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      assert.equal(
        requests.some((url) => url.includes("InvestorLearningManualContent")),
        true,
      );
      if (variant === "associative") {
        await expect(page.getByRole("tab", { name: "Política" })).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await expect(page.getByRole("tab", { name: "Perguntas" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.getByRole("button", { name: /^Aprenda/ })).toBeFocused();
      await page.getByRole("button", { name: /^Aprenda/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      evidence.cases.push({
        width,
        variant,
        loading: "passed",
        keyboard: "passed",
        reopen: "passed",
      });
      await page.close();
    }
  const page = await browser.newPage();
  await page.goto(`${base}/?variant=associative#investor-associative-learning-faq`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Perguntas" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  evidence.cases.push({ variant: "associative", deepLink: "passed" });
  await page.close();
  assert.deepEqual(evidence.errors, []);
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await writeFile(
    path.join(root, "test-results/investor-manual-loading.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
