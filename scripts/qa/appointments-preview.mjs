import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(root, "test-results/appointments-preview");
const componentDirectory = "app/(protected)/app/etapas/_components";
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const owners = Array.from(
  { length: 24 },
  (_, i) =>
    `Responsável sintético ${String(i + 1).padStart(2, "0")} Nome completo longo para validar leitura integral`,
);
const brokerRoster = Array.from({ length: 120 }, (_, index) => ({
  key: `broker-${String(index + 1).padStart(3, "0")}`,
  owner: owners[index] ?? `Corretor cadastrado sem atividade ${String(index + 1).padStart(3, "0")}`,
  manager: [
    "Ana Gerente sintética com sobrenome extenso",
    "Bruno Gerente sintético",
    "Clara Gerente sintética",
    "Davi Gerente sintético",
    "Eva Gerente sintética",
  ][index % 5],
}));
const fixture = {
  version: 4,
  brokerCount: 120,
  brokerManagerCount: 5,
  viewKey: "all",
  coverageStart: "2025-10-01",
  referenceDate: "2026-03-31",
  dimensions: {
    managers: [
      "Ana Gerente sintética com sobrenome extenso",
      "Bruno Gerente sintético",
      "Clara Gerente sintética",
      "Davi Gerente sintético",
      "Eva Gerente sintética",
    ],
    owners,
    companies: ["Empresa sintética"],
    developments: [
      "Empreendimento sintético Jardim das Flores e das Árvores de Nome Extenso",
      "Residencial sintético B",
      "Residencial sintético C",
      "Residencial sintético D",
      "Residencial sintético E",
      "Residencial sintético F",
    ],
    stores: [
      "Loja sintética Centro com descrição extensa",
      "Loja sintética Norte",
      "Loja sintética Sul",
      "Loja sintética Leste",
    ],
  },
  facts: [
    ...Array.from({ length: 31 }, (_, i) => [
      1,
      `2026-03-${String(i + 1).padStart(2, "0")}`,
      i % 5,
      i % 24,
      0,
      1,
      i % 6,
      (i % 4) + 1,
      0,
      0,
      i % 4,
    ]),
    [1, "2026-01-12", 0, 0, 0, 1, 0, 7, 0, 0, 0],
    [1, "2025-10-14", 0, 0, 0, 1, 0, 9, 0, 0, 0],
    [1, "2025-12-22", 0, 0, 0, 1, 0, 13, 0, 0, 0],
    [0, "2026-03-01", 0, 0, 0, 1, 0, 99999, 0, 0, -1],
    [2, "2026-03-31", 0, 0, 0, 1, 0, 33, 0, 0, -1],
    [4, "2026-03-31", 0, 0, 0, 1, 0, 5, 0, 0, -1],
  ],
  appointments: [
    ...Array.from({ length: 31 }, (_, day) =>
      Array.from({ length: (day % 4) + 1 }, (_, record) => ({
        createdAt: `2026-03-${String(day + 1).padStart(2, "0")}T12:${String(record).padStart(2, "0")}:00Z`,
        scheduledAt: day === 30 ? `2026-03-31T15:${String(record).padStart(2, "0")}:00Z` : null,
        attendedAt:
          day === 30 && record % 2 === 0
            ? `2026-03-31T16:${String(record).padStart(2, "0")}:00Z`
            : null,
        visitPerformed: day === 30 && record % 2 === 0,
        regionalManager: `Regional sintético ${(day % 3) + 1}`,
        salesManager: [
          "Ana Gerente sintética com sobrenome extenso",
          "Bruno Gerente sintético",
          "Clara Gerente sintética",
          "Davi Gerente sintético",
          "Eva Gerente sintética",
        ][day % 5],
        owner: owners[day % owners.length],
        accountName: `Conta sintética ${String(day + 1).padStart(2, "0")}`,
        accountRanking: ["Ouro", "Prata", "Bronze"][day % 3],
        channel: 1,
        company: "Empresa sintética",
        registeredBroker: true,
      })),
    ).flat(),
    ...[
      ["2026-01-12", 7],
      ["2025-10-14", 9],
      ["2025-12-22", 13],
    ].flatMap(([date, count]) =>
      Array.from({ length: count }, (_, index) => ({
        createdAt: `${date}T12:${String(index).padStart(2, "0")}:00Z`,
        scheduledAt: null,
        attendedAt: null,
        visitPerformed: false,
        regionalManager: "Regional histórico",
        salesManager: "Ana Gerente sintética com sobrenome extenso",
        owner: owners[0],
        accountName: "Conta histórica",
        accountRanking: "Ouro",
        channel: 1,
        company: "Empresa sintética",
        registeredBroker: true,
      })),
    ),
  ],
};

async function productionCss(viteCss) {
  const buildTime = await stat(path.join(root, ".next/BUILD_ID"));
  for (const name of [
    "AppointmentsDashboard.tsx",
    "AppointmentsDashboard.module.css",
    "ChartBoard.tsx",
    "ChartBoard.module.css",
  ])
    assert.ok(
      (await stat(path.join(root, componentDirectory, name))).mtimeMs <= buildTime.mtimeMs,
      "Next production build is stale; run pnpm build before production CSS QA",
    );
  const nextRequire = createRequire(require.resolve("next/package.json"));
  const postcss = nextRequire("postcss");
  const cssFiles = (await readdir(path.join(root, ".next/static/chunks"))).filter((name) =>
    name.endsWith(".css"),
  );
  const compiled = (
    await Promise.all(
      cssFiles.map((name) => readFile(path.join(root, ".next/static/chunks", name), "utf8")),
    )
  ).join("\n");
  const viteRules = postcss.parse(viteCss);
  const mappings = new Map();
  const moduleAnchor = compiled.match(/\.([\w-]+)_verticalLabels\b/);
  assert.ok(moduleAnchor, "Compiled AppointmentsDashboard CSS module must exist");
  const modulePrefix = moduleAnchor[1];
  const compiledClass = new RegExp(`\\.(${modulePrefix}_([\\w-]+))\\b`, "g");
  for (const match of compiled.matchAll(compiledClass)) {
    const vite = [...viteCss.matchAll(/\.([\w-]+)\b/g)].find(
      (item) =>
        item[1].startsWith("AppointmentsDashboard_module_") && item[1].includes(`_${match[2]}_`),
    );
    assert.ok(vite, `Vite class for ${match[2]} must exist`);
    mappings.set(vite[1], match[1]);
  }
  assert.ok(mappings.size > 10, "Scoped Next AppointmentsDashboard CSS must exist");
  const boardAnchor = compiled.match(
    /\.([\w-]+)_board\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
  );
  assert.ok(boardAnchor, "Compiled ChartBoard CSS module must exist");
  for (const match of compiled.matchAll(new RegExp(`\\.(${boardAnchor[1]}_([\\w-]+))\\b`, "g"))) {
    const vite = [...viteCss.matchAll(/\.([\w-]+)\b/g)].find(
      (item) => item[1].startsWith("ChartBoard_module_") && item[1].includes(`_${match[2]}_`),
    );
    assert.ok(vite, `Vite ChartBoard class for ${match[2]} must exist`);
    mappings.set(vite[1], match[1]);
  }
  const transformed = postcss.parse(compiled);
  transformed.walkRules((rule) => {
    for (const [vite, next] of mappings)
      rule.selector = rule.selector.replace(new RegExp(`\\.${next}(?![\\w-])`, "g"), `.${vite}`);
  });
  viteRules.walkRules((rule) => {
    if ([...mappings.keys()].some((name) => rule.selector.includes(`.${name}`))) rule.remove();
  });
  return {
    css: `${viteRules}\n${transformed}`,
    evidence: {
      mode: "Next production CSS; Vite component rules removed",
      buildCompletedAt: buildTime.mtime.toISOString(),
      sha256: createHash("sha256").update(compiled).digest("hex"),
      cssFiles,
    },
  };
}

