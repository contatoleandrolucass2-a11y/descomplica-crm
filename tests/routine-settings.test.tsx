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
      "Rotina",
      "Gerente regional house",
      "Gerente regional imob",
      "Gerente house",
      "Coordenador de vendas",
      "Coordenador de parcerias",
      "Corretor",
      "Classificação da semana",
      "Salvar alterações",
      "Inserir linha",
      "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    ])
      expect(markup).toContain(text);
    expect(markup).toContain("Nulo");
    expect(markup).toContain("26 linhas");
    expect(markup).toContain("74 atividades");
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
});

const storageKey = "descomplica.crm.settings.routine.v1";
const dirtyMessage = "Alterações não salvas.";
const savedMessage = "Último salvamento local em";
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
      if (width < 1180) {
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

  async function openRoutine(
    options: { stored?: string; getError?: boolean; setError?: boolean; holdLoad?: boolean } = {},
  ) {
    page = await browser.newPage();
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
        if (settings.stored !== undefined) localStorage.setItem(key, settings.stored);
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
    await browserExpect(page.getByRole("heading", { name: "Rotina", exact: true }))
      .toBeVisible({ timeout: 2500 })
      .catch((error) => {
        throw new Error(`${error.message}\nBrowser errors: ${errors.join("; ")}`);
      });
    expect(errors).toEqual([]);
    if (!options.holdLoad)
      await browserExpect(page.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
  }

  it("blocks early edits and actions until the stored routine has loaded", async () => {
    await openRoutine({
      holdLoad: true,
      stored: JSON.stringify({ "regional-house": [{ "Segunda-feira": "Rotina recuperada" }] }),
    });
    await browserExpect(page.getByText("Carregando rotina.")).toBeVisible();
    expect(await page.locator("button:enabled, textarea:enabled").count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as FixtureWindow).routineReadCount)).toBe(
      0,
    );
    await page.evaluate(() => (window as unknown as FixtureWindow).resumeRoutineLoad());
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await browserExpect(cell).toHaveValue("Rotina recuperada");
    await cell.fill("Edição após carregar");
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toBeVisible();
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
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Corretor" }).click();
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await page.getByRole("textbox", { name: "Domingo, linha 1", exact: true }).fill("Visita QA");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await browserExpect(page.getByText(savedMessage, { exact: false })).toBeVisible();
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toHaveCount(0);
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(stored["regional-house"][0]["Segunda-feira"]).toBe("Reunião QA");
    expect(stored.corretor[0].Domingo).toBe("Visita QA");
    await page.reload();
    await browserExpect(
      page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true }),
    ).toHaveValue("Reunião QA");
    await page.getByRole("tab", { name: "Corretor" }).click();
    await browserExpect(
      page.getByRole("textbox", { name: "Domingo, linha 1", exact: true }),
    ).toHaveValue("Visita QA");
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toHaveCount(0);
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
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toHaveCount(0);
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

  it("marks inserted rows and later edits as unsaved instead of showing old success", async () => {
    await openRoutine();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await browserExpect(page.getByText(savedMessage, { exact: false })).toBeVisible();
    await page.getByRole("tab", { name: "Corretor" }).click();
    await page.getByRole("button", { name: "Inserir primeira linha" }).click();
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toBeVisible();
    await browserExpect(page.getByText(savedMessage, { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Atividade QA");
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toBeVisible();
    await browserExpect(page.getByText(savedMessage, { exact: false })).toHaveCount(0);
    await browserExpect(
      page.getByRole("heading", { name: "Corretor", exact: true }).first(),
    ).toBeVisible();
    await browserExpect(
      page.getByText("1 atividade em 1 linha na semana.", { exact: true }),
    ).toBeVisible();
  });

  it("keeps failed saves dirty, preserves the last stored version and permits retry", async () => {
    await openRoutine();
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await cell.fill("Versão salva QA");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await browserExpect(page.getByText(savedMessage, { exact: false })).toBeVisible();
    await cell.fill("Versão ainda não salva QA");
    await page.evaluate(() => {
      (window as unknown as FixtureWindow).routineFailSave = true;
    });
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await browserExpect(page.getByRole("alert")).toContainText(saveError);
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toBeVisible();
    await browserExpect(page.getByText(savedMessage, { exact: false })).toHaveCount(0);
    await browserExpect(cell).toHaveValue("Versão ainda não salva QA");
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
    expect(stored["regional-house"][0]["Segunda-feira"]).toBe("Versão salva QA");
    await page.evaluate(() => {
      (window as unknown as FixtureWindow).routineFailSave = false;
    });
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await browserExpect(page.getByRole("alert")).toHaveCount(0);
    await browserExpect(page.getByText(savedMessage, { exact: false })).toBeVisible();
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toHaveCount(0);
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
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await browserExpect(page.getByRole("alert")).toHaveCount(0);
      await browserExpect(page.getByText(savedMessage, { exact: false })).toBeVisible();
    },
  );

  it("requires confirmation to restore and keeps other roles and storage intact", async () => {
    await openRoutine();
    await page.getByRole("tab", { name: "Corretor" }).click();
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true })
      .fill("Corretor QA");
    await page.getByRole("tab", { name: "Gerente regional house" }).click();
    const cell = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    await cell.fill("Edição QA");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    const reset = page.getByRole("button", { name: "Restaurar rotina da função ativa" });
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("As alterações desta função serão descartadas.");
      await dialog.dismiss();
    });
    await reset.click();
    await browserExpect(cell).toHaveValue("Edição QA");
    await browserExpect(page.getByText(savedMessage, { exact: false })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await reset.click();
    await browserExpect(cell).toHaveValue(
      "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
    );
    await browserExpect(page.getByText(dirtyMessage, { exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(saved);
    await page.getByRole("tab", { name: "Corretor" }).click();
    await browserExpect(cell).toHaveValue("Corretor QA");
  });

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
