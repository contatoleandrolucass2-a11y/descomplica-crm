import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = process.cwd(),
  require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const entry = path.join(root, "test-results/lead-list-fixture.tsx").replaceAll("\\", "/");
const directory = path.join(root, "lib/crm/lead-plus/client").replaceAll("\\", "/");
const source = `import {createRoot} from 'react-dom/client';
import {AuthProvider,useAuth,HostSessionRequired} from '${directory}/Auth';
import UserViewSelector from '${directory}/UserViewSelector';
import {ConnectedLeads} from '${directory}/ConnectedCRM';
function App(){const auth=useAuth();return <><UserViewSelector/>{auth.loading||!auth.user?<HostSessionRequired/>:<ConnectedLeads key={auth.user.id}/>}</>};
createRoot(document.getElementById('root')).render(<AuthProvider><App/></AuthProvider>);`;
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
      name: "lead-list-fixture",
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
let sequence = 0,
  holdNext = false,
  revoked = false;
const requests = [],
  errors = [];
const rows = (actor) =>
  Array.from({ length: actor === "second" ? 75 : 121 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `${actor === "second" ? "Second" : "First"} ${String(index + 1).padStart(3, "0")}`,
    owner_id: actor,
    owner: actor,
    email: "fixture@example.invalid",
    phone: "0000000000",
    product: "Synthetic fixture",
    source: "manual",
    stage: 0,
    archived: false,
    value: 100,
    version: 1,
    created_at: "2026-11-01T12:00:00.000Z",
    updated_at: "2026-11-01T12:00:00.000Z",
    attribution: {},
  }));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1"),
    actor = req.headers["x-lead-view-as"] || "first";
  const send = (value, status = 200) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/fixture/hold") {
    holdNext = true;
    return send({ ok: true });
  }
  if (url.pathname === "/fixture/revoke") {
    revoked = true;
    return send({ ok: true });
  }
  if (url.pathname === "/app/leads/backend/session")
    return send({
      user: {
        id: actor,
        auth_id: "synthetic",
        name: actor,
        email: "fixture@example.invalid",
        team: "A",
        role: "broker",
        permissions: ["leads.view"],
        host_pages: ["/app/leads/lista"],
      },
      actor: {
        id: "first",
        auth_id: "synthetic",
        name: "First",
        email: "fixture@example.invalid",
        role: "admin",
      },
      view_as: { active: actor !== "first", target_id: actor, target_name: actor },
      viewable_users: [
        { id: "first", name: "First", role: "admin", team: "A" },
        { id: "second", name: "Second", role: "broker", team: "A" },
      ],
    });
  if (url.pathname === "/app/leads/backend/resources/users")
    return send({ data: [{ id: actor, name: actor, team: "A", active: true, version: 1 }] });
  if (url.pathname === "/app/leads/backend/leads") {
    if (revoked) return send({ error: "Sessão encerrada." }, 401);
    const cursor = url.searchParams.get("cursor");
    const previous = cursor ? JSON.parse(Buffer.from(cursor, "base64url").toString()) : null;
    const filters = {
      q: url.searchParams.get("q") || "",
      owner: url.searchParams.get("owner") || "",
      status: url.searchParams.get("status") || "all",
      category: url.searchParams.get("category") || "todo",
    };
    requests.push({ actor, cursor: !!cursor, filters });
    const scoped = rows(actor).filter(
      (row) =>
        row.name.toLowerCase().includes(filters.q.toLowerCase()) &&
        (!filters.owner || row.owner_id === filters.owner) &&
        filters.status !== "archived",
    );
    const selected = ["all", "todo"].includes(filters.category) ? scoped : [];
    const offset = previous?.offset || 0,
      snapshot = previous?.snapshot || `${actor}:${++sequence}`;
    const data = selected.slice(offset, offset + 50),
      next =
        offset + 50 < selected.length
          ? Buffer.from(JSON.stringify({ offset: offset + 50, snapshot })).toString("base64url")
          : null;
    if (cursor && holdNext && actor === "first") {
      holdNext = false;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    return send({
      data,
      total: selected.length,
      counts: {
        Todos: scoped.length,
        "A fazer": scoped.length,
        Visitas: 0,
        Futuras: 0,
        Favoritos: 0,
      },
      filters,
      snapshot,
      next_cursor: next,
      server_time: new Date().toISOString(),
    });
  }
  const asset = files.get(url.pathname);
  if (asset) {
    res.setHeader("content-type", url.pathname.endsWith(".css") ? "text/css" : "text/javascript");
    return res.end(asset.type === "chunk" ? asset.code : asset.source);
  }
  res.setHeader("content-type", "text/html");
  res.end(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script type="module" src="/${main.fileName}"></script></body></html>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await expect(page.locator(".lead-list-item")).toHaveCount(50);
  await expect(page.getByRole("tab", { name: "A fazer (121)" })).toBeVisible();
  await page.getByRole("button", { name: "Carregar mais leads" }).click();
  await expect(page.locator(".lead-list-item")).toHaveCount(100);
  const refreshedPage = page.waitForResponse(
    (response) => response.url().includes("/backend/leads?") && response.url().includes("cursor="),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("crm-update")));
  await expect
    .poll(() => requests.filter((request) => request.actor === "first" && !request.cursor).length)
    .toBeGreaterThan(1);
  await (await refreshedPage).finished();
  await expect(page.locator(".lead-list-item")).toHaveCount(100);
  await page.getByRole("button", { name: "Carregar mais leads" }).click();
  await expect(page.locator(".lead-list-item")).toHaveCount(121);
  await expect(page.getByRole("button", { name: "Carregar mais leads" })).toHaveCount(0);
  assert.equal(new Set(await page.locator(".lead-list-item strong").allTextContents()).size, 121);
  await page.getByPlaceholder("Buscar lead por nome...").fill("First 00");
  await expect(page.locator(".lead-list-item")).toHaveCount(9);
  await expect(page.getByRole("tab", { name: "A fazer (9)" })).toBeVisible();
  await page.getByRole("tab", { name: "Visitas (0)" }).click();
  await expect(page.locator(".lead-list-item")).toHaveCount(0);
  await page.getByRole("tab", { name: "Todos (9)" }).click();
  await expect(page.locator(".lead-list-item")).toHaveCount(9);
  await page.getByPlaceholder("Buscar lead por nome...").fill("");
  await expect(page.locator(".lead-list-item")).toHaveCount(50);
  await page.request.post(base + "/fixture/hold");
  const delayedPage = page.waitForResponse(
    (response) =>
      response.url().includes("/backend/leads?") &&
      response.url().includes("cursor=") &&
      !response.request().headers()["x-lead-view-as"],
  );
  const previousRequests = requests.length;
  await page.getByRole("button", { name: "Carregar mais leads" }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(previousRequests);
  await page.getByLabel("Visualizar como").selectOption("second");
  await expect(page.locator(".lead-list-item")).toHaveCount(50);
  await expect(page.locator(".lead-list-item").first()).toContainText("Second 001");
  await expect(page.getByRole("tab", { name: "A fazer (75)" })).toBeVisible();
  // Wait on the actual delayed response, not a timing assertion about page speed.
  await expect.poll(() => requests.some((request) => request.actor === "second")).toBe(true);
  await (await delayedPage).finished();
  await expect(page.locator(".lead-list-item")).toHaveCount(50);
  assert.ok(
    (await page.locator(".lead-list-item strong").allTextContents()).every((text) =>
      text.startsWith("Second"),
    ),
  );
  await page.request.post(base + "/fixture/revoke");
  await page.evaluate(() => window.dispatchEvent(new Event("crm-update")));
  await expect(page.locator(".lead-list-item")).toHaveCount(0);
  await expect(
    page.getByText("Não foi possível validar sua sessão. Atualize a página do CRM."),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  const evidence = {
    environment: "isolated Vite production browser fixture, synthetic API only",
    initialPage50: "passed",
    completeCounts: "passed",
    loadMoreNoDuplicates: "passed",
    refreshRetainsOpenedDepth: "passed",
    serverFilters: "passed",
    actorSwitchDiscardsDelayedResponse: "passed",
    revocation: "passed",
    requestCount: requests.length,
    errors,
  };
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/lead-pagination-browser.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
