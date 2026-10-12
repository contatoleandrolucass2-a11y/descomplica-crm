import assert from "node:assert/strict";
import { createCipheriv } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import { WebSocketServer } from "ws";

async function settleTheme(page) {
  // CSS transitions use the compositor clock, not Playwright's mocked timers.
  await page.evaluate(async () => {
    // Flush styles so the changed theme has created its transitions.
    getComputedStyle(document.body).color;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}

export async function checkConnectedSystems(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await page.goto(`${origin}/app/configuracoes`);
  await page.getByRole("button", { name: "Administração", exact: true }).click();
  await page
    .locator('[data-navigation-panel-for="admin.home"]')
    .getByRole("link", { name: /^Integrações\b/ })
    .click();
  await expect(page).toHaveURL(`${origin}/app/configuracoes/conectar-sistemas`);
  await expect(page.getByRole("heading", { name: "Integrações", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar Salesforce", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir no navegador", exact: true })).toHaveAttribute(
    "href",
    "https://direcional.my.salesforce.com/",
  );
  await expect(page.getByRole("link", { name: "Console de vendas", exact: true })).toHaveAttribute(
    "href",
    "https://direcional.lightning.force.com/lightning",
  );
  await expect(page.locator('[aria-labelledby="reports-title"] tbody a')).toHaveCount(7);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const checks = [];
  for (const theme of ["light", "balanced", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const label = { light: "Claro", balanced: "Médio", dark: "Escuro" }[theme];
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await settleTheme(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `Integrações overflow at ${width}px in ${theme}`);
      const result = await new AxeBuilder({ page }).include("main").analyze();
      assert.deepEqual(
        result.violations.map((item) => item.id),
        [],
        `Integrações axe ${theme}/${width}`,
      );
      await page.screenshot({
        path: path.join(outputDirectory, `${theme}-${width}.png`),
        fullPage: true,
      });
      checks.push({ theme, width, overflow, accessibilityViolations: result.violations.length });
    }
  }
  return { route: "/app/configuracoes/conectar-sistemas", checks };
}

// A loopback-only, synthetic RFB 3.8 peer. The browser runs the installed noVNC unchanged.
function syntheticFramebuffer(socket, { rejectCredentials = false, stall = false } = {}) {
  const password = "TestVnc1";
  const challenge = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const reversed = Buffer.from(
    [...Buffer.from(password)].map((byte) => {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) value = (value << 1) | ((byte >> bit) & 1);
      return value;
    }),
  );
  const cipher = createCipheriv(
    "des-ede3-ecb",
    Buffer.concat([reversed, reversed, reversed]),
    null,
  );
  cipher.setAutoPadding(false);
  const expected = Buffer.concat([cipher.update(challenge), cipher.final()]);
  const peer = {
    closed: false,
    frames: 0,
    authenticated: false,
    remoteTab: false,
    clipboard: 0,
    resize: 0,
    socket,
    stage: "version",
  };
  let pending = Buffer.alloc(0);
  let stage = "version";
  let littleEndian = true;
  let shifts = [16, 8, 0];
  const width = 640;
  const height = 360;
  function frame() {
    const update = Buffer.alloc(16 + width * height * 4);
    update.writeUInt16BE(1, 2);
    update.writeUInt16BE(width, 8);
    update.writeUInt16BE(height, 10);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rgb = y < 60 ? [235, 238, 242] : x < width / 2 ? [32, 140, 96] : [34, 115, 180];
        const pixel = ((rgb[0] << shifts[0]) | (rgb[1] << shifts[1]) | (rgb[2] << shifts[2])) >>> 0;
        const offset = 16 + (y * width + x) * 4;
        if (littleEndian) update.writeUInt32LE(pixel, offset);
        else update.writeUInt32BE(pixel, offset);
      }
    }
    socket.send(update);
    peer.frames++;
  }
  socket.onClose(() => {
    peer.closed = true;
  });
  socket.onMessage((message) => {
    pending = Buffer.concat([pending, Buffer.from(message)]);
    while (pending.length) {
      peer.stage = stage;
      let length;
      if (stage === "version") length = 12;
      else if (stage === "security" || stage === "client-init") length = 1;
      else if (stage === "challenge") length = 16;
      else {
        const type = pending[0];
        length = { 0: 20, 3: 10, 4: 8, 5: 6 }[type];
        if (type === 2) {
          if (pending.length < 4) return;
          length = 4 + pending.readUInt16BE(2) * 4;
        }
        if (type === 6) peer.clipboard++;
        if (type === 251) peer.resize++;
        assert.ok(length, `Unexpected RFB client message ${type}`);
      }
      if (pending.length < length) return;
      const packet = pending.subarray(0, length);
      pending = pending.subarray(length);
      if (stage === "version") {
        assert.equal(packet.toString(), "RFB 003.008\n");
        stage = "security";
        socket.send(Buffer.from([1, 2]));
      } else if (stage === "security") {
        assert.equal(packet[0], 2);
        stage = "challenge";
        socket.send(challenge);
      } else if (stage === "challenge") {
        assert.ok(packet.equals(expected), "Synthetic VNC challenge response must match");
        if (rejectCredentials) {
          const reason = Buffer.from("synthetic-private-reason");
          const failure = Buffer.alloc(8);
          failure.writeUInt32BE(1);
          failure.writeUInt32BE(reason.length, 4);
          socket.send(Buffer.concat([failure, reason]));
          return;
        }
        peer.authenticated = true;
        stage = "client-init";
        socket.send(Buffer.alloc(4));
      } else if (stage === "client-init") {
        assert.equal(packet[0], 1, "Viewer must share, never replace the VPS session");
        stage = "messages";
        const name = Buffer.from("Synthetic framebuffer");
        const init = Buffer.alloc(24);
        init.writeUInt16BE(width);
        init.writeUInt16BE(height, 2);
        init[4] = 32;
        init[5] = 24;
        init[7] = 1;
        for (const offset of [8, 10, 12]) init.writeUInt16BE(255, offset);
        init[14] = 16;
        init[15] = 8;
        init.writeUInt32BE(name.length, 20);
        socket.send(Buffer.concat([init, name]));
      } else if (packet[0] === 0) {
        assert.equal(packet[4], 32);
        littleEndian = packet[6] === 0;
        shifts = [packet[14], packet[15], packet[16]];
      } else if (packet[0] === 3 && peer.frames === 0) frame();
      else if (packet[0] === 4 && packet[1] === 1 && packet.readUInt32BE(4) === 0xff09)
        peer.remoteTab = true;
    }
  });
  if (!stall) socket.send(Buffer.from("RFB 003.008\n"));
  return peer;
}