async function runCanvasPreview({ page, origin, evidence, check }) {
  const viewports = [
    { width: 320, height: 900 },
    { width: 390, height: 900 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  const themes = ["light", "balanced", "dark"];
  evidence.canvas = { screens: [], interactions: [] };

  for (const viewport of process.argv.includes("--canvas-interactions-only") ? [] : viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}?editable`);
    await expect(page.getByRole("heading", { name: "Agendamentos", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "House", exact: true }).click();
    await expect(page.locator("[data-dashboard-card-id]")).toHaveCount(28);

    for (const theme of themes) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await page.waitForTimeout(120);
      const layout = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("[data-dashboard-card-id]")].filter((card) =>
          card.checkVisibility(),
        );
        const boxes = cards.map((card) => {
          const rect = card.getBoundingClientRect();
          return {
            id: card.getAttribute("data-dashboard-card-id"),
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
          };
        });
        const overlaps = [];
        for (let index = 0; index < boxes.length; index += 1) {
          for (const other of boxes.slice(index + 1)) {
            const first = boxes[index];
            if (
              Math.min(first.right, other.right) - Math.max(first.left, other.left) > 1 &&
              Math.min(first.bottom, other.bottom) - Math.max(first.top, other.top) > 1
            )
              overlaps.push(`${first.id}/${other.id}`);
          }
        }
        const toolbar = document.querySelector(
          '[role="toolbar"][aria-label="Ferramentas do dashboard"]',
        );
        return {
          count: cards.length,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          outside: boxes.filter(({ left, right }) => left < -1 || right > innerWidth + 1),
          overlaps,
          mobileColumns:
            innerWidth > 390
              ? null
              : {
                  lefts: [...new Set(boxes.map(({ left }) => Math.round(left)))],
                  widths: [...new Set(boxes.map(({ width }) => Math.round(width)))],
                },
          toolbarOverflow: Boolean(toolbar && toolbar.scrollWidth > toolbar.clientWidth + 1),
          recencyBorders: ["recency-up-to-7", "recency-8-to-14", "recency-15-plus"].map((id) => {
            const panel = document.querySelector(
              `[data-dashboard-card-id="${id}"] [class*="recencyPanel"]`,
            );
            return panel ? getComputedStyle(panel).boxShadow : null;
          }),
        };
      });
      check(layout.count === 28, `28 canvas cards ${theme}/${viewport.width}`);
      check(
        layout.documentWidth <= layout.viewportWidth + 1,
        `No document overflow ${theme}/${viewport.width}`,
      );
      check(layout.outside.length === 0, `Cards fit viewport ${theme}/${viewport.width}`);
      check(layout.overlaps.length === 0, `Cards do not overlap ${theme}/${viewport.width}`);
      check(!layout.toolbarOverflow, `Toolbar fits ${theme}/${viewport.width}`);
      if (layout.mobileColumns)
        check(
          layout.mobileColumns.lefts.length === 1 && layout.mobileColumns.widths.length === 1,
          `Single readable card column ${theme}/${viewport.width}`,
        );
      check(
        layout.recencyBorders.every(Boolean) && new Set(layout.recencyBorders).size === 3,
        `Distinct recency states ${theme}/${viewport.width}`,
      );

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = axe.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      );
      check(
        serious.length === 0,
        `Canvas axe ${theme}/${viewport.width}: ${serious.map(({ id }) => id).join(",")}`,
      );
      const screenshot = path.join(
        outputRoot,
        `canvas-${theme}-${viewport.width}x${viewport.height}.png`,
      );
      await page.screenshot({ path: screenshot, fullPage: true });
      evidence.canvas.screens.push({ viewport, theme, layout, screenshot });
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}?editable`);
  await page.getByRole("button", { name: "House", exact: true }).click();
  const cards = page.locator("[data-dashboard-card-id]");
  await expect(cards).toHaveCount(28);
  const readOrder = () =>
    cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.dashboardCardId));
  const initialOrder = await readOrder();
  const goalCard = page.locator('[data-dashboard-card-id="appointments-goal"]');
  check((await goalCard.locator("header strong").count()) === 0, "Duplicate header removed");
  const mover = goalCard.getByRole("button", { name: "Mover Meta do mês", exact: true });
  await page.mouse.move(0, 0);
  check(
    (await mover.evaluate((node) => getComputedStyle(node.parentElement).opacity)) === "0",
    "Move icon hidden at rest",
  );
  await goalCard.hover();
  check(
    (await mover.evaluate((node) => getComputedStyle(node.parentElement).opacity)) === "1",
    "Move icon revealed on hover",
  );
  await page.screenshot({ path: path.join(outputRoot, "compact-controls-hover.png") });
  const resize = goalCard.getByRole("button", { name: "Redimensionar Meta do mês", exact: true });
  const initialBounds = await goalCard.boundingBox();
  const handleBounds = await resize.boundingBox();
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2,
    handleBounds.y + handleBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2 + 120,
    handleBounds.y + handleBounds.height / 2 + 37,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await goalCard.boundingBox()).height)
    .toBe(initialBounds.height + 37);
  check(
    (await goalCard.boundingBox()).width > initialBounds.width,
    "Pointer resizes horizontally and vertically",
  );
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await goalCard.hover();
  await goalCard.getByRole("button", { name: "Editar Meta do mês", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Editar card", exact: true });
  const heightInput = editor.getByLabel("Altura do card", { exact: false });
  const widthInput = editor.getByLabel("Largura do card", { exact: false });
  await heightInput.fill("");
  await expect(heightInput).toHaveValue("");
  await heightInput.pressSequentially("997");
  await widthInput.fill("");
  await expect(widthInput).toHaveValue("");
  await widthInput.pressSequentially("317");
  await expect(widthInput).toHaveValue("317");
  await expect(editor.getByLabel("Altura do card", { exact: false })).toHaveValue("997");
  await widthInput.press("Enter");
  await expect.poll(async () => (await goalCard.boundingBox()).height).toBe(997);
  await expect.poll(async () => (await goalCard.boundingBox()).width).toBe(317);
  await expect(page.getByText("Salvo automaticamente", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const { profiles } = await page.request
        .get(`${origin}/api/dashboard-profiles`)
        .then((response) => response.json());
      return profiles.some((profile) =>
        profile.cards.some(
          (card) =>
            card.id === "appointments-goal" &&
            card.layout.height === 997 &&
            card.layout.width === 317,
        ),
      );
    })
    .toBe(true);
  await page.setViewportSize({ width: 320, height: 900 });
  await goalCard
    .getByRole("button", { name: "Redimensionar Meta do mês", exact: true })
    .press("ArrowDown");
  await expect
    .poll(async () => {
      const { profiles } = await page.request
        .get(`${origin}/api/dashboard-profiles`)
        .then((response) => response.json());
      return profiles.some((profile) =>
        profile.cards.some(
          (card) =>
            card.id === "appointments-goal" &&
            card.layout.height === 998 &&
            card.layout.width === 317,
        ),
      );
    })
    .toBe(true);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await goalCard
    .getByRole("button", { name: "Redimensionar Meta do mês", exact: true })
    .press("ArrowRight");
  await expect.poll(async () => (await goalCard.boundingBox()).width).toBe(318);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await goalCard.hover();
  await goalCard.getByRole("button", { name: "Editar Meta do mês", exact: true }).click();
  await editor.getByLabel("Altura do card", { exact: false }).fill("137");
  await editor.getByLabel("Largura do card", { exact: false }).fill("157");
  await editor.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect.poll(async () => (await goalCard.boundingBox()).height).toBe(137);
  await expect.poll(async () => (await goalCard.boundingBox()).width).toBe(157);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  evidence.canvas.interactions.push(
    "compact-hover-pointer-both-axes-pixel-dimensions-below-legacy-minima-and-save",
  );
  await goalCard.getByRole("button", { name: "Mover Meta do mês", exact: true }).press("ArrowDown");
  await expect.poll(readOrder).not.toEqual(initialOrder);
  const keyboardOrder = await readOrder();
  check(keyboardOrder[1] === "appointments-goal", "Keyboard reorders a card");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect.poll(readOrder).toEqual(initialOrder);
  evidence.canvas.interactions.push({ keyboardOrder, undoOrder: await readOrder() });

  const initialHeight = await goalCard.evaluate((node) => node.getBoundingClientRect().height);
  await goalCard
    .getByRole("button", { name: "Redimensionar Meta do mês", exact: true })
    .press("ArrowDown");
  const resizedHeight = await goalCard.evaluate((node) => node.getBoundingClientRect().height);
  check(resizedHeight > initialHeight, "Keyboard resize increases card height");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();

  for (const id of ["appointments-goal", "team-productive"]) {
    await page.locator(`[data-dashboard-card-id="${id}"]`).hover();
    await page.locator(`[data-dashboard-card-id="${id}"] input[type="checkbox"]`).check();
  }
  await expect(page.getByLabel("Mover cards selecionados")).toBeVisible();
  await page.getByRole("button", { name: "Mover grupo para depois", exact: true }).click();
  await expect.poll(readOrder).not.toEqual(initialOrder);
  const groupOrder = await readOrder();
  check(
    groupOrder.indexOf("team-productive") === groupOrder.indexOf("appointments-goal") + 1,
    "Group move keeps selected cards together",
  );
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  evidence.canvas.interactions.push({ groupOrder });

  await page.locator('[data-dashboard-card-id="appointments-monthly"]').hover();
  await page.getByRole("button", { name: "Expandir Agendamentos por mês", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Agendamentos por mês", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Agendamentos por mês", exact: true })).toHaveCount(
    0,
  );
  evidence.canvas.interactions.push("expand-and-escape");

  await page.getByRole("button", { name: "Adicionar card", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Adicionar card", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  evidence.canvas.interactions.push("card-editor");

  await expect(page.getByRole("button", { name: "Perfis", exact: true })).toHaveCount(0);
  evidence.canvas.interactions.push("automatic-profile-without-profile-toolbar");

  await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Baixar dashboard em PDF", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  evidence.canvas.interactions.push("selective-pdf-dialog");

  const touchContext = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  try {
    await touchContext.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    const touchPage = await touchContext.newPage();
    await touchPage.goto(`${origin}?editable`);
    const touchCard = touchPage.locator('[data-dashboard-card-id="appointments-goal"]');
    const move = touchCard.getByRole("button", { name: "Mover Meta do mês", exact: true });
    check(
      (await move.evaluate((node) => getComputedStyle(node.parentElement).opacity)) === "1",
      "Touch keeps move control available without hover",
    );
    const touchResize = touchCard.getByRole("button", {
      name: "Redimensionar Meta do mês",
      exact: true,
    });
    await expect(touchResize).toBeHidden();
    check((await move.boundingBox()).width >= 44, "Touch retains accessible target size");
    const actions = touchCard.getByRole("button", { name: "Ações de Meta do mês", exact: true });
    await actions.click();
    const actionsDialog = touchPage.getByRole("dialog", { name: "Ações do card", exact: true });
    await expect(actionsDialog).toBeVisible();
    await actionsDialog
      .getByRole("button", { name: "Editar e redimensionar", exact: true })
      .click();
    const touchEditor = touchPage.getByRole("dialog", { name: "Editar card", exact: true });
    await touchEditor.getByLabel("Largura do card", { exact: false }).fill("128");
    await touchEditor.getByLabel("Altura do card", { exact: false }).fill("72");
    await touchEditor.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect.poll(async () => (await touchCard.boundingBox()).width).toBe(128);
    await expect.poll(async () => (await touchCard.boundingBox()).height).toBe(72);
    check((await actions.boundingBox()).width >= 44, "Small card keeps touch actions target");
    await actions.click();
    for (const name of ["Selecionar card", "Editar e redimensionar", "Expandir", "Excluir"])
      await expect(actionsDialog.getByRole("button", { name, exact: true })).toBeVisible();
    await touchPage.keyboard.press("Escape");
    await expect(actions).toBeFocused();
    await actions.click();
    await actionsDialog.getByRole("button", { name: "Expandir", exact: true }).click();
    await expect(touchPage.getByRole("dialog", { name: "Meta do mês", exact: true })).toBeVisible();
    await touchPage.keyboard.press("Escape");
    await touchPage.goto(origin);
    await expect(
      touchPage.getByRole("button", { name: "Ações de Meta do mês", exact: true }),
    ).toHaveCount(0);
    await expect(
      touchPage.getByRole("button", { name: "Redimensionar Meta do mês", exact: true }),
    ).toBeHidden();
    evidence.canvas.interactions.push(
      "touch-128x72-menu-editor-44px-targets-escape-focus-and-readonly",
    );
  } finally {
    await touchContext.close();
  }
}

export async function runAppointmentsPreview() {
  await mkdir(outputRoot, { recursive: true });
  const evidence = {
    environment:
      "Windows local loopback; real component and aggregate logic; synthetic fixture only; all external requests blocked; no authentication, database or Salesforce writes",
    node: process.version,
    passed: false,
    screens: [],
    browserErrors: [],
    externalRequests: [],
    failures: [],
  };
  evidence.sources = await Promise.all(
    [
      `${componentDirectory}/AppointmentsDashboard.tsx`,
      `${componentDirectory}/AppointmentsDashboard.module.css`,
      `${componentDirectory}/ChartBoard.tsx`,
      `${componentDirectory}/ChartBoard.module.css`,
      "lib/crm/stages/appointments.ts",
      "lib/crm/stages/data.ts",
      "supabase/migrations/20261024223147_appointments_conversion_goals_read.sql",
    ].map(async (file) => ({
      file,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex"),
    })),
  );
  const entry = path.join(root, "scripts/qa/appointments-memory.tsx").replaceAll("\\", "/");
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
    resolve: { alias: { "@": root } },
    oxc: { jsx: { runtime: "automatic" } },
    css: {
      modules: {
        generateScopedName: (name, filename) =>
          `${path.basename(filename, ".css").replaceAll(".", "_")}_${name}_qa`,
      },
    },
    plugins: [
      {
        name: "appointments-synthetic-preview",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith("appointments-memory.tsx")) return entry;
        },
        load(id) {
          if (id === entry)
            return `import {createRoot} from 'react-dom/client';import {AppointmentsDashboard} from '@/app/(protected)/app/etapas/_components/AppointmentsDashboard';import '@/app/globals.css';const fixture=${JSON.stringify(fixture)};const brokerRoster=${JSON.stringify(brokerRoster)};const conversionGoals={dv:{opportunityAppointment:9,appointmentVisit:2,appointmentFolder:3,appointmentApprovedFolder:12,appointmentSale:24,monthlyFunnel:{opportunities:143,appointments:24,visits:12,folders:8,approvedFolders:2,sales:1}},partnerships:{opportunityAppointment:null,appointmentVisit:null,appointmentFolder:null,appointmentApprovedFolder:null,appointmentSale:null,monthlyFunnel:{opportunities:0,appointments:0,visits:4,folders:2,approvedFolders:1,sales:1}}};const query=new URLSearchParams(location.search);if(query.has('large'))fixture.facts.forEach(f=>{if(f[0]===1&&f[1].startsWith('2026-03'))f[7]=1000000;});if(query.has('legacy')){fixture.version=1;delete fixture.brokerCount;delete fixture.brokerManagerCount;delete fixture.appointments;delete fixture.dimensions.stores;fixture.facts=fixture.facts.filter(f=>f[0]===1).map(f=>f.slice(0,10));}createRoot(document.getElementById('root')).render(<main style={{padding:'16px',maxWidth:'1600px',margin:'auto'}}><AppointmentsDashboard analysis={query.has('empty')?null:fixture} brokerRoster={brokerRoster} individualGoal={24} goalsByMonth={{"2026-03":24,"2026-01":20,"2025-10":18,"2025-12":22}} conversionGoals={conversionGoals} canEditDashboard={query.has('editable')} canViewDevelopmentRankings={!query.has('restricted')} generatedAt="2026-03-31T15:00:00Z"/></main>);`;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "AppointmentsQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const cssNames = [...files.keys()].filter((name) => name.endsWith(".css"));
  if (process.argv.includes("--production-css")) {
    const converted = await productionCss(
      cssNames.map((name) => String(files.get(name))).join("\n"),
    );
    for (const name of cssNames) files.delete(name);
    files.set("/appointments-production.css", converted.css);
    evidence.css = converted.evidence;
  } else evidence.css = { mode: "Vite development preview; does not validate production CSS" };
  const script = output.find((file) => file.type === "chunk" && file.isEntry).fileName;
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Agendamentos QA sintético</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${[
    ...files.keys(),
  ]
    .filter((name) => name.endsWith(".css"))
    .map((name) => `<link rel="stylesheet" href="${name}">`)
    .join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  const syntheticProfiles = [];
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const pathname = requestUrl.pathname;
    if (
      pathname.startsWith("/api/dashboard-profiles") &&
      ["POST", "PATCH"].includes(request.method)
    ) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const previous = syntheticProfiles.find((profile) => pathname.endsWith(`/${profile.id}`));
      const profile = {
        ...previous,
        ...payload,
        id: previous?.id ?? `synthetic-${syntheticProfiles.length + 1}`,
        userId: "synthetic-user",
        version: (previous?.version ?? 0) + 1,
        createdAt: previous?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (previous) syntheticProfiles.splice(syntheticProfiles.indexOf(previous), 1, profile);
      else syntheticProfiles.push(profile);
      return response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ profile }));
    }
    if (request.method !== "GET") return response.writeHead(405).end();
    if (pathname === "/favicon.ico") return response.writeHead(204).end();
    if (pathname === "/api/dashboard-profiles")
      return response.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          profiles: syntheticProfiles.filter(
            (profile) =>
              (!requestUrl.searchParams.has("pageKey") ||
                profile.pageKey === requestUrl.searchParams.get("pageKey")) &&
              (!requestUrl.searchParams.has("scopeKey") ||
                profile.scopeKey === requestUrl.searchParams.get("scopeKey")),
          ),
        }),
      );
    if (pathname === "/")
      return response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    if (files.has(pathname))
      return response
        .writeHead(200, {
          "content-type": pathname.endsWith(".css") ? "text/css" : "text/javascript",
        })
        .end(files.get(pathname));
    response.writeHead(404).end();
  });
  let browser;
  const check = (condition, message) => {
    if (!condition) evidence.failures.push(message);
  };
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    evidence.browser = browser.version();
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.externalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => evidence.browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") evidence.browserErrors.push(message.text());
    });
    if (process.argv.includes("--canvas-only")) {
      await runCanvasPreview({ page, origin, evidence, check });
      check(!evidence.browserErrors.length, "Browser JavaScript errors");
      check(!evidence.externalRequests.length, "External requests attempted");
      evidence.passed = !evidence.failures.length;
      return;
    }
    const region = (name) => page.getByRole("region", { name, exact: true });
    evidence.chartBoard = [];
    for (const { width, height } of process.argv.includes("--interactions-only")
      ? []
      : [
          { width: 1920, height: 1080 },
          { width: 1440, height: 900 },
          { width: 1440, height: 720 },
          { width: 1024, height: 900 },
          { width: 1024, height: 720 },
          { width: 390, height: 900 },
          { width: 320, height: 900 },
        ]) {
      await page.setViewportSize({ width, height });
      await page.goto(origin);
      await expect(page.getByRole("heading", { name: "Ranking por responsável" })).toBeVisible();
      // The fixture is mixed; configured monthly targets require explicit House.
      await page.getByRole("button", { name: "House", exact: true }).click();
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate(
          (value) => document.documentElement.setAttribute("data-theme", value),
          theme,
        );
        await page.waitForTimeout(200);
        const recencyFrames = await page
          .locator('[data-appointments-chart^="Último agendamento"] > dialog')
          .evaluateAll((elements) =>
            elements.map((element) => ({
              border: getComputedStyle(element).borderTopColor,
              animation: getComputedStyle(element).animationName,
            })),
          );
        check(
          new Set(recencyFrames.map((frame) => frame.border)).size === 3,
          `Permanent blue/yellow/red frames ${theme}/${width}`,
        );
        check(
          recencyFrames.every((frame) => frame.animation === "none"),
          `Reduced-motion keeps static frames ${theme}/${width}`,
        );
        const monthlyTile = page.locator('[data-appointments-chart="Agendamentos por mês"]');
        const yearControl = monthlyTile.getByLabel("Ano", { exact: true });
        await yearControl.evaluate((element) => {
          window.__qaYearControl = element;
        });
        const yearBefore = await yearControl.inputValue();
        await monthlyTile
          .getByRole("button", { name: "Expandir Agendamentos por mês", exact: true })
          .click();
        const popup = page.getByRole("dialog", { name: "Agendamentos por mês", exact: true });
        await expect(popup).toBeVisible();
        const expandedChild = popup.locator('[class*="content"] > *').first();
        await expect(expandedChild).toHaveCSS("max-height", "none");
        await expect(expandedChild).toHaveCSS("overflow-y", "visible");
        await expect(
          popup.getByRole("button", { name: "Fechar Agendamentos por mês", exact: true }),
        ).toBeFocused();
        assert.equal(
          await yearControl.evaluate((element) => element === window.__qaYearControl),
          true,
          "Expansion preserves the exact control node",
        );
        assert.equal(
          await yearControl.inputValue(),
          yearBefore,
          "Expansion preserves selected year",
        );
        await expect(page.getByLabel("Ano", { exact: true })).toHaveCount(1);
        assert.deepEqual(
          await page.locator("[id]").evaluateAll((elements) => {
            const ids = elements.map((element) => element.id);
            return ids.filter((id, index) => ids.indexOf(id) !== index);
          }),
          [],
          "Expansion never duplicates IDs",
        );
        const modalBounds = await popup.boundingBox();
        check(
          modalBounds && modalBounds.width <= width && modalBounds.height <= height,
          `Popup fits viewport ${theme}/${width}x${height}`,
        );
        const modalAxe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        check(
          !modalAxe.violations.length,
          `Popup axe ${theme}/${width}: ${modalAxe.violations.map(({ id }) => id).join(",")}`,
        );
        await page.keyboard.press("Escape");
        await expect(page.locator("dialog:modal")).toHaveCount(0);
        await expect(
          monthlyTile.getByRole("button", { name: "Expandir Agendamentos por mês", exact: true }),
        ).toBeFocused();
        assert.equal(
          await yearControl.evaluate((element) => element === window.__qaYearControl),
          true,
          "Closing preserves the exact control node",
        );
        evidence.chartBoard.push({
          width,
          height,
          theme,
          expansion: true,
          uniqueControl: true,
          focusRestored: true,
          modalBounds,
        });
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          axisValueCollisions: [...document.querySelectorAll('ol[class*="columns"]')].flatMap(
            (list) => {
              const axis = list.previousElementSibling;
              if (axis?.textContent !== "Quantidade de agendamentos") return [];
              const axisRect = axis.getBoundingClientRect();
              return [...list.querySelectorAll('[class*="columnValue"]')].flatMap((value) => {
                const rect = value.getBoundingClientRect();
                return rect.width > 0 && rect.top < axisRect.bottom + 1
                  ? [
                      {
                        chart: list.getAttribute("aria-label"),
                        value: value.textContent,
                        axisBottom: axisRect.bottom,
                        valueTop: rect.top,
                      },
                    ]
                  : [];
              });
            },
          ),
          dailyLabelCollisions: (() => {
            const list = document.querySelector(
              'ol[aria-label="Agendamentos por dia do mês selecionado"]',
            );
            const rects = [...list.children].map((item) => {
              const range = document.createRange();
              range.selectNodeContents(item.querySelector('[class*="columnLabel"]'));
              return range.getBoundingClientRect();
            });
            return rects
              .slice(1)
              .flatMap((rect, index) =>
                rect.left < rects[index].right - 0.5 &&
                rect.top < rects[index].bottom &&
                rect.bottom > rects[index].top
                  ? [index + 1]
                  : [],
              );
          })(),
          horizontalScrollbars: [...document.querySelectorAll("main *")]
            .filter((element) => {
              const css = getComputedStyle(element);
              return (
                /auto|scroll/.test(css.overflowX) && element.scrollWidth > element.clientWidth + 1
              );
            })
            .map((element) => ({ tag: element.tagName, class: element.className })),
          sections: [
            ...document.querySelectorAll(
              '[data-appointments-chart]:not([data-appointments-chart^="Último agendamento"])',
            ),
          ].map((element) => ({
            heading: element.querySelector("h2, h3")?.textContent,
            x: element.getBoundingClientRect().x,
            y: element.getBoundingClientRect().y,
            bottom: element.getBoundingClientRect().bottom,
            height: element.getBoundingClientRect().height,
            hasVerticalScroll:
              element.querySelector('dialog > [class*="content"]')?.scrollHeight >
              element.querySelector('dialog > [class*="content"]')?.clientHeight + 1,
          })),
          scoreSingleRow: (() => {
            const section = [
              ...document.querySelectorAll(
                '[data-appointments-chart]:not([data-appointments-chart^="Último agendamento"])',
              ),
            ].find((element) => element.querySelector("h2, h3")?.textContent === "Ranking Score");
            const items = [...(section?.querySelectorAll("ol > li") ?? [])];
            const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
            return items.length > 0 && new Set(tops).size === 1;
          })(),
          scoreStyles: (() => {
            const tile = document.querySelector('[data-appointments-chart="Ranking Score"]');
            const content = tile?.querySelector('dialog > [class*="content"]');
            const track = tile?.querySelector('[class*="columnTrack"]');
            const label = tile?.querySelector('[class*="columnLabel"]');
            return {
              rootFont: getComputedStyle(document.documentElement).fontSize,
              tileHeight: tile?.getBoundingClientRect().height,
              contentHeight: content?.clientHeight,
              contentScrollHeight: content?.scrollHeight,
              trackHeight: track ? getComputedStyle(track).height : null,
              labelHeight: label ? getComputedStyle(label).height : null,
            };
          })(),
          scoreLabelWritingModes: (() => {
            const section = [
              ...document.querySelectorAll(
                '[data-appointments-chart]:not([data-appointments-chart^="Último agendamento"])',
              ),
            ].find((element) => element.querySelector("h2, h3")?.textContent === "Ranking Score");
            return [...(section?.querySelectorAll('[class*="columnLabel"]') ?? [])].map(
              (element) => getComputedStyle(element).writingMode,
            );
          })(),
          kpiCards: [...document.querySelectorAll("[data-summary-card] > article")].map((card) => ({
            label: card.querySelector("h2")?.textContent,
            width: card.getBoundingClientRect().width,
            height: card.getBoundingClientRect().height,
          })),
          metricFontSizes: [
            ...document.querySelectorAll('[data-summary-card] > article [class*="metricValue"]'),
          ]
            .filter((element) => !element.closest("dialog"))
            .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
          cardTitleFontSizes: [
            ...document.querySelectorAll("[data-summary-card] > article > h2"),
          ].map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
          kpiCenters: [...document.querySelectorAll('article[class*="kpiCard"]')].map((card) => {
            const value = card.querySelector("strong");
            const cardRect = card.getBoundingClientRect();
            const valueRect = value?.getBoundingClientRect();
            return {
              label: card.querySelector("h2")?.textContent,
              delta: valueRect
                ? Math.abs(
                    valueRect.left + valueRect.width / 2 - (cardRect.left + cardRect.width / 2),
                  )
                : null,
            };
          }),
          conversionCenters: [
            ...document.querySelectorAll(
              '[data-summary-card] > article [class*="conversionPercent"]',
            ),
          ]
            .filter((value) => !value.closest("dialog"))
            .map((value) => {
              const card = value.closest("article");
              const cardRect = card.getBoundingClientRect();
              const valueRect = value.getBoundingClientRect();
              return {
                label: card.querySelector("h2")?.textContent,
                delta: Math.abs(
                  valueRect.left + valueRect.width / 2 - (cardRect.left + cardRect.width / 2),
                ),
              };
            }),
          recency: [
            ...document.querySelectorAll('[data-appointments-chart^="Último agendamento"]'),
          ].map((element) => ({
            heading: element.querySelector("h2, h3")?.textContent,
            x: Math.round(element.getBoundingClientRect().x),
            y: Math.round(element.getBoundingClientRect().y),
            bottom: Math.round(element.getBoundingClientRect().bottom),
          })),
          table: (() => {
            const viewport = document.querySelector('[class*="tableViewport"]');
            const card = viewport?.closest("section");
            return {
              cardHeight: card?.getBoundingClientRect().height ?? 0,
              viewportHeight: viewport?.getBoundingClientRect().height ?? 0,
              hasVerticalScroll: Boolean(
                viewport && viewport.scrollHeight > viewport.clientHeight + 1,
              ),
              overflowY: viewport ? getComputedStyle(viewport).overflowY : "",
            };
          })(),
          monthly: (() => {
            const section = [
              ...document.querySelectorAll(
                '[data-appointments-chart]:not([data-appointments-chart^="Último agendamento"])',
              ),
            ].find(
              (element) => element.querySelector("h2, h3")?.textContent === "Agendamentos por mês",
            );
            const labels = [...(section?.querySelectorAll('[class*="columnLabel"]') ?? [])];
            const viewport = section?.querySelector('dialog > [class*="content"]');
            return {
              y: Math.round(section?.getBoundingClientRect().y ?? 0),
              initiallyVisible: Boolean(
                viewport &&
                viewport.scrollHeight <= viewport.clientHeight + 1 &&
                [
                  ...viewport.querySelectorAll(
                    '[class*="columnLabel"], [class*="axis"], div[data-goal-status]',
                  ),
                ].every(
                  (element) =>
                    element.getBoundingClientRect().bottom <=
                    viewport.getBoundingClientRect().bottom + 1,
                ),
              ),
              labels: labels.map((label) => ({
                text: label.textContent,
                clientWidth: label.clientWidth,
                scrollWidth: label.scrollWidth,
                fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
                whiteSpace: getComputedStyle(label).whiteSpace,
              })),
            };
          })(),
        }));
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const screenshot = path.join(outputRoot, `${theme}-${width}x${height}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        const record = {
          width,
          theme,
          geometry,
          violations: axe.violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            targets: nodes.map((node) => node.target),
          })),
          screenshot,
        };
        evidence.screens.push(record);
        check(
          geometry.scrollWidth <= width + 1,
          `Horizontal overflow ${theme}/${width}: ${geometry.scrollWidth}`,
        );
        check(
          !geometry.axisValueCollisions.length,
          `Quantity axis/value collisions ${theme}/${width}: ${JSON.stringify(geometry.axisValueCollisions)}`,
        );
        check(
          !geometry.horizontalScrollbars.length,
          `Horizontal internal scrollbar ${theme}/${width}`,
        );
        check(
          geometry.sections.every(
            (section) => Math.abs(section.height - geometry.sections[0].height) < 1,
          ) &&
            geometry.recency.every(
              (section) => Math.abs(section.bottom - section.y - geometry.sections[0].height) < 1,
            ),
          `Every guided chart has the same height ${theme}/${width}`,
        );
        check(
          geometry.scoreLabelWritingModes.length > 0 &&
            geometry.scoreLabelWritingModes.every((mode) => mode === "vertical-rl"),
          `Ranking Score labels must run vertically bottom-to-top ${theme}/${width}`,
        );
        check(
          !geometry.dailyLabelCollisions.length,
          `Daily label collisions ${theme}/${width}: ${geometry.dailyLabelCollisions.join(",")}`,
        );
        check(
          !record.violations.length,
          `Axe violations ${theme}/${width}: ${record.violations.map((item) => item.id).join(",")}`,
        );
        check(
          geometry.kpiCenters.every((item) => item.delta !== null && item.delta <= 1),
          `KPI values not centered ${theme}/${width}: ${JSON.stringify(geometry.kpiCenters)}`,
        );
        check(
          geometry.conversionCenters.length === 3 &&
            geometry.conversionCenters.every((item) => item.delta <= 1),
          `Conversion percentages not centered ${theme}/${width}: ${JSON.stringify(geometry.conversionCenters)}`,
        );
        check(
          geometry.kpiCards.length === 12 &&
            geometry.kpiCards.every(
              (card) => Math.abs(card.height - geometry.kpiCards[0].height) < 1,
            ),
          `Twelve KPI cards must have equal heights ${theme}/${width}`,
        );
        check(
          geometry.metricFontSizes.length === 12 &&
            geometry.metricFontSizes.every(
              (size) => Math.abs(size - geometry.metricFontSizes[0]) < 0.1,
            ),
          `KPI numbers must share one font size ${theme}/${width}`,
        );
        check(
          geometry.cardTitleFontSizes.length === 12 &&
            geometry.cardTitleFontSizes.every(
              (size) => Math.abs(size - geometry.cardTitleFontSizes[0]) < 0.1,
            ),
          `KPI titles must share one font size ${theme}/${width}`,
        );
        check(geometry.recency.length === 3, `Three recency panels ${theme}/${width}`);
        check(
          geometry.monthly.initiallyVisible,
          `Monthly bars, labels and legend fit without scrolling ${theme}/${width}`,
        );
        check(
          geometry.monthly.labels.length > 0 &&
            geometry.monthly.labels.every(
              (label) =>
                label.scrollWidth <= label.clientWidth + 1 &&
                label.fontSize >= 12.48 &&
                label.whiteSpace === "nowrap",
            ),
          `Monthly labels clipped or too small ${theme}/${width}: ${JSON.stringify(geometry.monthly.labels)}`,
        );
        check(geometry.sections.length === 11, `Eleven charts ${theme}/${width}`);
        if (width >= 1024)
          check(
            geometry.table.viewportHeight > 0 && geometry.table.cardHeight >= 500,
            `Detail table must match the guided chart viewport ${theme}/${width}x${height}: ${JSON.stringify(geometry.table)}`,
          );
        const score = geometry.sections.find((section) => section.heading === "Ranking Score");
        check(score && !score.hasVerticalScroll, `Ranking Score vertical scroll ${theme}/${width}`);
        check(
          geometry.scoreSingleRow,
          `Ranking Score must keep every bar on one row ${theme}/${width}`,
        );
        if (width >= 1201)
          check(
            new Set(geometry.sections.slice(1, 4).map((section) => section.y)).size === 1 &&
              geometry.sections[0].y < geometry.sections[1].y,
            `Evolution is isolated above the three overview charts at ${width}`,
          );
        if (width >= 1024)
          check(
            new Set(geometry.sections.slice(4, 7).map((item) => item.y)).size === 1 &&
              new Set(geometry.recency.map((item) => item.y)).size === 1 &&
              geometry.recency[0].y > geometry.sections[4].y &&
              geometry.monthly.y > geometry.recency[0].y,
            `Rankings, recency and monthly chart follow the requested rows at ${width}`,
          );
        if (width <= 390)
          check(
            geometry.recency.every(
              (item, index, items) => index === 0 || item.y > items[index - 1].y,
            ),
            `Recency panels must stack at ${width}`,
          );
        if (width === 1440)
          check(
            !geometry.sections[4].hasVerticalScroll,
            "Expanded ranking height avoids unnecessary vertical overflow",
          );
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    const firstTile = page.locator('[data-appointments-chart="Previstos e realizados hoje"]');
    const secondTile = page.locator('[data-appointments-chart="Agendamentos por semana"]');
    await expect(page.locator("section[data-appointments-chart]")).toHaveCount(14);
    const readDomOrder = () =>
      page
        .locator("section[data-appointments-chart]")
        .evaluateAll((elements) => elements.map((element) => element.dataset.appointmentsChart));
    const initialDomOrder = await readDomOrder();
    const movedDomOrder = [
      initialDomOrder[0],
      initialDomOrder[2],
      initialDomOrder[1],
      ...initialDomOrder.slice(3),
    ];
    const firstHandle = firstTile.getByRole("button", {
      name: "Reordenar Previstos e realizados hoje",
      exact: true,
    });
    await page.evaluate(() => {
      window.__qaBoardNodes = [
        ...document.querySelectorAll("section[data-appointments-chart]"),
      ].map((tile) => ({
        tile,
        dialog: tile.querySelector("dialog"),
        controls: [...tile.querySelectorAll("button, select, input")],
      }));
    });
    const assertBoardIdentity = async () => {
      assert.equal(
        await page.evaluate(() =>
          window.__qaBoardNodes.every(
            ({ tile, dialog, controls }) =>
              document
                .querySelectorAll("section[data-appointments-chart]")
                .values()
                .some((node) => node === tile) &&
              tile.querySelector("dialog") === dialog &&
              controls.every((control) => tile.contains(control)),
          ),
        ),
        true,
        "Reordering preserves tile, native dialog and control nodes",
      );
      assert.equal(
        await page.locator("section[data-appointments-chart]").evaluateAll((tiles) =>
          tiles.every((tile) => {
            let wrapper = tile.parentElement;
            while (wrapper && !wrapper.hasAttribute("data-chart-board")) {
              if (getComputedStyle(wrapper).display !== "contents") return false;
              wrapper = wrapper.parentElement;
            }
            return Boolean(wrapper);
          }),
        ),
        true,
        "Cloned presentation wrappers retain display: contents with production CSS",
      );
    };
    const readOrder = (tile) => tile.evaluate((element) => Number(getComputedStyle(element).order));
    await page.evaluate(() => {
      window.__qaDragEvents = [];
      for (const type of [
        "mousedown",
        "mouseup",
        "dragstart",
        "dragenter",
        "dragover",
        "drop",
        "dragend",
      ])
        document.addEventListener(type, (event) => {
          if (window.__qaDragEvents.length < 50)
            window.__qaDragEvents.push({
              type,
              tile: event.target
                .closest("[data-appointments-chart]")
                ?.getAttribute("data-appointments-chart"),
            });
        });
    });
    await firstTile
      .getByRole("button", {
        name: "Mover Previstos e realizados hoje para depois",
        exact: true,
      })
      .click();
    assert.equal(await readOrder(firstTile), 1, "Move button changes visual order");
    assert.deepEqual(await readDomOrder(), movedDomOrder, "Move button changes real DOM order");
    await expect(
      firstTile.getByRole("button", {
        name: "Mover Previstos e realizados hoje para depois",
        exact: true,
      }),
    ).toBeFocused();
    await assertBoardIdentity();
    await firstTile
      .getByRole("button", { name: "Reordenar Previstos e realizados hoje", exact: true })
      .press("ArrowUp");
    assert.equal(await readOrder(firstTile), 0, "Arrow key restores visual order");
    assert.deepEqual(await readDomOrder(), initialDomOrder, "Arrow key restores DOM order");
    await expect(firstHandle).toBeFocused();
    await firstTile
      .getByRole("button", { name: "Reordenar Previstos e realizados hoje", exact: true })
      .dragTo(secondTile);
    evidence.dragEvents = await page.evaluate(() => window.__qaDragEvents);
    await expect(
      firstTile,
      `Handle drag changes visual order: ${JSON.stringify(evidence.dragEvents)}`,
    ).toHaveCSS("order", "1");
    assert.deepEqual(await readDomOrder(), movedDomOrder, "Handle drag changes real DOM order");
    await expect(firstHandle).toBeFocused();
    await assertBoardIdentity();
    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("crm:chart-board:v1:appointments-period-v2")),
    );
    assert.equal(
      persisted[1],
      "Previstos e realizados hoje",
      "Versioned preference contains only tile IDs",
    );
    assert.ok(persisted.every((id) => typeof id === "string"));
    await page.reload();
    await expect(firstTile).toHaveCSS("order", "1");
    assert.deepEqual(await readDomOrder(), movedDomOrder, "Reload restores real DOM order");
    assert.ok(
      (await secondTile.boundingBox()).y <= (await firstTile.boundingBox()).y,
      "DOM wrappers do not prevent visual reordering",
    );
    await page.evaluate(() => localStorage.removeItem("crm:chart-board:v1:appointments-period-v2"));
    await page.reload();
    await expect(firstTile).toHaveCSS("order", "0");
    assert.deepEqual(await readDomOrder(), initialDomOrder, "Cleared storage restores DOM order");
    evidence.reordering =
      "Buttons, arrow keys, handle drag and reload persistence passed; initial order restored for functional assertions";
    const summaryCards = page.locator("[data-summary-card]");
    const readSummaryOrder = () =>
      summaryCards.evaluateAll((elements) =>
        elements.map((element) => element.dataset.summaryCard),
      );
    const initialSummaryOrder = await readSummaryOrder();
    await page
      .getByRole("button", { name: "Mover Meta do mês para a próxima posição", exact: true })
      .click();
    const movedSummaryOrder = await readSummaryOrder();
    assert.equal(movedSummaryOrder[1], "Meta do mês", "Summary card move button changes DOM order");
    assert.equal(
      (
        await page.evaluate(() => JSON.parse(localStorage.getItem("crm:appointments-summary:v1")))
      )[1],
      "Meta do mês",
      "Summary card order persists as IDs only",
    );
    await page.reload();
    assert.equal(
      (await readSummaryOrder())[1],
      "Meta do mês",
      "Summary card order survives reload",
    );
    await page.evaluate(() => localStorage.removeItem("crm:appointments-summary:v1"));
    await page.reload();
    assert.deepEqual(
      await readSummaryOrder(),
      initialSummaryOrder,
      "Summary card order resets cleanly",
    );
    evidence.summaryReordering =
      "The twelve KPI cards reorder and persist locally without remounting data";
    const daily = region("Evolução de agendamentos por dia");
    await expect(
      page.getByRole("region", { name: "Filtros do painel de agendamentos" }),
    ).toBeVisible();
    await expect(page.locator('[class*="kpiGrid"] [data-summary-card] > article > h2')).toHaveCount(
      12,
    );
    await expect(page.getByText("Cobertura da fonte:")).toHaveCount(0);
    await expect(page.getByText(/agendamentos no período$/)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Último agendamento: até 7 dias" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Último agendamento: de 8 a 14 dias" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Último agendamento: 15 dias ou mais" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /24 de 120 corretores/ })).toBeVisible();
    await expect(daily.getByRole("listitem")).toHaveCount(31);
    const barGeometry = await daily.getByRole("listitem").evaluateAll((items) =>
      items.map((item) => {
        const label = item.firstElementChild.getAttribute("aria-label") ?? "";
        const total = Number(label.match(/: ([\d.]+) agendamentos/)?.[1]?.replaceAll(".", "") ?? 0);
        const goal = Number(label.match(/; meta ([\d.]+)/)?.[1]?.replaceAll(".", "") ?? 0);
        return {
          total,
          goal,
          trackHeight: item.firstElementChild.firstElementChild.getBoundingClientRect().height,
          barHeight: item.querySelector("div[data-goal-status]").getBoundingClientRect().height,
          barWidth: item.querySelector("div[data-goal-status]").getBoundingClientRect().width,
        };
      }),
    );
    const dailyScaleMax = Math.max(1, ...barGeometry.flatMap((bar) => [bar.total, bar.goal]));
    barGeometry.forEach((bar, index) => {
      check(bar.barWidth > 0, `Daily bar ${index + 1} must be visible`);
      const expectedRatio = bar.total / dailyScaleMax;
      const actualRatio = bar.barHeight / bar.trackHeight;
      check(
        bar.total === 0 ? bar.barHeight <= 3 : Math.abs(actualRatio - expectedRatio) < 0.02,
        `Daily bar ${index + 1} height must match its exact count and goal scale`,
      );
    });
    const rankingBars = await region("Ranking por responsável")
      .getByRole("listitem")
      .evaluateAll((items) =>
        items.map(
          (item) =>
            item.firstElementChild.lastElementChild.firstElementChild.getBoundingClientRect()
              .height,
        ),
      );
    check(
      rankingBars.every((height) => height > 0),
      "All horizontal ranking bars must have visible height",
    );
    evidence.barGeometry = { daily: barGeometry, ownerBarHeights: rankingBars };
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(6);
    assert.deepEqual(
      await daily
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => item.firstElementChild.getAttribute("aria-label").split("; meta")[0]),
        ),
      Array.from(
        { length: 31 },
        (_, index) =>
          `${String(index + 1).padStart(2, "0")}/03/2026: ${(index % 4) + 1} agendamentos`,
      ),
      "All dates and daily totals must be accessible and chronological",
    );
    assert.deepEqual(
      await region("Agendamentos por semana")
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => item.firstElementChild.getAttribute("aria-label").split("; meta")[0]),
        ),
      [1, 19, 16, 17, 18, 5].map((count, index) => `${index + 1}ª semana: ${count} agendamentos`),
      "Monday-to-Sunday weeks 1 through 6 and exact totals",
    );
    await expect(region("Ranking por responsável").getByRole("listitem")).toHaveCount(24);
    for (const [title, field] of [
      ["Ranking por gerente", 2],
      ["Ranking por responsável", 3],
    ]) {
      const dimension = { 2: "managers", 3: "owners" }[field];
      const totals = new Map();
      for (const fact of fixture.facts.filter(
        (fact) => fact[0] === 1 && fact[1].startsWith("2026-03"),
      )) {
        const label = fixture.dimensions[dimension][fact[field]];
        totals.set(label, (totals.get(label) || 0) + fact[7]);
      }
      const expected = [...totals].sort(
        ([a, ac], [b, bc]) => bc - ac || a.localeCompare(b, "pt-BR"),
      );
      const actual = await region(title)
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => ({
            label: item.querySelector("span[title]")?.getAttribute("title"),
            total: item.querySelector("strong")?.textContent,
          })),
        );
      expected.forEach(([label, total], index) => {
        check(
          actual[index]?.label === label,
          `${title}: full label and descending order row ${index + 1}`,
        );
        check(actual[index]?.total === String(total), `${title}: total row ${index + 1}`);
      });
    }
    const dailyBefore = await daily.innerText();
    await page.getByLabel("Ano", { exact: true }).selectOption("2025");
    await expect(region("Agendamentos por mês").getByRole("listitem")).toHaveCount(2);
    await expect(region("Agendamentos por mês")).toContainText("Outubro");
    await expect(region("Agendamentos por mês")).toContainText("Dezembro");
    assert.equal(await daily.innerText(), dailyBefore, "Exclusive year must preserve daily chart");
    const annualBefore = await region("Agendamentos por mês").innerText();
    const filtersRegion = page.getByRole("region", {
      name: "Filtros do painel de agendamentos",
      exact: true,
    });
    const calendarTrigger = filtersRegion.getByRole("button", { name: "Março de 2026" });
    await expect(page.getByRole("button", { name: "House", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const filterOrder = await filtersRegion.evaluate((element) => {
      const company = element.querySelector('select[aria-label="Empresa"], select[id$="company"]');
      const calendar = [...element.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Março de 2026"),
      );
      return {
        companyRight: company?.getBoundingClientRect().right ?? 0,
        calendarLeft: calendar?.getBoundingClientRect().left ?? 0,
      };
    });
    check(
      filterOrder.companyRight <= filterOrder.calendarLeft + 1,
      `Calendar must follow Empresa: ${JSON.stringify(filterOrder)}`,
    );
    await calendarTrigger.click();
    const calendar = page.getByRole("dialog", { name: "Selecione o período" });
    await expect(calendar).toBeVisible();
    await expect(calendar.getByLabel("Mês do calendário")).toHaveValue("3");
    await expect(calendar.getByLabel("Ano do calendário")).toHaveValue("2026");
    await expect(calendar.getByRole("button", { name: "Hoje", exact: true })).toBeVisible();
    await expect(
      calendar.getByRole("button", { name: "Semana passada", exact: true }),
    ).toBeVisible();
    await expect(calendar.getByRole("button", { name: "4º Trimestre", exact: true })).toBeVisible();
    await calendar.getByRole("gridcell", { name: "1 de março de 2026", exact: true }).click();
    await calendar.getByRole("gridcell", { name: "2 de março de 2026", exact: true }).click();
    await expect(calendar.getByText("2 dias selecionados", { exact: true })).toBeVisible();
    await expect(
      page.locator('p[aria-live="polite"]').filter({ hasText: "registros encontrados" }),
    ).toContainText("3 registros encontrados");
    await expect(daily.getByRole("listitem")).toHaveCount(2);
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(2);
    await calendar.getByRole("button", { name: "Fechar calendário" }).click();
    await expect(calendar).toBeHidden();
    await expect(filtersRegion.getByRole("button", { name: "2 dias selecionados" })).toBeFocused();
    await filtersRegion.getByRole("button", { name: "2 dias selecionados" }).click();
    await expect(calendar).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(calendar).toBeHidden();
    await filtersRegion.getByRole("button", { name: "2 dias selecionados" }).click();
    await expect(calendar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
    await expect(filtersRegion.getByRole("button", { name: "2 dias selecionados" })).toBeFocused();
    await filtersRegion.getByRole("button", { name: "2 dias selecionados" }).click();
    await calendar.getByLabel("Ano do calendário").selectOption("2025");
    await expect(calendar.getByLabel("Mês do calendário")).toHaveValue("10");
    await calendar.getByLabel("Mês do calendário").selectOption("12");
    await expect(
      calendar.getByRole("gridcell", { name: "22 de dezembro de 2025", exact: true }),
    ).toBeEnabled();
    await calendar.getByRole("button", { name: "Selecionar mês inteiro" }).click();
    await expect(calendar).toBeHidden();
    await expect(filtersRegion.getByRole("button", { name: "Dezembro de 2025" })).toBeVisible();
    assert.equal(
      await region("Agendamentos por mês").innerText(),
      annualBefore,
      "Global calendar month must preserve exclusive annual chart",
    );
    await expect(daily.getByRole("listitem")).toHaveCount(31);
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(5);
    evidence.filters =
      "Calendar defaults to the current source month; supports presets, multiple days, backdrop/close/Escape dismissal, year/month changes and whole-month selection; exclusive annual chart remains independent";
    await page.getByRole("button", { name: "Limpar 2 filtros" }).click();
    await expect(filtersRegion.getByRole("button", { name: "Março de 2026" })).toBeVisible();
    await page.goto(origin);
    await page.getByRole("button", { name: "House", exact: true }).click();
    await page
      .getByLabel("Gerente de Vendas")
      .selectOption("Ana Gerente sintética com sobrenome extenso");
    const managerKpi = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Gerentes cadastrados", exact: true }) });
    await expect(managerKpi.locator(":scope > strong")).toHaveText("1");
    const brokerKpi = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Corretores cadastrados", exact: true }) });
    await expect(brokerKpi.locator(":scope > strong")).toHaveText("24");
    await page.getByLabel("Responsável da conta").selectOption(owners[0]);
    await page.getByLabel("Empresa").selectOption("Empresa sintética");
    await expect(page.getByRole("button", { name: "Limpar 4 filtros" })).toBeVisible();
    const composedRow = page.locator("tbody tr").first();
    await composedRow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /Limpar 7 filtros/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Limpar 4 filtros" })).toBeVisible();
    await expect(page.getByLabel("Gerente de Vendas")).toHaveValue(
      "Ana Gerente sintética com sobrenome extenso",
    );
    await expect(page.getByRole("button", { name: "House", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    evidence.dimensionFilters =
      "House, manager, responsible and company compose; selecting one manager scopes the manager KPI to 1 and the official roster to 24 including inactive brokers; selecting and toggling a full row preserves the four global filters";
    await page.getByRole("button", { name: "Limpar 4 filtros" }).click();
    const firstDay = region("Evolução de agendamentos por dia")
      .getByRole("listitem")
      .getByRole("button")
      .first();
    await firstDay.click();
    await expect(firstDay).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Limpar 2 filtros" })).toBeVisible();
    await expect(page.getByText("1 registros no período")).toBeVisible();
    await page.getByRole("button", { name: "Limpar 2 filtros" }).click();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.focus();
    await page.keyboard.press("Enter");
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: /Limpar \d+ filtros/ })).toBeVisible();
    evidence.crossFilters =
      "Daily column click filters every result; clear restores the page; Enter on a full table row applies its dimensions";
    await page.getByRole("button", { name: /Limpar \d+ filtros/ }).click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const firstChartButton = daily.getByRole("listitem").getByRole("button").first();
    const firstChartBar = firstChartButton.locator('div[class*="column"]').last();
    const chartColorBefore = await firstChartBar.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await firstChartButton.hover();
    await page.waitForTimeout(220);
    const chartColorAfter = await firstChartBar.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    check(chartColorBefore !== chartColorAfter, "Chart bar hover must change color");
    const hoverRow = page.locator("tbody tr").first();
    const rowColorBefore = await hoverRow.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await hoverRow.hover();
    const rowColorAfter = await hoverRow.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    check(rowColorBefore !== rowColorAfter, "Table row hover must change color");
    const firstCard = page.locator("article").first();
    const firstCardBox = await firstCard.boundingBox();
    await page.mouse.move(firstCardBox.x + 8, firstCardBox.y + 8);
    await page.waitForTimeout(140);
    check(
      (await firstCard.evaluate((element) => getComputedStyle(element).transform)) !== "none",
      "KPI cards must follow the pointer with the 45 degree tilt effect",
    );
    await firstCard.getByRole("button", { name: "Abrir detalhes deste indicador" }).click();
    const cardPopup = page.getByRole("dialog", { name: "Detalhes do indicador" });
    await expect(cardPopup).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(cardPopup).toBeHidden();
    const funnelStage = page.locator('ol[aria-label^="Funil realizado"] > li').first();
    const funnelTransformBefore = await funnelStage.evaluate(
      (element) => getComputedStyle(element).transform,
    );
    await funnelStage.hover();
    await page.waitForTimeout(180);
    const funnelTransformAfter = await funnelStage.evaluate(
      (element) => getComputedStyle(element).transform,
    );
    check(
      funnelTransformBefore !== funnelTransformAfter,
      "Funnel stage must grow on pointer hover",
    );
    evidence.hoverAndMotion =
      "Chart bars and table rows change color on hover; KPI cards follow the pointer, open dismissible dialogs, and funnel stages grow on hover";
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(origin);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Limpar 1 filtro" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "House", exact: true })).toBeFocused();
    evidence.keyboard =
      "Tab follows the visual order from clear control to the first global filter; calendar dialog restores focus after close/Escape; chart buttons and rows use native keyboard controls";
    await page.goto(`${origin}/?empty=1`);
    await expect(
      page.getByText(
        "Dados analíticos indisponíveis. Aguardando uma atualização validada da fonte.",
      ),
    ).toBeVisible();
    await page.goto(`${origin}/?legacy=1`);
    await expect(region("Ranking por gerente regional")).toContainText(
      "Dados indisponíveis nesta atualização",
    );
    evidence.states =
      "Null slice shows unavailable state; v1 slice refuses fabricated operational rankings";
    await page.goto(`${origin}/?restricted=1`);
    check(
      (await region("Ranking Score").innerText()).includes(
        "Ranking Score indisponível para seu perfil de acesso",
      ),
      "Restricted account ranking must stay unavailable",
    );
    evidence.largeValues = [];
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/?large=1&legacy=1`);
      await expect(daily.getByRole("listitem")).toHaveCount(31);
      const collisions = await daily.evaluate((element) => {
        const list = element.querySelector("ol");
        const rects = [...list.children].map((item) => {
          const range = document.createRange();
          range.selectNodeContents(item.firstElementChild.lastElementChild);
          const rect = range.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        return rects.flatMap((rect, index) =>
          rects
            .slice(index + 1)
            .flatMap((other, offset) =>
              rect.left < other.right - 0.5 &&
              rect.right > other.left + 0.5 &&
              rect.top < other.bottom - 0.5 &&
              rect.bottom > other.top + 0.5
                ? [[index, index + offset + 1]]
                : [],
            ),
        );
      });
      check(
        !collisions.length,
        `Million-value label collisions at ${width}: ${JSON.stringify(collisions)}`,
      );
      evidence.largeValues.push({ width, countPerDay: 1000000, collisions });
      await page.screenshot({
        path: path.join(outputRoot, `million-${width}.png`),
        fullPage: true,
      });
    }
    // A 720 CSS-pixel viewport at 2dppx models the layout space of a 1440px
    // screen at 200% browser zoom; this is layout emulation, not browser UI zoom.
    const zoomContext = await browser.newContext({
      viewport: { width: 720, height: 450 },
      deviceScaleFactor: 2,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
    });
    await zoomContext.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.externalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto(origin);
    await expect(zoomPage.getByRole("heading", { name: "Ranking por responsável" })).toBeVisible();
    const zoomOverflow = await zoomPage.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      offenders: Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className : "",
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        })
        .filter(({ left, right }) => left < -1 || right > innerWidth + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 12),
    }));
    check(
      zoomOverflow.document <= zoomOverflow.viewport + 1,
      `Horizontal overflow at 200% layout emulation: ${JSON.stringify(zoomOverflow.offenders)}`,
    );
    const zoomAxe = await new AxeBuilder({ page: zoomPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    check(!zoomAxe.violations.length, "Axe violations at 200% layout emulation");
    evidence.zoom = {
      method: "1440px screen at 200% layout emulation: 720 CSS px at 2dppx; not browser UI zoom",
      overflow: zoomOverflow,
      violations: zoomAxe.violations.map(({ id }) => id),
    };
    await zoomPage.screenshot({
      path: path.join(outputRoot, "layout-200-percent.png"),
      fullPage: true,
    });
    await zoomContext.close();
    check(!evidence.browserErrors.length, "Browser JavaScript errors");
    check(!evidence.externalRequests.length, "External requests attempted");
    evidence.passed = !evidence.failures.length;
  } catch (error) {
    evidence.failures.push(error.stack);
  } finally {
    await writeFile(path.join(outputRoot, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    JSON.stringify({
      passed: evidence.passed,
      screens: evidence.screens.length,
      failures: evidence.failures,
      outputRoot,
    }),
  );
  if (!evidence.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runAppointmentsPreview();
