import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import {
  chromium,
  expect as browserExpect,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RoutineSettings } from "@/app/(protected)/app/gestao/rotina/RoutineSettings";

describe("Rotina", () => {
  it("renders every routine option and keeps only regional house populated by default", () => {
    const markup = renderToStaticMarkup(<RoutineSettings />);
    for (const text of [
      "Rotina semanal e diária",
      "Gerente regional house",
      "Gerente regional imob",
      "Gerente house",
      "Coordenador de vendas",
      "Coordenador de parcerias",
      "Corretor",
      "Salva alterações",
      "Visualização da rotina",
      "Inserir linha",
      "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    ])
      expect(markup).toContain(text);
    expect(markup).not.toContain("Restaurar rotina");
    expect(markup).not.toContain("Classificação da semana");
    expect(markup).not.toContain("26 linhas");
    expect(markup).not.toContain("74 atividades");
    expect(markup).not.toContain("Domingo");
    expect(markup).toContain("Realizar uma preleção com o time");
    expect(markup).toContain("acionar o coordenador que gerou o contrato para resolver");
    expect(markup).toContain("Realizar uma nova consulta do CPF");
  });

  it("keeps editable controls and shared save behavior in the client component", () => {
    const source = readFileSync("app/(protected)/app/gestao/rotina/RoutineSettings.tsx", "utf8");
    expect(source).toContain('"use client"');
    expect(source).toContain('fetch("/api/routines"');
    expect(source).not.toContain("window.localStorage.setItem");
    expect(source).toContain("function addRow()");
    expect(source).toContain("<textarea");
  });

  it("guards the page on the server before rendering the routine workspace", () => {
    const source = readFileSync("app/(protected)/app/gestao/rotina/page.tsx", "utf8");
    expect(source).toContain('await enforcePermission("crm.dashboard.view")');
    expect(source).toContain('getProtectedPageGate("/app/gestao/rotina")?.releaseEnabled');
    expect(source).toContain("forbidden()");
  });

  it("isolates the QA clock from the other authenticated journeys", () => {
    const source = readFileSync("scripts/qa/authenticated-visual.mjs", "utf8");
    const routineStep = source.slice(
      source.indexOf('currentStage = "routine-settings"'),
      source.indexOf('currentStage = "connected-systems"'),
    );
    expect(routineStep).toContain("const routineContext = await browser.newContext(");
    expect(routineStep).toContain("await routineContext.newPage()");
    expect(routineStep).toContain("await login(routinePage, origin, email, password)");
    expect(routineStep).toContain("await routineContext.close()");
    expect(routineStep).not.toContain("await context.newPage()");
  });
});

const storageKey = "descomplica.crm.settings.routine.v1";
const saveError = "Não foi possível salvar no CRM.";
const loadError = "Não foi possível carregar a rotina do CRM.";
type Row = Record<string, string>;
type RecordFixture = { role_key: string; rows: Row[]; revision: number; updated_at: string };
function serverFixture(seed: Record<string, Row[]> = {}) {
  const days = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ];
  return {
    records: Object.fromEntries(
      Object.entries(seed).map(([role_key, rows]) => [
        role_key,
        {
          role_key,
          rows: rows.map((row) => Object.fromEntries(days.map((day) => [day, row[day] ?? ""]))),
          revision: 1,
          updated_at: "2026-10-12T15:00:00Z",
        },
      ]),
    ) as Record<string, RecordFixture>,
    puts: [] as Array<{ role_key: string; rows: Row[]; expected_revision: number }>,
    reads: 0,
    failSave: false,
    failGet: false,
    invalidGet: false,
  };
}
type ServerFixture = ReturnType<typeof serverFixture>;

// Chromium is opt-in, matching the existing browser fixtures used by the project.
describe.runIf(process.env.ROUTINE_SETTINGS_BROWSER === "1")("Rotina no navegador", () => {
  let browser: Browser;
  let page: Page;
  let fixtureHtml: string;
  let script: string;
  let stylesheet: string;
  let server: ServerFixture;
  let resumeLoad: () => void;
  let checkRoutineScrolling: (page: Page, region: Locator) => Promise<void>;
  let checkRoutineHeaderEffects: (page: Page) => Promise<void>;
  let checkRoutineCellEffects: (page: Page, outputDirectory?: string) => Promise<void>;

  beforeAll(async () => {
    ({ checkRoutineScrolling, checkRoutineHeaderEffects, checkRoutineCellEffects } = await import(
      pathToFileURL(resolve("scripts/qa/routine-settings.mjs")).href
    ));
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const root = resolve(".");
    const entry = resolve("tests/routine-settings-memory.tsx").replaceAll("\\", "/");
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
          name: "routine-settings-fixture",
          resolveId(id: string) {
            if (id.endsWith("routine-settings-memory.tsx")) return entry;
          },
          load(id: string) {
            if (id === entry)
              return `
                import { createElement } from "react";
                import { createRoot } from "react-dom/client";
                import "@/app/globals.css";
                import { RoutineSettings } from "@/app/(protected)/app/gestao/rotina/RoutineSettings";
                createRoot(document.getElementById("root")).render(createElement(RoutineSettings));
              `;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        lib: { entry, name: "RoutineSettingsQa", formats: ["iife"] },
      },
    });
    type BundleFile =
      | { type: "chunk"; code: string }
      | { type: "asset"; fileName: string; source: string | Uint8Array };
    const outputs = (Array.isArray(built) ? built : [built]) as Array<{
      output: BundleFile[];
    }>;
    const files = outputs.flatMap((output) => output.output);
    script = files.flatMap((file) => (file.type === "chunk" ? [file.code] : [])).join("\n");
    stylesheet = files
      .flatMap((file) =>
        file.type === "asset" && file.fileName.endsWith(".css") ? [String(file.source)] : [],
      )
      .join("\n");
    expect(script.length).toBeGreaterThan(0);
    fixtureHtml = `<!doctype html><html lang="pt-BR" data-theme="light"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Rotina QA</title><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}
      [data-protected-topbar]{position:sticky;top:0;height:58px;z-index:100;background:#fff;color:#111}</style>
      <link rel="stylesheet" href="/fixture.css"></head><body><nav data-protected-topbar aria-label="Menu sintético">Menu QA</nav><div id="root"></div>
      <script src="/fixture.js"></script></body></html>`;
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterEach(async () => {
    await page?.context().close();
  });

  async function expectUnsavedNavigation(expected: boolean) {
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(expected);
  }

  it("keeps complete activity text readable across desktop and mobile widths", async () => {
    await openRoutine();
    await mkdir("test-results/routine-preview", { recursive: true });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await browserExpect
        .poll(() =>
          page
            .locator("textarea")
            .evaluateAll((fields) =>
              fields.every((field) => field.scrollHeight <= field.clientHeight + 1),
            ),
        )
        .toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      const table = page.getByRole("region", { name: "Tabela de rotina semanal", exact: true });
      if (width < 960) {
        expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
          true,
        );
      }
      await page.screenshot({ path: `test-results/routine-preview/rotina-${width}.png` });
    }
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("highlights the Sao Paulo weekday and rolls over at local midnight", async () => {
    await openRoutine({ clock: "2026-10-12T02:59:50Z" });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await browserExpect(page.locator('thead [aria-current="date"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    await browserExpect(page.getByText("Sem rotina aos domingos.", { exact: true })).toBeVisible();
    await browserExpect(page.getByRole("textbox")).toHaveCount(0);
    await page.clock.fastForward(31_000);
    await browserExpect(page.locator('thead [aria-current="date"]')).toContainText("Segunda-feira");
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    for (const [offset, day] of [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ].entries()) {
      await page.clock.setSystemTime(new Date(Date.UTC(2026, 9, 12 + offset, 15)));
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await browserExpect(page.locator('thead [aria-current="date"]')).toContainText(day);
      await browserExpect(page.locator("tbody td[data-today]")).toHaveCount(26);
      expect(
        await page
          .locator("tbody td[data-today]")
          .evaluateAll(
            (cells, day) => cells.every((cell) => cell.getAttribute("data-label") === day),
            day,
          ),
      ).toBe(true);
    }
  });

  it.each(["light", "balanced", "dark"])(
    "renders continuous spreadsheet cells in %s without hiding text",
    async (theme) => {
      await openRoutine({ clock: "2026-10-12T15:00:00Z" });
      await mkdir("test-results/routine-preview", { recursive: true });
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await browserExpect
          .poll(() =>
            page
              .locator("textarea")
              .evaluateAll((fields) =>
                fields.every((field) => field.scrollHeight <= field.clientHeight + 1),
              ),
          )
          .toBe(true);
        const style = await page
          .locator("textarea")
          .first()
          .evaluate((field) => {
            const css = getComputedStyle(field);
            return {
              radius: css.borderRadius,
              border: css.borderTopWidth,
              background: css.backgroundColor,
              resize: css.resize,
            };
          });
        expect(style).toEqual({
          radius: "0px",
          border: "0px",
          background: "rgba(0, 0, 0, 0)",
          resize: "none",
        });
        expect(
          await page.locator("textarea").evaluateAll((fields) =>
            fields.every((field) => {
              const style = getComputedStyle(field);
              return (
                style.textAlign === "center" &&
                style.backgroundColor === "rgba(0, 0, 0, 0)" &&
                style.borderRadius === "0px"
              );
            }),
          ),
        ).toBe(true);
        expect(
          await page
            .locator("tbody td")
            .evaluateAll((cells) =>
              cells.every((cell) => getComputedStyle(cell).verticalAlign === "middle"),
            ),
        ).toBe(true);
        await page.locator("thead").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/routine-preview/planilha-${theme}-${width}.png`,
        });
      }
      await page.getByRole("button", { name: "Hoje", exact: true }).click();
      expect(
        await page
          .locator("textarea")
          .evaluateAll((fields) =>
            fields.every((field) => getComputedStyle(field).textAlign === "left"),
          ),
      ).toBe(true);
      await page.getByRole("button", { name: "Inserir linha", exact: true }).focus();
      await page.keyboard.press("Tab");
      await browserExpect(
        page.getByRole("button", { name: "Salva alterações", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await browserExpect(
        page.getByRole("tab", { name: "Gerente regional house", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await browserExpect(page.getByRole("tabpanel")).toBeFocused();
      await page.keyboard.press("Tab");
      await browserExpect(
        page.getByRole("region", { name: "Tabela de rotina do dia", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await browserExpect(page.locator("textarea").first()).toBeFocused();
      await page.waitForFunction(() =>
        document.documentElement
          .getAnimations({ subtree: true })
          .filter((animation) => animation instanceof CSSTransition)
          .every((animation) => animation.playState !== "running" && !animation.pending),
      );
      const focus = await page.locator("td:focus-within").evaluate((cell) => {
        const css = getComputedStyle(cell);
        // Resolve the theme token independently from the outline being checked.
        const probe = document.createElement("span");
        probe.style.color = "var(--inv-color-accent)";
        cell.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        return {
          outline: css.outlineColor,
          background: css.backgroundColor,
          style: css.outlineStyle,
          width: parseFloat(css.outlineWidth),
          accent,
        };
      });
      expect(
        focus.outline,
        `Daily keyboard focus must contrast with the ${theme} day gradient`,
      ).toBe("rgb(255, 255, 255)");
      expect(focus.outline, `Daily keyboard focus must differ from the ${theme} surface`).not.toBe(
        focus.background,
      );
      expect(focus.style).toBe("solid");
      expect(focus.width).toBeGreaterThanOrEqual(2);
      await page.getByRole("button", { name: "Semana", exact: true }).click();
    },
  );

  async function openRoutine(
    options: {
      stored?: string;
      legacy?: string;
      getError?: boolean;
      invalidGet?: boolean;
      holdLoad?: boolean;
      clock?: string;
      canEdit?: boolean;
      hasTouch?: boolean;
      reducedMotion?: "reduce" | "no-preference";
      server?: ServerFixture;
    } = {},
  ) {
    server = options.server ?? serverFixture(options.stored ? JSON.parse(options.stored) : {});
    server.failGet = options.getError ?? false;
    server.invalidGet = options.invalidGet ?? false;
    const backend = server;
    const held = options.holdLoad
      ? new Promise<void>((resolve) => {
          resumeLoad = resolve;
        })
      : Promise.resolve();
    const context = await browser.newContext({
      hasTouch: options.hasTouch ?? false,
      reducedMotion: options.reducedMotion ?? null,
    });
    page = await context.newPage();
    if (options.clock) await page.clock.install({ time: new Date(options.clock) });
    await page.route("http://routine.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/routines") {
        if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          backend.puts.push(body);
          if (backend.failSave)
            return route.fulfill({ status: 503, json: { error: "routine_unavailable" } });
          if (options.canEdit === false)
            return route.fulfill({ status: 403, json: { error: "forbidden" } });
          if (body.expected_revision !== (backend.records[body.role_key]?.revision ?? 0))
            return route.fulfill({ status: 409, json: { error: "revision_conflict" } });
          const record = {
            role_key: body.role_key,
            rows: body.rows,
            revision: body.expected_revision + 1,
            updated_at: "2026-10-12T16:00:00Z",
          };
          backend.records[body.role_key] = record;
          return route.fulfill({ json: record });
        }
        backend.reads++;
        await held;
        return route.fulfill({
          status: backend.failGet ? 503 : 200,
          json: backend.invalidGet
            ? {}
            : { routines: Object.values(backend.records), can_edit: options.canEdit ?? true },
        });
      }
      return route.fulfill({
        contentType:
          path === "/fixture.js"
            ? "text/javascript"
            : path === "/fixture.css"
              ? "text/css"
              : "text/html",
        body: path === "/fixture.js" ? script : path === "/fixture.css" ? stylesheet : fixtureHtml,
      });
    });
    if (options.legacy !== undefined)
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
        key: storageKey,
        value: options.legacy,
      });
    await page.goto("http://routine.test/");
    await browserExpect(
      page.getByRole("heading", { name: "Rotina semanal e diária", exact: true }),
    ).toBeVisible();
    if (!options.holdLoad && !options.getError && !options.invalidGet)
      await browserExpect(page.getByRole("tabpanel")).toHaveAttribute("aria-busy", "false");
  }

  async function savedRows() {
    await browserExpect(
      page.getByRole("button", { name: "Salva alterações", exact: true }),
    ).toBeEnabled();
    await browserExpect(page.locator('[role="status"]')).not.toContainText(
      "Alterações não salvas.",
    );
    return Object.fromEntries(
      Object.entries(server.records).map(([key, record]) => [key, record.rows]),
    );
  }

  it("blocks early edits and actions until the stored routine has loaded", async () => {
    await openRoutine({
      holdLoad: true,
      stored: JSON.stringify({ "regional-house": [{ "Segunda-feira": "Rotina recuperada" }] }),
    });
    await browserExpect(
      page.getByRole("button", { name: "Salva alterações", exact: true }),
    ).toBeDisabled();
    await browserExpect(
      page.getByRole("button", { name: "Inserir linha", exact: true }),
    ).toBeDisabled();
    expect(await page.locator('[role="tab"]:enabled, textarea:enabled').count()).toBe(0);
    expect(server.reads).toBe(1);
    resumeLoad();
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await browserExpect(cell).toHaveValue("Rotina recuperada");
    await cell.fill("Edição após carregar");
    await browserExpect(cell).toHaveValue("Edição após carregar");
    expect(server.reads).toBe(1);
  });

  it("saves changes across roles and restores them on reload", async () => {
    await openRoutine();
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Reunião QA");
    await page.getByRole("tab", { name: "Corretor" }).click();
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await page.getByRole("textbox", { name: "Sábado, linha 1", exact: true }).fill("Visita QA");
    await page.getByRole("button", { name: "Salva alterações" }).click();
    const stored = await savedRows();
    expect(stored["regional-house"]?.[0]?.["Segunda-feira"]).toBe("Reunião QA");
    expect(stored.corretor?.[0]?.["Sábado"]).toBe("Visita QA");
    await page.reload();
    await browserExpect(
      page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true }),
    ).toHaveValue("Reunião QA");
    await page.getByRole("tab", { name: "Corretor" }).click();
    await browserExpect(
      page.getByRole("textbox", { name: "Sábado, linha 1", exact: true }),
    ).toHaveValue("Visita QA");
  });

  it("protects pending edits on links, reload and history, then permits a saved exit", async () => {
    await openRoutine();
    await page.evaluate(() => {
      history.pushState({}, "", "/app/gestao/rotina");
      const link = document.createElement("a");
      link.href = "/app/gestao";
      link.textContent = "Voltar para gestão";
      document.body.prepend(link);
    });
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await cell.fill("Edição protegida QA");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts++;
      await dialog.dismiss();
    });
    await page.getByRole("link", { name: "Voltar para gestão" }).click();
    expect(prompts).toBe(1);
    await browserExpect(page).toHaveURL("http://routine.test/app/gestao/rotina");
    await browserExpect(cell).toHaveValue("Edição protegida QA");
    await page.evaluate(() => history.back());
    await browserExpect.poll(() => prompts).toBe(2);
    await browserExpect(page).toHaveURL("http://routine.test/app/gestao/rotina");
    await page.reload({ timeout: 2_000 }).catch(() => {});
    await browserExpect.poll(() => prompts).toBe(3);
    await browserExpect(cell).toHaveValue("Edição protegida QA");
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await savedRows();
    await page.getByRole("link", { name: "Voltar para gestão" }).click();
    await browserExpect(page).toHaveURL("http://routine.test/app/gestao");
    expect(prompts).toBe(3);
  });

  it("confirms a slow client navigation only once before the delayed history update", async () => {
    await openRoutine();
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/app/gestao";
      link.textContent = "Navegação lenta";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setTimeout(() => history.pushState({}, "", link.href), 1_500);
      });
      document.body.prepend(link);
    });
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Edição QA");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts++;
      if (prompts === 1) await dialog.accept();
      else await dialog.dismiss();
    });
    await page.getByRole("link", { name: "Navegação lenta" }).click();
    await browserExpect(page).toHaveURL("http://routine.test/app/gestao");
    expect(prompts).toBe(1);
  });

  it("keeps inserted rows and later edits separate from the last saved version", async () => {
    await openRoutine();
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await page.getByRole("tab", { name: "Corretor" }).click();
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await expectUnsavedNavigation(true);
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await savedRows();
    await expectUnsavedNavigation(false);
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Atividade QA");
    await expectUnsavedNavigation(true);
    await browserExpect(page.getByRole("tab", { name: "Corretor", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await browserExpect(page.locator("caption")).toContainText("corretor");
    await browserExpect(page.getByRole("tabpanel").locator("h2")).toHaveCount(0);
    await browserExpect(page.locator("tbody tr")).toHaveCount(1);
    expect(server.records.corretor?.rows[0]?.["Segunda-feira"]).toBe("");
  });

  it("keeps failed saves dirty, preserves the last stored version and permits retry", async () => {
    await openRoutine();
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await cell.fill("Versão salva QA");
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await cell.fill("Versão ainda não salva QA");
    server.failSave = true;
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await browserExpect(page.getByRole("alert")).toContainText(saveError);
    await expectUnsavedNavigation(true);
    await browserExpect(cell).toHaveValue("Versão ainda não salva QA");
    expect(server.records["regional-house"]?.rows[0]?.["Segunda-feira"]).toBe("Versão salva QA");
    server.failSave = false;
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await browserExpect(page.getByRole("alert")).toHaveCount(0);
    const retried = await savedRows();
    await expectUnsavedNavigation(false);
    expect(retried["regional-house"]?.[0]?.["Segunda-feira"]).toBe("Versão ainda não salva QA");
  });

  it.each([{ getError: true }, { invalidGet: true }])(
    "blocks editing after failed GET and allows explicit retry: %j",
    async (settings) => {
      await openRoutine(settings);
      await browserExpect(page.getByRole("alert")).toContainText(loadError);
      await browserExpect(page.getByRole("button", { name: "Salva alterações" })).toBeDisabled();
      await browserExpect(page.getByRole("textbox").first()).toBeDisabled();
      expect(server.puts).toEqual([]);
      server.failGet = false;
      server.invalidGet = false;
      await page.getByRole("button", { name: "Recarregar do CRM" }).click();
      await browserExpect(page.getByRole("textbox").first()).toBeEnabled();
      await browserExpect(page.getByRole("alert")).toHaveCount(0);
    },
  );

  it("defaults to six-day Semana with exact labels and no removed chrome", async () => {
    await openRoutine();
    await browserExpect(page.getByRole("tab")).toHaveText([
      "Gerente regional house",
      "Gerente regional imob",
      "Gerente house",
      "Coordenador de vendas",
      "Coordenador de parcerias",
      "Corretor",
    ]);
    const modes = page.getByRole("group", { name: "Visualização da rotina", exact: true });
    await browserExpect(modes.getByRole("button", { name: "Semana", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await browserExpect(modes.getByRole("button", { name: "Hoje", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await browserExpect(page.locator("tbody tr")).toHaveCount(26);
    await browserExpect(page.locator("tbody textarea")).toHaveCount(156);
    expect(
      await page
        .locator("textarea")
        .evaluateAll(
          (fields) =>
            fields.filter((field) => field instanceof HTMLTextAreaElement && field.value.trim())
              .length,
        ),
    ).toBe(74);
    await browserExpect(page.getByRole("columnheader")).toHaveText([
      "Linha",
      /Segunda-feira/,
      /Terça-feira/,
      /Quarta-feira/,
      /Quinta-feira/,
      /Sexta-feira/,
      /Sábado/,
    ]);
    await browserExpect(page.getByRole("button", { name: /Restaurar/ })).toHaveCount(0);
    await browserExpect(
      page.locator(".simulation-canvas-eyebrow, .simulation-canvas-status"),
    ).toHaveCount(0);
    await browserExpect(
      page.getByText(/26 linhas|74 atividades|Classificação da semana/),
    ).toHaveCount(0);
  });

  it("shows shared data read-only and never offers local import to readers", async () => {
    await openRoutine({
      canEdit: false,
      legacy: JSON.stringify({ "regional-house": [{ "Segunda-feira": "Local" }] }),
    });
    await browserExpect(page.getByText("Somente visualização", { exact: true })).toBeVisible();
    await browserExpect(page.getByRole("button", { name: "Salva alterações" })).toHaveCount(0);
    await browserExpect(page.getByRole("button", { name: "Inserir linha" })).toHaveCount(0);
    await browserExpect(
      page.getByRole("button", { name: "Importar cópia local desta função" }),
    ).toHaveCount(0);
    expect(await page.locator("textarea:not([readonly]):enabled").count()).toBe(0);
    await page.getByRole("tab", { name: "Corretor", exact: true }).click();
    await browserExpect(page.getByRole("tab", { name: "Corretor", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(server.puts).toEqual([]);
  });

  it("imports legacy only after confirmation, only for the active role, without autosave", async () => {
    const legacy = JSON.stringify(
      Object.fromEntries(
        Object.entries(
          serverFixture({
            "regional-house": [{ "Segunda-feira": "House local" }],
            corretor: [{ "Segunda-feira": "Corretor local" }],
          }).records,
        ).map(([role, record]) => [role, record.rows]),
      ),
    );
    await openRoutine({ legacy });
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await browserExpect(cell).not.toHaveValue("House local");
    expect(server.puts).toEqual([]);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Importar cópia local desta função" }).click();
    await browserExpect(cell).not.toHaveValue("House local");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Importar cópia local desta função" }).click();
    await browserExpect(cell).toHaveValue("House local");
    await expectUnsavedNavigation(true);
    expect(server.puts).toEqual([]);
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await savedRows();
    expect(server.puts.map((value) => value.role_key)).toEqual(["regional-house"]);
    expect(server.puts[0]?.expected_revision).toBe(0);
    await page.getByRole("tab", { name: "Corretor", exact: true }).click();
    await browserExpect(page.locator("tbody tr")).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(legacy);
  });

  it.each([
    "{}",
    "null",
    "[]",
    '"invalid root"',
    "{broken",
    JSON.stringify({ "regional-house": [{}] }),
    JSON.stringify({ "regional-house": "invalid rows" }),
    JSON.stringify({ corretor: [] }),
    JSON.stringify({
      "regional-house": [
        {
          ...serverFixture({ "regional-house": [{}] }).records["regional-house"]?.rows[0],
          extra: "invalid",
        },
      ],
    }),
  ])("does not offer import for missing active role or invalid legacy: %s", async (legacy) => {
    await openRoutine({ legacy });
    await browserExpect(
      page.getByRole("button", { name: "Importar cópia local desta função" }),
    ).toHaveCount(0);
    await browserExpect(page.locator("tbody tr")).toHaveCount(26);
    expect(server.puts).toEqual([]);
  });

  it("accepts an explicitly empty legacy role only after import and save", async () => {
    await openRoutine({ legacy: JSON.stringify({ "regional-house": [] }) });
    await browserExpect(page.locator("tbody tr")).toHaveCount(26);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Importar cópia local desta função" }).click();
    await browserExpect(page.locator("tbody tr")).toHaveCount(0);
    expect(server.puts).toEqual([]);
    await expectUnsavedNavigation(true);
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await savedRows();
    expect(server.records["regional-house"]?.rows).toEqual([]);
  });

  it("shares saved content across independent sessions and refreshes clean readers on focus and 30s", async () => {
    await openRoutine();
    const writer = page;
    const backend = server;
    try {
      await openRoutine({ server: backend, canEdit: false, clock: "2026-10-12T15:00:00Z" });
      const reader = page;
      const cellName = { name: "Segunda-feira, linha 1", exact: true };
      await writer.getByRole("textbox", cellName).fill("Compartilhada QA");
      await writer.getByRole("button", { name: "Salva alterações" }).click();
      await browserExpect(writer.getByRole("status")).toContainText("Salvo no CRM");
      await reader.evaluate(() => window.dispatchEvent(new Event("focus")));
      await browserExpect(reader.getByRole("textbox", cellName)).toHaveValue("Compartilhada QA");
      await writer.getByRole("textbox", cellName).fill("Atualizada QA");
      await writer.getByRole("button", { name: "Salva alterações" }).click();
      await browserExpect(writer.getByRole("status")).toContainText("Salvo no CRM");
      await reader.clock.fastForward(30_000);
      await browserExpect(reader.getByRole("textbox", cellName)).toHaveValue("Atualizada QA");
      expect(backend.puts.map((value) => value.expected_revision)).toEqual([0, 1]);
    } finally {
      await writer.context().close();
    }
  });

  it("preserves a stale session draft on 409 and requires confirmed reload", async () => {
    await openRoutine();
    const first = page;
    const backend = server;
    try {
      await openRoutine({ server: backend, clock: "2026-10-12T15:00:00Z" });
      const name = { name: "Segunda-feira, linha 1", exact: true };
      await page.getByRole("textbox", name).fill("Rascunho da segunda sessão");
      await first.getByRole("textbox", name).fill("Vencedora QA");
      await first.getByRole("button", { name: "Salva alterações" }).click();
      await browserExpect(first.getByRole("status")).toContainText("Salvo no CRM");
      const reads = backend.reads;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.clock.fastForward(30_000);
      expect(backend.reads).toBe(reads);
      await page.getByRole("button", { name: "Salva alterações" }).click();
      await browserExpect(page.getByRole("alert")).toContainText(
        "Outra pessoa alterou esta rotina.",
      );
      await browserExpect(page.getByRole("textbox", name)).toHaveValue(
        "Rascunho da segunda sessão",
      );
      await expectUnsavedNavigation(true);
      expect(backend.records["regional-house"]?.rows[0]?.["Segunda-feira"]).toBe("Vencedora QA");
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("button", { name: "Recarregar do CRM" }).click();
      await browserExpect(page.getByRole("textbox", name)).toHaveValue(
        "Rascunho da segunda sessão",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Recarregar do CRM" }).click();
      await browserExpect(page.getByRole("textbox", name)).toHaveValue("Vencedora QA");
      await expectUnsavedNavigation(false);
    } finally {
      await first.context().close();
    }
  });

  it("does not replace a successful PUT with an older in-flight GET", async () => {
    await openRoutine();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const requested = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route("**/api/routines", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      started();
      await held;
      await route.fulfill({ json: { routines: [], can_edit: true } });
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await requested;
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await cell.fill("PUT mais recente QA");
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await savedRows();
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/routines") && response.request().method() === "GET",
    );
    release();
    await response;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await browserExpect(cell).toHaveValue("PUT mais recente QA");
    await cell.fill("Próxima revisão QA");
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await savedRows();
    expect(server.puts.map((value) => value.expected_revision)).toEqual([0, 1]);
  });

  it("filters Hoje without losing original row indices or in-session edits", async () => {
    await openRoutine({
      clock: "2026-10-12T15:00:00Z",
      stored: JSON.stringify({
        "regional-house": [
          { "Segunda-feira": "Segunda QA", Domingo: "Legado A" },
          { "Terça-feira": "Terça QA" },
          {},
          { Domingo: "Somente domingo" },
        ],
      }),
    });
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    const region = page.getByRole("region", { name: "Tabela de rotina do dia", exact: true });
    await browserExpect(region).toBeVisible();
    await browserExpect(region.locator("caption")).toHaveText(
      "Rotina do dia editável para gerente regional house.",
    );
    await browserExpect(region.locator("tbody tr")).toHaveCount(2);
    const first = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    const blank = page.getByRole("textbox", { name: "Segunda-feira, linha 3", exact: true });
    await browserExpect(first).toHaveValue("Segunda QA");
    await browserExpect(blank).toHaveValue("");
    await first.fill("");
    await browserExpect(first).toBeVisible();
    await blank.fill("Inserção diária QA");
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await browserExpect(
      page.getByRole("textbox", { name: "Segunda-feira, linha 5", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 5", exact: true })
      .fill("Nova diária QA");
    await page.getByRole("button", { name: "Salva alterações", exact: true }).click();
    const stored = await savedRows();
    expect(stored["regional-house"]).toHaveLength(5);
    expect(stored["regional-house"]?.[0]?.Domingo).toBe("Legado A");
    expect(stored["regional-house"]?.[1]?.["Terça-feira"]).toBe("Terça QA");
    expect(stored["regional-house"]?.[2]?.["Segunda-feira"]).toBe("Inserção diária QA");
    expect(stored["regional-house"]?.[3]?.Domingo).toBe("Somente domingo");
    expect(stored["regional-house"]?.[4]?.["Segunda-feira"]).toBe("Nova diária QA");
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await browserExpect(page.locator("tbody tr")).toHaveCount(5);
    await browserExpect(page.getByRole("textbox", { name: /Domingo/ })).toHaveCount(0);
  });

  it("preserves legacy Sunday through save and reload while never displaying it", async () => {
    await openRoutine({
      clock: "2026-10-11T15:00:00Z",
      stored: JSON.stringify({
        "regional-house": [{ "Segunda-feira": "Segunda legada", Domingo: "Domingo privado QA" }],
        corretor: [{ Domingo: "Outro domingo QA" }],
      }),
    });
    await browserExpect(page.getByRole("textbox", { name: /Domingo/ })).toHaveCount(0);
    await browserExpect(page.getByText("Domingo privado QA", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    await browserExpect(page.getByText("Sem rotina aos domingos.", { exact: true })).toBeVisible();
    await browserExpect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Segunda atualizada");
    await page.getByRole("button", { name: "Salva alterações", exact: true }).click();
    const saved = await savedRows();
    expect(saved["regional-house"]?.[0]?.Domingo).toBe("Domingo privado QA");
    expect(saved.corretor?.[0]?.Domingo).toBe("Outro domingo QA");
    await page.reload();
    await browserExpect(
      page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true }),
    ).toHaveValue("Segunda atualizada");
    expect(await savedRows()).toEqual(saved);
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  });

  it.each(["light", "balanced", "dark"])(
    "keeps compact controls, day effects and footer accessible in %s",
    async (theme) => {
      await openRoutine({ clock: "2026-10-12T15:00:00Z" });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await mkdir("test-results/routine-preview", { recursive: true });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await checkRoutineHeaderEffects(page);
        await browserExpect(page.locator('thead [aria-current="date"]')).toHaveCount(1);
        await browserExpect(page.locator("tbody td[data-today]")).toHaveCount(26);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/routine-preview/compact-header-${theme}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        await page
          .locator("footer")
          .filter({ hasText: "Desenvolvido e gerenciado por Leandro Lucas" })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/routine-preview/compact-footer-${theme}-${width}.png`,
          animations: "disabled",
        });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    },
    30_000,
  );

  it.each(["light", "balanced", "dark"])(
    "highlights rows and weekly columns without moving cells in %s",
    async (theme) => {
      await openRoutine({ clock: "2026-10-12T15:00:00Z" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await checkRoutineCellEffects(page, "test-results/routine-preview");
      expect(server.puts).toEqual([]);
      await expectUnsavedNavigation(false);
    },
    20_000,
  );

  it("checks both motion modes and restores the authenticated runner's reduced context", async () => {
    await openRoutine({ clock: "2026-10-12T15:00:00Z", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const reduced = () =>
      page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(await reduced()).toBe(true);
    // The application's global !important rule must participate in this fixture.
    expect(
      await page.evaluate(() => parseFloat(getComputedStyle(document.body).transitionDuration)),
    ).toBe(0.00001);
    await checkRoutineHeaderEffects(page);
    expect(await reduced()).toBe(true);
    await checkRoutineCellEffects(page);
    expect(await reduced()).toBe(true);
    expect(server.puts).toEqual([]);
    await expectUnsavedNavigation(false);
  }, 20_000);

  it.each(["header", "cells"] as const)(
    "restores reduced motion after a %s assertion failure",
    async (helper) => {
      await openRoutine({ clock: "2026-10-12T15:00:00Z", reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1440, height: 900 });
      // Deliberately break only this synthetic page to exercise failure cleanup.
      await page.addStyleTag({
        content:
          helper === "header"
            ? "thead th { background-image: none !important; }"
            : "tbody td, tbody textarea { transform: none !important; scale: none !important; }",
      });
      if (helper === "header")
        await expect(checkRoutineHeaderEffects(page)).rejects.toThrow(/linear-gradient/);
      else
        await expect(checkRoutineCellEffects(page)).rejects.toThrow(
          "Hovered intersection scales subtly",
        );
      expect(
        await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      ).toBe(true);
      expect(server.puts).toEqual([]);
    },
  );

  it("keeps touch mode buttons at least 44px with a coarse pointer", async () => {
    await openRoutine({ hasTouch: true, clock: "2026-10-12T15:00:00Z" });
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of ["Semana", "Hoje"]) {
        const button = page
          .getByRole("group", { name: "Visualização da rotina", exact: true })
          .getByRole("button", { name, exact: true });
        const size = await button.boundingBox();
        expect(size?.height).toBeGreaterThanOrEqual(44);
        expect(size?.width).toBeGreaterThanOrEqual(44);
        await button.tap();
        await browserExpect(button).toHaveAttribute("aria-pressed", "true");
      }
    }
    expect(server.puts).toEqual([]);
    await expectUnsavedNavigation(false);
  });

  it.each(["light", "balanced", "dark"])(
    "passes Axe including contrast in weekly and daily %s",
    async (theme) => {
      await openRoutine({ clock: "2026-10-12T15:00:00Z" });
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const mode of ["Semana", "Hoje"]) {
          await page.getByRole("button", { name: mode, exact: true }).click();
          await page.mouse.move(0, 0);
          await page.waitForFunction(() =>
            document
              .getAnimations()
              .filter((animation) => animation instanceof CSSTransition)
              .every((animation) => animation.playState !== "running" && !animation.pending),
          );
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(
            result.violations.map(({ id, nodes }) => ({
              id,
              nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
            })),
            `${theme} / ${width}px / ${mode}`,
          ).toEqual([]);
        }
      }
    },
    90_000,
  );

  it("uses a regular responsive title and a gold specular save action respecting reduced motion", async () => {
    await openRoutine();
    const title = page.getByRole("heading", { name: "Rotina semanal e diária", exact: true });
    for (const [width, size] of [
      [1440, "32px"],
      [390, "24px"],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await browserExpect(title).toHaveCSS("font-size", size);
      await browserExpect(title).toHaveCSS("font-weight", "400");
    }
    const save = page.getByRole("button", { name: "Salva alterações", exact: true });
    for (const state of ["idle", "hover", "focus"] as const) {
      if (state === "hover") await save.hover();
      if (state === "focus") {
        await page.mouse.move(0, 0);
        await page.keyboard.press("Tab");
        await save.focus();
        await browserExpect(save).toBeFocused();
      }
      const effect = await save.evaluate((element) => {
        const css = getComputedStyle(element, "::before");
        return {
          name: css.animationName,
          duration: css.animationDuration,
          iterations: css.animationIterationCount,
          background: css.backgroundImage,
          pointerEvents: css.pointerEvents,
        };
      });
      expect(effect.name).not.toBe("none");
      expect(effect.duration).toBe("4.5s");
      expect(effect.iterations).toBe("infinite");
      expect(effect.background).toContain("conic-gradient");
      expect(effect.background).toContain("rgb(213, 185, 111)");
      expect(effect.pointerEvents).toBe("none");
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await save.evaluate((element) => getComputedStyle(element, "::before").animationName),
    ).toBe("none");
  });

  it("pins only real day headers below the menu during window scroll and fits Hoje on mobile", async () => {
    await openRoutine({ clock: "2026-10-12T15:00:00Z" });
    await page.setViewportSize({ width: 390, height: 800 });
    const region = page.getByRole("region", { name: "Tabela de rotina semanal", exact: true });
    const insert = page.getByRole("button", { name: "Inserir linha", exact: true });
    await browserExpect(insert).toBeVisible();
    expect(await insert.evaluate((element) => element.closest("table") === null)).toBe(true);
    expect(
      await region.locator("table").evaluate((element) => getComputedStyle(element).minWidth),
    ).toBe("960px");
    await checkRoutineScrolling(page, region);
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    const daily = page.getByRole("region", { name: "Tabela de rotina do dia", exact: true });
    await browserExpect
      .poll(() => daily.evaluate((element) => [element.scrollTop, element.scrollLeft]))
      .toEqual([0, 0]);
    expect(
      await daily.locator("table").evaluate((element) => getComputedStyle(element).minWidth),
    ).toBe("0px");
    expect(await daily.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    await mkdir("test-results/routine-preview", { recursive: true });
    for (const theme of ["light", "balanced", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole("button", { name: "Semana", exact: true }).click();
        await checkRoutineScrolling(page, region);
        await region.evaluate((element) => {
          window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 400);
          element.scrollLeft = element.scrollWidth;
        });
        await page.screenshot({
          path: `test-results/routine-preview/semana-scroll-${theme}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        await page.getByRole("button", { name: "Hoje", exact: true }).click();
        await browserExpect
          .poll(() => daily.evaluate((element) => [element.scrollTop, element.scrollLeft]))
          .toEqual([0, 0]);
        await page.screenshot({
          path: `test-results/routine-preview/hoje-${theme}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }, 30_000);

  it("links every tab and panel and supports arrows, Home, End and roving focus", async () => {
    await openRoutine();
    const tabs = page.getByRole("tab");
    expect(await tabs.count()).toBe(6);
    for (const tab of await tabs.all()) {
      const id = await tab.getAttribute("id");
      const panelId = await tab.getAttribute("aria-controls");
      const panel = page.locator(`[id="${panelId}"]`);
      await browserExpect(panel).toHaveAttribute("role", "tabpanel");
      await browserExpect(panel).toHaveAttribute("aria-labelledby", id!);
    }
    await tabs.nth(0).focus();
    for (const [key, index] of [
      ["ArrowRight", 1],
      ["ArrowDown", 2],
      ["ArrowUp", 1],
      ["ArrowLeft", 0],
      ["ArrowLeft", 5],
      ["ArrowRight", 0],
      ["End", 5],
      ["Home", 0],
    ] as const) {
      await page.keyboard.press(key);
      const selected = tabs.nth(index);
      await browserExpect(selected).toBeFocused();
      await browserExpect(selected).toHaveAttribute("aria-selected", "true");
      await browserExpect(selected).toHaveAttribute("tabindex", "0");
      expect(await page.locator('[role="tab"][tabindex="0"]').count()).toBe(1);
      await browserExpect(page.getByRole("tabpanel")).toHaveAttribute(
        "id",
        (await selected.getAttribute("aria-controls"))!,
      );
    }
    await page.keyboard.press("Tab");
    await browserExpect(page.getByRole("tabpanel")).toBeFocused();
    await page.getByRole("tab", { name: "Coordenador de parcerias" }).click();
    await browserExpect(
      page.getByRole("tab", { name: "Coordenador de parcerias" }),
    ).toHaveAttribute("tabindex", "0");
    await browserExpect(page.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "routine-panel-coordenador-parcerias",
    );
  });
});