async function checkSyntheticConsole(page, directory, setSnapshot, fixture) {
  const { peers } = fixture;
  let ticketStatus = 200;
  let holdTicket = false;
  let releaseTicket;
  let tickets = 0;
  await page.route("**/api/salesforce/console", async (route) => {
    tickets++;
    assert.equal(route.request().method(), "POST");
    assert.equal(route.request().postData(), null);
    if (holdTicket)
      await new Promise((resolve) => {
        releaseTicket = resolve;
      });
    await route
      .fulfill({
        status: ticketStatus,
        json:
          ticketStatus === 200
            ? { password: "TestVnc1", websocketPath: "/salesforce-console/socket", expiresIn: 600 }
            : { error: "synthetic-private-reason" },
      })
      .catch(() => {});
  });
  const open = page.getByRole("button", { name: "Conectar Salesforce", exact: true });
  await expect(open).toBeDisabled();
  assert.equal(tickets, 0);
  setSnapshot();
  await page.evaluate(() => window.qaRender({ consoleAvailable: true }));
  const status = page.locator('[role="status"][data-state]');
  await expect(status).toHaveText("Não conectado");
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Salesforce", exact: true });
  const close = dialog.getByRole("button", { name: "Fechar console", exact: true });
  try {
    await expect(dialog.getByRole("status")).toHaveText("Console conectado");
  } catch (error) {
    process.stderr.write(
      JSON.stringify(
        peers.map(({ stage, closed, frames, authenticated }) => ({
          stage,
          closed,
          frames,
          authenticated,
        })),
      ) + "\n",
    );
    throw error;
  }
  await expect(close).toBeFocused();
  await expect(status).toHaveText("Não conectado");
  const canvas = dialog.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "640");
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const context = element.getContext("2d");
        return [...context.getImageData(20, 100, 1, 1).data];
      }),
    )
    .toEqual([32, 140, 96, 255]);
  assert.deepEqual(
    await canvas.evaluate((element) => [
      ...element.getContext("2d").getImageData(500, 100, 1, 1).data,
    ]),
    [34, 115, 180, 255],
  );
  for (const theme of ["light", "balanced", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
      await page.clock.runFor(100);
      await settleTheme(page);
      const rect = await canvas.boundingBox();
      assert.ok(
        rect &&
          rect.width > 100 &&
          rect.height > 50 &&
          rect.x >= 0 &&
          rect.x + rect.width <= width + 1,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      const axe = await new AxeBuilder({ page }).include("dialog").analyze();
      await page.screenshot({ path: path.join(directory, `console-${theme}-${width}.png`) });
      assert.deepEqual(
        axe.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        })),
        [],
        `Console axe ${theme}/${width}`,
      );
    }
  }
  await page.keyboard.press("Tab");
  await expect(canvas).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(canvas).toBeFocused();
  await expect.poll(() => peers[0].remoteTab).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(canvas).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await expect.poll(() => peers[0].closed).toBe(true);
  await open.click();
  await expect(dialog.getByRole("status")).toHaveText("Console conectado");
  peers.at(-1).socket.close({ code: 1000 });
  await expect(dialog.getByRole("status")).toContainText("Console desconectado");
  await expect(canvas).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Console conectado");
  await expect(close).toBeFocused();
  const expiring = peers.at(-1);
  await page.clock.runFor(600_000);
  await expect(dialog.getByRole("status")).toContainText("Acesso ao console expirado");
  await expect(canvas).toHaveCount(0);
  await expect.poll(() => expiring.closed).toBe(true);
  await close.click();

  fixture.rejectCredentials = true;
  await open.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveText(
    "Não foi possível autorizar o console. Tente novamente.",
  );
  await expect(open).toBeFocused();
  fixture.rejectCredentials = false;
  ticketStatus = 403;
  const beforeUnauthorized = peers.length;
  await open.click();
  await expect(page.getByRole("alert")).toBeVisible();
  assert.equal(peers.length, beforeUnauthorized);
  assert.equal(
    await page
      .locator("body")
      .innerText()
      .then((text) => text.includes("synthetic-private-reason")),
    false,
  );
  ticketStatus = 503;
  await open.click();
  await expect(dialog.getByRole("status")).toContainText("Não foi possível conectar ao console");
  ticketStatus = 200;
  await dialog.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Console conectado");
  await close.click();

  fixture.stall = true;
  await open.click();
  await expect(dialog.getByRole("status")).toContainText("Conectando ao console");
  await page.clock.runFor(30_000);
  await expect(dialog.getByRole("status")).toContainText("Não foi possível conectar ao console");
  await close.click();
  fixture.stall = false;

  holdTicket = true;
  await open.click();
  await expect.poll(() => Boolean(releaseTicket)).toBe(true);
  const beforeClose = peers.length;
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(
      () =>
        window.qaRequests.filter((request) => request.url === "/api/salesforce/console").at(-1)
          .aborted,
    ),
    true,
  );
  releaseTicket();
  await page.clock.runFor(100);
  assert.equal(peers.length, beforeClose, "Late ticket must not open a new socket");
  assert.ok(peers.every((peer) => peer.clipboard === 0 && peer.resize === 0));
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.evaluate(() => window.qaRender());
  const result = {
    status: "passed",
    fixture: "synthetic-rfb-not-real-salesforce",
    checkedAt: new Date().toISOString(),
    realNoVNC: true,
    passwordHandshake: true,
    pixelChecks: 2,
    responsiveThemeChecks: 9,
    closeRetryExpiry: true,
  };
  await writeFile(
    path.join(directory, "console-results.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  return result;
}

async function runSynthetic() {
  const root = path.resolve(import.meta.dirname, "../..");
  const nextImageStub = "\0connected-systems-next-image";
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path.join(root, "scripts/qa/connected-systems-memory.tsx").replaceAll("\\", "/");
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
        name: "connected-systems-synthetic",
        enforce: "pre",
        resolveId(id) {
          if (id === "next/image") return nextImageStub;
          if (id.endsWith("connected-systems-memory.tsx")) return entry;
        },
        load(id) {
          if (id === nextImageStub)
            return `
              import { createElement } from "react";
              export default function Image({ src, ...props }) {
                return createElement("img", {
                  ...props,
                  src: typeof src === "string" ? src : src.src,
                });
              }
            `;
          if (id === entry)
            return `
          import { createRoot } from "react-dom/client";
          import { ConnectedSystemsPanel } from "@/app/(protected)/app/configuracoes/conectar-sistemas/ConnectedSystemsPanel";
          import { ProtectedShellFrame } from "@/app/(protected)/_components/ProtectedShellFrame";
          import shellStyles from "@/app/(protected)/_components/ProtectedShell.module.css";
          import "@/app/globals.css";
          const root = createRoot(document.getElementById("root"));
          window.qaUnmount = () => root.unmount();
          window.qaRender = (props = {}) => root.render(
            <ProtectedShellFrame shellClassName={shellStyles.shell} contentClassName={shellStyles.mainContent}
              chrome={<header className={shellStyles.topbar}>Descomplica · Ambiente sintético</header>}>
              <ConnectedSystemsPanel key={JSON.stringify(props)} ingestLabel="Configurada" refreshAvailable canRefresh statusConfigured {...props} />
            </ProtectedShellFrame>
          );
          window.qaRender();
        `;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "ConnectedSystemsQa", formats: ["es"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  for (const asset of [
    "n8n-dark.svg",
    "n8n-light.svg",
    "salesforce.svg",
    "supabase-dark.svg",
    "supabase-light.svg",
  ]) {
    files.set(
      `/integrations/${asset}`,
      await readFile(path.join(root, "public/integrations", asset)),
    );
  }
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script);
  const css = [...files.keys()].filter((file) => file.endsWith(".css"));
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Conectar Sistemas QA</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css.map((file) => `<link rel="stylesheet" href="${file}">`).join("")}</head><body><div id="root"></div><script type="module" src="/${script}"></script></body></html>`;
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(html);
      return;
    }
    if (files.has(url.pathname)) {
      response.setHeader(
        "Content-Type",
        url.pathname.endsWith(".css")
          ? "text/css"
          : url.pathname.endsWith(".svg")
            ? "image/svg+xml"
            : "text/javascript",
      );
      response.end(files.get(url.pathname));
      return;
    }
    response.writeHead(404).end();
  });
  const consoleFixture = { peers: [], rejectCredentials: false, stall: false };
  const websocketServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/salesforce-console/socket") {
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (client) => {
      consoleFixture.peers.push(
        syntheticFramebuffer(
          {
            send: (message) => client.send(message),
            close: ({ code = 1000 } = {}) => client.close(code),
            onMessage: (callback) => client.on("message", callback),
            onClose: (callback) => client.on("close", callback),
          },
          consoleFixture,
        ),
      );
    });
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.fallback();
      return route.abort("blockedbyclient");
    });
    await page.addInitScript(() => {
      const original = window.fetch;
      window.qaRequests = [];
      window.fetch = (url, options) => {
        const record = {
          url,
          cache: options?.cache,
          credentials: options?.credentials,
          aborted: false,
        };
        window.qaRequests.push(record);
        options?.signal?.addEventListener("abort", () => {
          record.aborted = true;
        });
        return original(url, options);
      };
    });
    const base = {
      state: "connected",
      checkedAt: "2026-10-08T15:00:00.000Z",
      receivedAt: "2026-10-08T15:00:01.000Z",
      nextRunAt: "2026-10-08T15:30:00.000Z",
      cycle: "succeeded",
      lastExportAt: "2026-10-08T14:58:00.000Z",
      lastPublishedAt: null,
      errorCode: null,
      reports: [
        "opportunities",
        "appointments",
        "visits",
        "folders",
        "sales",
        "brokers",
        "imobAccounts",
      ].map((key, index) => ({ key, rows: index * 1234 })),
    };
    let snapshot = base;
    let statusCode = 200;
    let requests = 0;
    let release;
    let hold = false;
    await page.route("**/api/salesforce/status", async (route) => {
      requests++;
      if (hold)
        await new Promise((resolve) => {
          release = resolve;
        });
      await route.fulfill({ status: statusCode, json: snapshot }).catch(() => {});
    });
    let refreshes = 0;
    await page.route("**/api/refresh/salesforce", async (route) => {
      refreshes++;
      await route.fulfill({ json: { status: "started" } });
    });
    await page.clock.install();
    await page.goto(origin);
    await page.evaluate(() => new Promise((resolve) => queueMicrotask(resolve)));
    assert.deepEqual(errors, [], "Connected systems synthetic render errors");
    if (process.argv.includes("--console-only")) {
      const directory = path.join(root, "output/playwright/connected-systems");
      await mkdir(directory, { recursive: true });
      const checks = await checkSyntheticConsole(
        page,
        directory,
        () => {
          snapshot = { ...base, state: "reauth_required" };
        },
        consoleFixture,
      );
      assert.deepEqual(errors, []);
      process.stdout.write(
        JSON.stringify({ status: "passed", console: checks, screenshots: directory }) + "\n",
      );
      return;
    }
    const status = page.locator('[role="status"][data-state]');
    const verify = page.getByRole("button", { name: "Verificar conexão", exact: true });
    await expect(status).toHaveText("Conectado");
    await expect(page.locator("img")).toHaveCount(5);
    assert.deepEqual(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images
            .filter((image) => !image.complete || image.naturalWidth === 0)
            .map((image) => image.src),
        ),
      [],
      "Connected systems logos must load",
    );
    await expect(page.getByText("Sem publicação confirmada", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Oportunidades/ })).toContainText("0");
    await expect(page.getByRole("row", { name: /Agendamentos/ })).toContainText("1.234");
    await expect(page.locator("tbody tr")).toHaveCount(7);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.qaRequests[0]), {
      url: "/api/salesforce/status",
      cache: "no-store",
      credentials: "same-origin",
      aborted: false,
    });
    await verify.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => requests).toBe(2);
    assert.equal(refreshes, 0, "Checking the session never triggers ingestion");
    await expect(verify).toBeEnabled();
    await page.getByRole("button", { name: "Atualizar Salesforce", exact: true }).click();
    await expect.poll(() => refreshes).toBe(1);
    await expect(page.getByText("Sem publicação confirmada", { exact: true })).toBeVisible();

    const collection = page.locator("dl > div").filter({
      has: page.getByText("Coleta", { exact: true }),
    });
    const publication = page.locator("dl > div").filter({
      has: page.getByText("Última publicação no CRM", { exact: true }),
    });
    await expect(page.getByText("Autenticação manual com MFA", { exact: true })).toBeVisible();
    const collected = {
      ...base,
      cycle: "failed",
      errorCode: "publication_failed",
      lastExportAt: "2026-10-08T15:00:00.000Z",
      lastPublishedAt: "2026-10-08T14:59:00.000Z",
      reports: base.reports.map((report) => ({ ...report, rows: report.rows + 100 })),
    };
    snapshot = collected;
    await verify.click();
    await expect(publication.getByText("Publicação não confirmada", { exact: true })).toBeVisible();
    await expect(collection.locator("dd")).toHaveText("Concluída");
    await expect(page.getByRole("row", { name: /Agendamentos/ })).toContainText("1.334");
    await expect(page.locator('time[datetime="2026-10-08T15:00:00.000Z"]')).toHaveCount(10);
    await expect(publication.locator("time")).toHaveAttribute(
      "datetime",
      collected.lastPublishedAt,
    );
    snapshot = { ...collected, lastPublishedAt: null };
    await verify.click();
    await expect(publication.locator("dd")).toHaveText("Publicação não confirmada");
    await expect(publication.locator("time")).toHaveCount(0);
    snapshot = { ...base, cycle: "failed", errorCode: "export_failed" };
    await verify.click();
    await expect(collection.locator("dd")).toHaveText("Coleta não concluída");
    await expect(publication.getByText("Publicação não confirmada", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("row", { name: /Agendamentos/ })).toContainText("1.234");
    snapshot = base;
    await verify.click();
    await expect(collection.locator("dd")).toHaveText("Concluída");

    const directory = path.join(root, "output/playwright/connected-systems");
    await mkdir(directory, { recursive: true });
    for (const theme of ["light", "balanced", "dark"]) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await settleTheme(page);
        await page.screenshot({
          path: path.join(directory, `${theme}-${width}.png`),
          fullPage: true,
        });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `Overflow: ${theme}/${width} ${JSON.stringify(
            await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  (element) =>
                    element.getBoundingClientRect().right > innerWidth + 1 &&
                    !element.closest("table"),
                )
                .map((element) => ({
                  tag: element.tagName,
                  class: element.className,
                  width: element.getBoundingClientRect().width,
                }))
                .slice(0, 10),
            ),
          )}`,
        );
        const axe = await new AxeBuilder({ page }).include("main").analyze();
        assert.deepEqual(
          axe.violations.map(({ id, nodes }) => ({
            id,
            elements: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
          })),
          [],
          `Axe: ${theme}/${width}`,
        );
        await page.screenshot({
          path: path.join(directory, `${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      "200% zoom overflow",
    );
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });

    const consoleChecks = await checkSyntheticConsole(
      page,
      directory,
      () => {
        snapshot = { ...base, state: "reauth_required" };
      },
      consoleFixture,
    );

    for (const [state, label] of [
      ["waiting", "Não verificado"],
      ["reauth_required", "Não conectado"],
      ["stale", "Suspenso"],
      ["unavailable", "Não conectado"],
      ["unconfigured", "Não conectado"],
    ]) {
      snapshot = { ...base, state };
      await verify.click();
      await expect(status).toHaveText(label);
    }
    snapshot = { ...base, lastPublishedAt: "2026-10-08T14:59:00.000Z" };
    await verify.click();
    await expect(page.locator('time[datetime="2026-10-08T14:59:00.000Z"]')).toBeVisible();
    statusCode = 503;
    await verify.click();
    await expect(status).toHaveText("Não conectado");
    await expect(page.getByText("Sem dados", { exact: true })).toHaveCount(7);
    statusCode = 200;
    for (const invalid of [
      { state: "connected" },
      { ...base, checkedAt: null },
      { ...base, reports: [{ key: "sales", rows: -1 }] },
    ]) {
      snapshot = invalid;
      await verify.click();
      await expect(verify).toBeEnabled();
      await expect(status).toHaveText("Não conectado");
    }
    snapshot = base;
    await verify.click();
    await expect(status).toHaveText("Conectado");
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    snapshot = { ...base, state: "stale" };
    await page.clock.runFor(15_000);
    await expect(status).toHaveText("Suspenso");
    await expect(verify).toBeEnabled();
    hold = true;
    const beforeHold = requests;
    await verify.click();
    await expect.poll(() => requests).toBe(beforeHold + 1);
    await page.clock.runFor(9_000);
    assert.equal(requests, beforeHold + 1, "No overlapping polling");
    await expect(verify).toBeDisabled();
    await page.clock.runFor(1_000);
    await expect(status).toHaveText("Não conectado");
    hold = false;
    release();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const beforeHidden = requests;
    await page.clock.runFor(60_000);
    assert.equal(requests, beforeHidden, "Hidden tabs do not poll");
    snapshot = base;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(status).toHaveText("Conectado");
    await page.evaluate(() => window.qaRender({ canRefresh: false, statusConfigured: false }));
    await expect(status).toHaveText("Não conectado");
    await expect(
      page.getByRole("button", { name: "Atualizar Salesforce", exact: true }),
    ).toHaveCount(0);
    hold = true;
    await verify.click();
    await expect(verify).toBeDisabled();
    await page.evaluate(() => window.qaUnmount());
    await expect.poll(() => page.evaluate(() => window.qaRequests.at(-1).aborted)).toBe(true);
    const beforeUnmount = requests;
    await page.clock.runFor(60_000);
    assert.equal(requests, beforeUnmount, "Unmount cancels timers");
    release();
    assert.deepEqual(errors, []);
    process.stdout.write(
      JSON.stringify({
        status: "passed",
        responsiveThemeChecks: 9,
        zoom: "200%",
        states: 6,
        polling: "no overlap; timeout; hidden; cleanup",
        console: consoleChecks,
        screenshots: directory,
      }) + "\n",
    );
  } finally {
    await browser?.close();
    for (const client of websocketServer.clients) client.terminate();
    await new Promise((resolve) => websocketServer.close(resolve));
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url &&
  process.argv.includes("--synthetic")
)
  await runSynthetic();
