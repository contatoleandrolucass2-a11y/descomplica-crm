import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { applySecurityHeaders } from "../../lib/security/headers.ts";

// Exercise the real component and static application without auth, env files or remote data.
const root = path.resolve(import.meta.dirname, "../..");
const document = await readFile(
  path.join(root, "app/(protected)/app/meta-ads/dashboard-frame.html"),
  "utf8",
);
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const entry = path.join(root, "scripts/qa/meta-ads-frame-memory.tsx");
const built = await build({
  root,
  configFile: false,
  envFile: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: { "@": root } },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [
    {
      name: "meta-ads-frame-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id === entry) return entry;
      },
      load(id) {
        if (id !== entry) return;
        return `
        import {useState} from "react";
        import {createRoot} from "react-dom/client";
        import {MetaAdsDashboardFrame} from "@/app/(protected)/app/meta-ads/MetaAdsDashboardFrame";
        const views = ["overview", "campaigns", "accounts", "reports"];
        function App() {
          const [view, setView] = useState(new URLSearchParams(location.search).get("view") || "overview");
          return <><nav aria-label="Fixture Meta Ads">
            {views.map(value => <button key={value} onClick={() => setView(value)}>{value}</button>)}
            <button onClick={() => {document.documentElement.dataset.theme="balanced"}}>theme</button>
          </nav><MetaAdsDashboardFrame document={${JSON.stringify(document)}} initialView={view}/></>;
        }
        createRoot(document.getElementById("root")).render(<App/>);
      `;
      },
    },
  ],
  build: { write: false, minify: false, lib: { entry, name: "MetaFrameQa", formats: ["es"] } },
});
const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
const files = new Map(
  output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
);
const script = output.find((file) => file.type === "chunk" && file.isEntry).fileName;
const css = [...files.keys()].filter((file) => file.endsWith(".css"));
const html = `<!doctype html><html data-theme="dark"><head>${css
  .map((file) => `<link rel="stylesheet" href="${file}">`)
  .join(
    "",
  )}</head><body><div id="root"></div><script type="module" src="/${script}"></script></body></html>`;
for (const name of await readdir(path.join(root, "public/descomplica-ads"))) {
  files.set(
    `/descomplica-ads/${name}`,
    await readFile(path.join(root, "public/descomplica-ads", name)),
  );
}
const headers = new Headers();
applySecurityHeaders(headers, { isProd: true });
const mime = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  for (const [name, value] of headers) response.setHeader(name, value);
  const body = pathname === "/app/meta-ads" ? html : files.get(pathname);
  response.writeHead(body === undefined ? 404 : 200, {
    "Content-Type":
      pathname === "/app/meta-ads"
        ? "text/html"
        : mime[path.extname(pathname)] || "application/octet-stream",
  });
  response.end(body ?? "Not found");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  const context = await browser.newContext();
  const forbidden = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    if (
      !request.url().startsWith(`${origin}/`) ||
      (request.isNavigationRequest() && request.frame().parentFrame())
    ) {
      forbidden.push(request.url());
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const frame = page.frameLocator("iframe");
  const titles = {
    overview: "Visão geral de anúncios",
    campaigns: "Análise de campanhas e anúncios",
    accounts: "Contas de anúncios",
    reports: "Central de relatórios",
  };
  async function check(view) {
    await expect(frame.locator("#page-title")).toHaveText(titles[view]);
    assert.equal(page.frames()[1].url(), "about:srcdoc");
    await expect(frame.locator("html")).toHaveAttribute("data-crm-view", view);
  }
  for (const view of Object.keys(titles)) {
    await page.goto(`${origin}/app/meta-ads?view=${view}`);
    await check(view);
    await page.reload();
    await check(view);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const view of Object.keys(titles)) {
      await page.getByRole("button", { name: view, exact: true }).click();
      await check(view);
    }
  }
  await page.getByRole("button", { name: "overview", exact: true }).click();
  await check("overview");
  await frame.locator('[data-view="accounts"]').first().click();
  await expect(frame.locator("#page-title")).toHaveText(titles.accounts);
  assert.equal(page.frames()[1].url(), "about:srcdoc");
  await frame.locator("a.skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(frame.locator("#main")).toBeFocused();
  assert.equal(page.frames()[1].url(), "about:srcdoc");
  await page.getByRole("button", { name: "theme", exact: true }).click();
  await expect(frame.locator("html")).toHaveAttribute("data-theme", "medium");
  assert.deepEqual(forbidden, [], "No external requests or nested document navigation");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "Meta Ads: four views, cold load, reload, repeated submenu transitions, internal navigation, skip link and theme passed with production security headers.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
