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
        if (id === "next/link") return "\0meta-ads-next-link";
        if (id === "next/navigation") return "\0meta-ads-next-navigation";
      },
      load(id) {
        if (id === "\0meta-ads-next-link")
          return `import React from "react"; export default function Link({prefetch,children,...props}) { return React.createElement("a",props,children); }`;
        if (id === "\0meta-ads-next-navigation") {
          return `export const usePathname = () => "/app/meta-ads";
            export const useRouter = () => ({ push() {} });`;
        }
        if (id !== entry) return;
        return `
        import {useState} from "react";
        import {createRoot} from "react-dom/client";
        import {MetaAdsAlertButton} from "@/app/(protected)/_components/MetaAdsAlertButton";
        import {MetaAdsDashboardFrame} from "@/app/(protected)/app/meta-ads/MetaAdsDashboardFrame";
        import {MetaAdsSidebar} from "@/app/(protected)/app/meta-ads/MetaAdsSidebar";
        import styles from "@/app/(protected)/app/meta-ads/MetaAdsDashboardFrame.module.css";
        const pages = [{key:"overview",path:"/app/meta-ads",name:"Visão geral"},{key:"campaigns",path:"/app/meta-ads/campanhas",name:"Campanhas"},{key:"accounts",path:"/app/meta-ads/contas-de-anuncios",name:"Contas de anúncios"},{key:"reports",path:"/app/meta-ads/relatorios",name:"Relatórios"}];
        const views = ["overview", "campaigns", "accounts", "reports", "map", "settings"];
        function App() {
          const [view, setView] = useState(new URLSearchParams(location.search).get("view") || "overview");
          return <><nav aria-label="Fixture Meta Ads">
            {views.map(value => <button key={value} onClick={() => setView(value)}>{value}</button>)}
            <button onClick={() => {document.documentElement.dataset.theme="balanced"}}>theme</button>
            <MetaAdsAlertButton />
          </nav><div className={styles.workspace}><MetaAdsSidebar view={view} pages={pages} path={pages[views.indexOf(view)]?.path || "/app/meta-ads"} isMaster/><MetaAdsDashboardFrame document={${JSON.stringify(document)}} initialView={view}/></div></>;
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
files.set(
  "/crm-shell.css",
  (await readFile(path.join(root, "app/globals.css"), "utf8")).replace(
    '@import "tailwindcss";',
    "",
  ),
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
const apiSample = JSON.parse(apiFixture);
const primary = apiSample.rows[0];
apiSample.rows.push({
  ...primary,
  rowId: "previous",
  date: "2026-10-01",
  spend: 40,
  conversions: 2,
});
for (let i = 0; i < 7; i++)
  apiSample.rows.push({
    ...primary,
    rowId: "extra" + i,
    campaignId: String(100 + i),
    campaign: "Residencial São Paulo / campanha " + i + " com nome longo para leitura",
    adsetId: String(200 + i),
    adId: String(300 + i),
    spend: 10,
    conversions: 1,
  });
apiSample.rows.push({
  ...primary,
  rowId: "form",
  campaignId: "999",
  destination: "form",
  spend: 900,
  conversions: 90,
});
apiSample.rows.push({
  ...primary,
  rowId: "deleted",
  campaignId: "777",
  campaign: "Campanha excluída QA",
  adsetId: "778",
  adset: "Conjunto excluído QA",
  adId: "779",
  ad: "Anúncio excluído QA",
  status: "archived",
  spend: 71.83,
  conversions: 38,
  clicks: 189,
  impressions: 1659,
});
let apiMode = "valid";
async function serveAssets(dir, url) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await serveAssets(full, url + "/" + entry.name);
    else files.set(url + "/" + entry.name, await readFile(full));
  }
}
await serveAssets(path.join(root, "public/descomplica-ads-compact"), "/descomplica-ads-compact");
const headers = new Headers();
applySecurityHeaders(headers, { isProd: true });
const mime = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  for (const [name, value] of headers) response.setHeader(name, value);
  const body =
    pathname === "/app/meta-ads"
      ? html
      : pathname === "/api/meta-ads/data"
        ? JSON.stringify(
            apiMode === "empty" ? { ...apiSample, rows: [] } : apiMode === "error" ? {} : apiSample,
          )
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
    if (request.url().includes("/api/meta-ads/tiles/"))
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => (errors.push(error.message), console.error(error.message)));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(msg.text());
  });
  const frame = page.frameLocator("iframe");
  await page.goto(origin + "/app/meta-ads");
  const sidebar = page.getByRole("complementary", { name: "Navegação lateral Meta Ads" });
  await expect(sidebar).toBeVisible();
  assert.equal(Math.round((await sidebar.boundingBox()).width), 190, "Sidebar starts expanded");
  const sidebarColors = await sidebar.evaluate((element) => {
    const brand = element.querySelector("div");
    const ads = brand?.querySelector("strong");
    return {
      brand: brand ? getComputedStyle(brand).color : null,
      ads: ads ? getComputedStyle(ads).color : null,
    };
  });
  assert.equal(sidebarColors.ads, sidebarColors.brand, "Descomplica Ads uses one text color");
  await page.getByRole("button", { name: "Recolher menu lateral" }).click();
  await expect(page.getByRole("button", { name: "Expandir menu lateral" })).toBeVisible();
  await expect.poll(async () => Math.round((await sidebar.boundingBox()).width)).toBe(64);
  await expect(page.getByRole("link", { name: "Visão macro" })).toBeVisible();
  await page.getByRole("button", { name: "Expandir menu lateral" }).click();
  await expect(page.getByRole("button", { name: "Recolher menu lateral" })).toBeVisible();
  await expect.poll(async () => Math.round((await sidebar.boundingBox()).width)).toBe(190);
  await expect(frame.getByRole("heading", { name: "Comparar campanhas" })).toBeVisible();
  await expect(frame.locator('[data-kpi="spend"] strong')).toContainText("170,00");
  await expect(frame.locator('[data-kpi="leads"] strong')).toHaveText("12");
  const campaignRow = frame.locator('tr[data-open="11"]'),
    campaignStatusBox = await campaignRow.locator(".delivery-status").boundingBox(),
    investmentCellBox = await campaignRow.locator("td").nth(1).boundingBox();
  assert.ok(campaignStatusBox && investmentCellBox, "Campaign row geometry is available");
  assert.ok(
    campaignStatusBox.x + campaignStatusBox.width <= investmentCellBox.x,
    "Campaign delivery status stays inside the campaign column",
  );
  const activeStatus = frame.locator('[data-filter-option="status"][value="active"]'),
    archivedStatus = frame.locator('[data-filter-option="status"][value="archived"]'),
    allStatuses = frame.locator('[data-filter-all="status"]');
  await expect(activeStatus).toBeChecked();
  await expect(allStatuses).not.toBeChecked();
  assert.equal(await allStatuses.evaluate((input) => input.indeterminate), true);
  await frame.locator('[data-filter="status"] summary').click();
  await activeStatus.uncheck();
  await archivedStatus.check();
  const deletedCampaignRow = frame.locator('tr[data-open="777"]');
  await expect(deletedCampaignRow).toContainText("Campanha excluída QA");
  await expect(deletedCampaignRow.locator(".delivery-status")).toHaveText(
    "Excluída/arquivada (Meta)",
  );
  await expect(frame.locator('[data-kpi="spend"] strong')).toContainText("71,83");
  await archivedStatus.uncheck();
  await activeStatus.check();
  await expect(frame.locator("#compare-period")).not.toBeChecked();
  await frame.locator("#compare-period").check();
  await expect(frame.locator(".period-comparison").first()).toBeVisible();
  await expect(frame.locator('[data-kpi="spend"] small')).toContainText("325%");
  await frame.locator("#compare-period").uncheck();
  await frame.locator("#period").selectOption("custom");
  await frame.locator("#date-start").fill("2026-10-20");
  await frame.locator("#date-end").fill("2026-10-20");
  await frame.getByRole("button", { name: "Aplicar período" }).click();
  await expect(frame.locator('[data-kpi="spend"] strong')).toContainText("170,00");
  await frame.locator("#date-start").fill("2026-10-08");
  await frame.locator("#date-end").fill("2026-10-21");
  await frame.getByRole("button", { name: "Aplicar período" }).click();
  await frame.locator('[data-panel="trend"] [data-chart-tip]').first().hover();
  await expect(frame.locator("#chart-tooltip")).toContainText("08/10/2026");

  await frame.locator('[data-expand-chart="bars"]').click();
  await expect(frame.locator(".chart-expanded #period")).toBeVisible();
  await frame.locator('[data-expand-chart="bars"]').click();
  await frame.locator('[data-panel="bars"] .graph-type-menu summary').click();
  await frame.getByRole("button", { name: "Barras deitadas", exact: true }).click();
  await expect(frame.locator('[data-panel="bars"] svg')).toHaveAttribute(
    "aria-label",
    "Barras deitadas",
  );
  await expect(frame.locator(".graph-type-menu[open]")).toHaveCount(0);
  await frame.locator('[data-open="11"]').first().click();
  await expect(frame.getByRole("heading", { name: "Conjuntos de anúncios" })).toBeVisible();
  await frame.locator('[data-real-drill="22"]').click();
  await expect(frame.locator('[data-panel="sets"]')).toContainText("Criativo QA");
  await page.getByRole("button", { name: "settings", exact: true }).click();
  await expect(frame.getByRole("heading", { name: "Ajustes", exact: true })).toBeVisible();
  await frame.locator('[name="cap:whatsapp|campaign|11"]').fill("10");
  await frame.locator('[name="sample"]').fill("1");
  await frame.locator('[name="clickSample"]').fill("1");
  await frame.getByRole("button", { name: "Salvar ajustes" }).click();
  await page.getByRole("button", { name: "overview", exact: true }).click();
  await expect(frame.locator('[data-open="11"] td.bad')).toContainText("20,00");
  await page.getByRole("button", { name: /Alertas do Meta Ads/ }).click();
  await expect(frame.locator("#dialog")).toContainText("Recebido em");
  await frame.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(frame.locator("#dialog")).toContainText("0 não lidos");
  await frame.locator("#close-dialog").click();
  await page.reload();
  await expect(frame.locator('[data-kpi="spend"] strong')).toContainText("170,00");
  await page.getByRole("button", { name: "map", exact: true }).click();
  await expect(
    frame.getByRole("heading", { name: "Mapa de São Paulo", exact: true }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Bairros de São Paulo", exact: true }).click();
  await expect(frame.locator("#neighborhood-search")).toBeVisible();
  await frame.locator("#neighborhood-search").fill("Butantã");
  await expect(frame.locator("#neighborhood-results")).toContainText("Butantã");
  await expect(frame.locator(".map-note")).toContainText("Nenhum volume é distribuído");
  await page.getByRole("button", { name: "overview", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await frame.locator("#download-report").click();
  const download = await downloadPromise;
  await download.saveAs("/tmp/descomplica-compact-qa.pdf");
  await page.screenshot({ path: "/tmp/descomplica-compact-qa.png", fullPage: true });
  await page.getByRole("button", { name: "theme", exact: true }).click();
  await expect(frame.locator("body")).toHaveAttribute("data-theme", "medium");
  await page.setViewportSize({ width: 720, height: 900 });
  assert.equal(
    await page.frames()[1].evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    "No horizontal document overflow",
  );
  apiMode = "empty";
  await page.reload();
  await expect(frame.locator('[data-kpi="spend"] strong')).toContainText("0,00");
  await expect(frame.locator('[data-kpi="cpl"] strong')).toHaveText("—");
  const navigationPage = await browser.newPage();
  const navigationFrame = navigationPage.frameLocator("iframe");
  for (const [view, heading] of [
    ["campaigns", "Análise da campanha"],
    ["accounts", "Ajustes"],
    ["reports", "Relatórios"],
    ["overview", "Comparar campanhas"],
    ["map", "Mapa de São Paulo"],
    ["settings", "Ajustes"],
  ]) {
    await navigationPage.goto(new URL(`?view=${view}`, page.url()).href);
    await expect(
      navigationFrame.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await navigationPage.reload();
    await expect(
      navigationFrame.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await expect(navigationFrame.locator("html")).toHaveAttribute("data-crm-view", view);
  }
  await navigationPage.close();
  apiMode = "error";
  await page.reload();
  await expect(frame.locator("#main")).toContainText("Dados oficiais indisponíveis");
  await expect(frame.locator("[data-kpi]")).toHaveCount(0);
  assert.deepEqual(forbidden, [], "No external requests");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "Complete Meta Ads dashboard: real-row aggregation, comparison, chart controls, expansion, drilldown, caps, alert read history, map and PDF passed.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
