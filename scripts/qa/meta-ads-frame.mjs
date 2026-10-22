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
const apiFixture = JSON.stringify({
  source: "meta_marketing_api",
  accountId: "1080988750909489",
  accountName: "Conta Meta QA",
  currency: "BRL",
  fetchedAt: "2026-10-21T12:00:00.000Z",
  range: { start: "2026-06-24", end: "2026-10-21" },
  rows: [
    {
      rowId: "2026-10-20|1080988750909489|11|22|33",
      date: "2026-10-20",
      accountId: "1080988750909489",
      account: "Conta Meta QA",
      campaignId: "11",
      campaign: "Empreendimento QA | WhatsApp",
      adsetId: "22",
      adset: "Público QA",
      adId: "33",
      ad: "Criativo QA",
      project: "Empreendimento QA",
      destination: "whatsapp",
      status: "active",
      event: "conversation",
      attribution: "Configuração unificada do conjunto de anúncios",
      spend: 100,
      conversions: 5,
      clicks: 20,
      impressions: 1000,
      reach: 700,
      formOpens: null,
      sessions: null,
      convertedSessions: null,
      waClicks: 20,
      messageClicks: 5,
      crmContacts: null,
      qualifiedLeads: null,
      sales: null,
      cohortMature: false,
      crmDeduplicated: false,
      qualityRanking: null,
      engagementRanking: null,
      conversionRanking: null,
    },
  ],
});
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
  const body =
    pathname === "/app/meta-ads"
      ? html
      : pathname === "/api/meta-ads/data"
        ? apiFixture
        : files.get(pathname);
  response.writeHead(body === undefined ? 404 : 200, {
    "Content-Type":
      pathname === "/app/meta-ads"
        ? "text/html"
        : pathname === "/api/meta-ads/data"
          ? "application/json"
          : mime[path.extname(pathname)] || "application/octet-stream",
  });
  response.end(body ?? "Not found");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
    await expect(frame.locator("#data-badge")).toContainText("Meta API · somente leitura");
    assert.equal(page.frames()[1].url(), "about:srcdoc");
    await expect(frame.locator("html")).toHaveAttribute("data-crm-view", view);
  }
  async function checkOpenModal(title) {
    const dialog = frame.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();

    const [frameBox, dialogBox, bodyOverflow] = await Promise.all([
      page.locator("iframe").boundingBox(),
      dialog.boundingBox(),
      dialog.locator(".modal-body").evaluate((element) => getComputedStyle(element).overflowY),
    ]);
    assert.ok(frameBox && dialogBox, `${title}: iframe and dialog must have layout boxes`);
    const visibleFrameTop = Math.max(frameBox.y, 0);
    const visibleFrameBottom = Math.min(frameBox.y + frameBox.height, 900);
    assert.ok(
      dialogBox.y >= visibleFrameTop - 1,
      `${title}: dialog must start inside the visible iframe`,
    );
    assert.ok(
      dialogBox.y + dialogBox.height <= visibleFrameBottom + 1,
      `${title}: dialog actions must remain inside the visible iframe`,
    );
    assert.equal(bodyOverflow, "auto", `${title}: long content must scroll inside the dialog`);
    if (process.env.META_ADS_QA_SCREENSHOT && title === "Metas e alertas") {
      await page.waitForTimeout(250);
      await page.screenshot({ path: process.env.META_ADS_QA_SCREENSHOT });
    }
    return dialog;
  }
  async function checkModal(title, open) {
    await open();
    const dialog = await checkOpenModal(title);
    await frame.getByRole("button", { name: "Fechar janela" }).click();
    await expect(dialog).toBeHidden();
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
  await checkModal("Central de alertas", () =>
    frame.getByRole("button", { name: /Ver alertas/ }).click(),
  );
  await checkModal("Importar mídia e resultados", () =>
    frame.getByRole("button", { name: "Importar dados" }).click(),
  );
  await checkModal("Metas e alertas", () =>
    frame.getByRole("button", { name: "Metas e alertas" }).click(),
  );
  await checkModal("Escolher período", () =>
    frame.locator("#period-filter").selectOption("custom"),
  );
  await checkModal("Alcance consolidado do recorte", () =>
    frame.getByRole("button", { name: /Informar alcance do recorte/ }).click(),
  );
  await checkModal("Atribuição", () =>
    frame.getByRole("button", { name: "Entender Regra de crédito dos resultados" }).click(),
  );

  await frame.getByRole("button", { name: "Guia de métricas" }).click();
  const glossaryDialog = await checkOpenModal("Guia de métricas");
  await glossaryDialog
    .getByRole("button", { name: /Ver exemplo e interpretação/ })
    .first()
    .click();
  const definitionDialog = await checkOpenModal("Atribuição");
  await frame.getByRole("button", { name: "Fechar janela" }).click();
  await expect(definitionDialog).toBeHidden();
  await expect(glossaryDialog).toBeVisible();
  await frame.getByRole("button", { name: "Fechar janela" }).click();
  await expect(glossaryDialog).toBeHidden();

  await frame.locator('button.campaign-name[data-entity="campaign"]').first().click();
  const entityDialog = await checkOpenModal("Empreendimento QA | WhatsApp");
  await entityDialog.getByRole("button", { name: /Alterar teto/ }).click();
  await expect(entityDialog).toBeHidden();
  await checkOpenModal("Teto específico por resultado");
  await frame.getByRole("button", { name: "Fechar janela" }).click();

  await page.getByRole("button", { name: "campaigns", exact: true }).click();
  await check("campaigns");
  await checkModal("Selecionar campanhas para comparar", () =>
    frame.getByRole("button", { name: /Selecionar campanhas/ }).click(),
  );
  await page.getByRole("button", { name: "overview", exact: true }).click();
  await check("overview");
  await page.getByRole("button", { name: "accounts", exact: true }).click();
  await check("accounts");
  await checkModal("Limite mensal de gasto", () =>
    frame.getByRole("button", { name: /Limite mensal/ }).click(),
  );
  await frame.locator("#connections-button").click();
  await checkModal("Usar demonstração?", () =>
    frame.getByRole("button", { name: "Usar demonstração" }).click(),
  );
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
    "Meta Ads: four views and all twelve dialog flows, cold load, reload, repeated submenu transitions, internal navigation, skip link and theme passed with production security headers.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
