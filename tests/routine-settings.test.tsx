import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
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

  it("keeps editable controls and local save behavior in the client component", () => {
    const source = readFileSync("app/(protected)/app/gestao/rotina/RoutineSettings.tsx", "utf8");
    expect(source).toContain('"use client"');
    expect(source).toContain("window.localStorage.setItem");
    expect(source).toContain("function addRow()");
    expect(source).toContain("<textarea");
  });

  it("guards the page on the server before rendering the routine workspace", () => {
    const source = readFileSync("app/(protected)/app/gestao/rotina/page.tsx", "utf8");
    expect(source).toContain('await enforcePermission("crm.settings.manage")');
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
const saveError = "Não foi possível salvar a rotina neste navegador.";
const loadError = "Não foi possível carregar a rotina salva neste navegador.";

type FixtureWindow = Window & {
  routineFailSave: boolean;
  routineReadCount: number;
  resumeRoutineLoad: () => void;
};

// Chromium is opt-in, matching the existing browser fixtures used by the project.
describe.runIf(process.env.ROUTINE_SETTINGS_BROWSER === "1")("Rotina no navegador", () => {
  let browser: Browser;
  let page: Page;
  let fixtureHtml: string;
  let script: string;
  let stylesheet: string;

  beforeAll(async () => {
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
      <title>Rotina QA</title><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}</style>
      <link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div>
      <script src="/fixture.js"></script></body></html>`;
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterEach(async () => {
    await page?.close();
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
      await page.getByRole("button", { name: "Inserir linha", exact: true }).focus();
      await page.keyboard.press("Tab");
      await browserExpect(page.locator("textarea").first()).toBeFocused();
      await page.waitForFunction(() =>
        document.documentElement
          .getAnimations({ subtree: true })
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
      expect(focus.outline, `Daily keyboard focus must use the ${theme} accent`).toBe(focus.accent);
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
      getError?: boolean;
      setError?: boolean;
      holdLoad?: boolean;
      clock?: string;
    } = {},
  ) {
    page = await browser.newPage();
    if (options.clock) await page.clock.install({ time: new Date(options.clock) });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://routine.test/**", (route) => {
      const path = new URL(route.request().url()).pathname;
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
    await page.addInitScript(
      ({ key, settings }) => {
        if (settings.stored !== undefined && !sessionStorage.getItem("routineFixtureSeeded")) {
          localStorage.setItem(key, settings.stored);
          sessionStorage.setItem("routineFixtureSeeded", "true");
        }
        const fixtureWindow = window as unknown as FixtureWindow;
        fixtureWindow.routineFailSave = settings.setError ?? false;
        fixtureWindow.routineReadCount = 0;
        const getItem = Storage.prototype.getItem;
        const setItem = Storage.prototype.setItem;
        Storage.prototype.getItem = function (key) {
          fixtureWindow.routineReadCount++;
          if (settings.getError) throw new DOMException("Storage blocked", "SecurityError");
          return getItem.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          if (fixtureWindow.routineFailSave)
            throw new DOMException("Storage full", "QuotaExceededError");
          return setItem.call(this, key, value);
        };
        if (settings.holdLoad) {
          const setTimeout = fixtureWindow.setTimeout.bind(fixtureWindow);
          let held = true;
          const callbacks: Array<() => void> = [];
          fixtureWindow.resumeRoutineLoad = () => {
            held = false;
            callbacks.splice(0).forEach((callback) => callback());
          };
          fixtureWindow.setTimeout = (handler, timeout, ...args) =>
            setTimeout(
              typeof handler === "function" && timeout === 0
                ? () => {
                    if (held) callbacks.push(() => handler(...args));
                    else handler(...args);
                  }
                : handler,
              timeout,
              ...args,
            );
        }
      },
      { key: storageKey, settings: options },
    );
    await page.goto("http://routine.test/");
    await browserExpect(page.getByRole("heading", { name: "Rotina semanal e diária", exact: true }))
      .toBeVisible({ timeout: 2500 })
      .catch((error) => {
        throw new Error(`${error.message}\nBrowser errors: ${errors.join("; ")}`);
      });
    expect(errors).toEqual([]);
    if (!options.holdLoad)
      await browserExpect(page.getByRole("button", { name: "Salva alterações" })).toBeEnabled();
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
    expect(await page.evaluate(() => (window as unknown as FixtureWindow).routineReadCount)).toBe(
      0,
    );
    await page.evaluate(() => (window as unknown as FixtureWindow).resumeRoutineLoad());
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await browserExpect(cell).toHaveValue("Rotina recuperada");
    await cell.fill("Edição após carregar");
    await browserExpect(cell).toHaveValue("Edição após carregar");
    expect(await page.evaluate(() => (window as unknown as FixtureWindow).routineReadCount)).toBe(
      1,
    );
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
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(stored["regional-house"][0]["Segunda-feira"]).toBe("Reunião QA");
    expect(stored.corretor[0]["Sábado"]).toBe("Visita QA");
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
    await expectUnsavedNavigation(false);
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Atividade QA");
    await expectUnsavedNavigation(true);
    await browserExpect(
      page.getByRole("heading", { name: "Corretor", exact: true }).first(),
    ).toBeVisible();
    await browserExpect(page.locator("tbody tr")).toHaveCount(1);
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(stored.corretor[0]["Segunda-feira"]).toBe("");
  });

  it("keeps failed saves dirty, preserves the last stored version and permits retry", async () => {
    await openRoutine();
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await cell.fill("Versão salva QA");
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await cell.fill("Versão ainda não salva QA");
    await page.evaluate(() => {
      (window as unknown as FixtureWindow).routineFailSave = true;
    });
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await browserExpect(page.getByRole("alert")).toContainText(saveError);
    await expectUnsavedNavigation(true);
    await browserExpect(cell).toHaveValue("Versão ainda não salva QA");
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(stored["regional-house"][0]["Segunda-feira"]).toBe("Versão salva QA");
    await page.evaluate(() => {
      (window as unknown as FixtureWindow).routineFailSave = false;
    });
    await page.getByRole("button", { name: "Salva alterações" }).click();
    await browserExpect(page.getByRole("alert")).toHaveCount(0);
    await expectUnsavedNavigation(false);
    const retried = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    );
    expect(retried["regional-house"][0]["Segunda-feira"]).toBe("Versão ainda não salva QA");
  });

  it.each([{ getError: true }, { stored: "{invalid-json" }])(
    "reports read failures and invalid JSON without blocking editing: %j",
    async (settings) => {
      await openRoutine(settings);
      await browserExpect(page.getByRole("alert")).toContainText(loadError);
      const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
      await browserExpect(cell).toHaveValue(
        "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
      );
      await cell.fill("Recuperação QA");
      await page.getByRole("button", { name: "Salva alterações" }).click();
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
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(stored["regional-house"]).toHaveLength(5);
    expect(stored["regional-house"][0].Domingo).toBe("Legado A");
    expect(stored["regional-house"][1]["Terça-feira"]).toBe("Terça QA");
    expect(stored["regional-house"][2]["Segunda-feira"]).toBe("Inserção diária QA");
    expect(stored["regional-house"][3].Domingo).toBe("Somente domingo");
    expect(stored["regional-house"][4]["Segunda-feira"]).toBe("Nova diária QA");
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
    const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    expect(JSON.parse(saved!)["regional-house"][0].Domingo).toBe("Domingo privado QA");
    expect(JSON.parse(saved!).corretor[0].Domingo).toBe("Outro domingo QA");
    await page.reload();
    await browserExpect(
      page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true }),
    ).toHaveValue("Segunda atualizada");
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(saved);
  });

  it("keeps the toolbar and day headers visible while scrolling and fits Hoje on mobile", async () => {
    await openRoutine({ clock: "2026-10-12T15:00:00Z" });
    await page.setViewportSize({ width: 390, height: 800 });
    const region = page.getByRole("region", { name: "Tabela de rotina semanal", exact: true });
    const insert = region.getByRole("button", { name: "Inserir linha", exact: true });
    await browserExpect(insert).toBeVisible();
    expect(await insert.evaluate((element) => element.closest("table") === null)).toBe(true);
    await region.scrollIntoViewIfNeeded();
    expect(
      await region.evaluate((element) =>
        Number.isFinite(parseFloat(getComputedStyle(element).maxHeight)),
      ),
    ).toBe(true);
    expect(
      await region.locator("table").evaluate((element) => getComputedStyle(element).minWidth),
    ).toBe("960px");
    await region.evaluate((element) => {
      element.scrollTop = 0;
    });
    const beforeInsert = await insert.boundingBox();
    const beforeHeader = await region.locator("thead th").first().boundingBox();
    await region.evaluate((element) => {
      element.scrollTop = 400;
    });
    await browserExpect
      .poll(() => region.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const afterInsert = await insert.boundingBox();
    const afterHeader = await region.locator("thead th").first().boundingBox();
    expect(beforeInsert).not.toBeNull();
    expect(beforeHeader).not.toBeNull();
    expect(Math.abs(afterInsert!.y - beforeInsert!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(afterHeader!.y - beforeHeader!.y)).toBeLessThanOrEqual(2);
    expect(afterHeader!.y).toBeGreaterThanOrEqual(afterInsert!.y + afterInsert!.height);
    await region.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(await region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const horizontalInsert = await insert.boundingBox();
    expect(Math.abs(horizontalInsert!.x - afterInsert!.x)).toBeLessThanOrEqual(2);
    expect(horizontalInsert!.x).toBeGreaterThanOrEqual((await region.boundingBox())!.x);
    expect(horizontalInsert!.x + horizontalInsert!.width).toBeLessThanOrEqual(
      (await region.boundingBox())!.x + (await region.boundingBox())!.width,
    );
    await region.getByRole("button", { name: "Hoje", exact: true }).click();
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
        await region.evaluate((element) => {
          element.scrollTop = 400;
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
