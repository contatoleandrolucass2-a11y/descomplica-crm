import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  DashboardMonthlyHistory,
  type DashboardMonthlyHistoryMonth,
  type DashboardMonthlyHistoryProps,
} from "@/app/(protected)/app/_components/DashboardMonthlyHistory";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

function elements(node: Node, tag: string): Element[] {
  const found: Element[] = "tagName" in node && node.tagName === tag ? [node] : [];
  if ("childNodes" in node)
    for (const child of node.childNodes) found.push(...elements(child, tag));
  return found;
}

function text(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join("") : "";
}

function attribute(node: Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

const months: DashboardMonthlyHistoryMonth[] = [
  { month: "2026-09", readings: [{ key: "sales", value: 20 }] },
  { month: "2026-07", readings: [{ key: "sales", value: 0 }] },
  { month: "2026-08", readings: [{ key: "sales", value: null }] },
];

function render(overrides: Partial<DashboardMonthlyHistoryProps> = {}) {
  return parseFragment(
    renderToStaticMarkup(
      createElement(DashboardMonthlyHistory, { title: "Média mensal", months, ...overrides }),
    ),
  );
}

describe("DashboardMonthlyHistory", () => {
  it("renders a named native dialog with a labelled information trigger", () => {
    const root = render();
    const [trigger, close] = elements(root, "button");
    const dialog = elements(root, "dialog")[0]!;
    expect(attribute(trigger!, "aria-haspopup")).toBe("dialog");
    expect(attribute(trigger!, "aria-label")).toBe("Ver histórico mensal: Média mensal");
    expect(attribute(trigger!, "aria-controls")).toBe(attribute(dialog, "id"));
    expect(attribute(dialog, "aria-labelledby")).toBe(attribute(elements(root, "h2")[0]!, "id"));
    expect(attribute(dialog, "open")).toBeUndefined();
    expect(attribute(close!, "aria-label")).toBe("Fechar histórico mensal");
  });

  it("lists exactly the supplied months in pt-BR chronological order without mutating inputs", () => {
    const original = structuredClone(months);
    const root = render();
    expect(elements(elements(root, "ul")[0]!, "time").map(text)).toEqual([
      "jul. de 2026",
      "ago. de 2026",
      "set. de 2026",
    ]);
    expect(text(root)).toContain("Meses considerados (3)");
    expect(months).toEqual(original);
    expect(text(root)).not.toContain("out. de 2026");
  });

  it("graphs every stage and preserves missing readings separately from numeric zero", () => {
    const figures = elements(render(), "figure");
    expect(figures.map((figure) => text(elements(figure, "figcaption")[0]!))).toEqual([
      "Oportunidades",
      "Agendamentos",
      "Visitas",
      "Pastas",
      "Pastas aprovadas",
      "Vendas",
    ]);
    const sales = figures[5]!;
    expect(elements(sales, "span").map(text)).toEqual(["0", "Sem histórico", "20"]);
    expect(elements(sales, "svg").map((svg) => elements(svg, "rect").length)).toEqual([2, 1, 2]);
    expect(
      elements(elements(sales, "svg")[0]!, "rect").map((rect) => attribute(rect, "width")),
    ).toEqual(["100", "0"]);
    expect(elements(figures[0]!, "span").map(text)).toEqual(Array(3).fill("Sem histórico"));
  });

  it("limits the Imob history to the four authorized funnel stages", () => {
    const figures = elements(
      render({ stageKeys: ["visits", "folders", "approved-folders", "sales"] }),
      "figure",
    );
    expect(figures.map((figure) => text(elements(figure, "figcaption")[0]!))).toEqual([
      "Visitas",
      "Pastas",
      "Pastas aprovadas",
      "Vendas",
    ]);
  });

  it("uses actual relative bar lengths for each stage", () => {
    const root = render({
      months: [
        { month: "2026-01", readings: [{ key: "sales", value: 10 }] },
        { month: "2026-02", readings: [{ key: "sales", value: 40 }] },
      ],
    });
    const sales = elements(root, "figure")[5]!;
    expect(
      elements(sales, "svg").map((svg) => attribute(elements(svg, "rect")[1]!, "width")),
    ).toEqual(["25", "100"]);
  });

  it("shows empty history, coverage and missing reason without inventing months", () => {
    const root = render({
      months: [],
      coverage: "0 meses completos",
      missingReason: "Fonte indisponível.",
    });
    expect(text(root)).toContain("0 meses completos");
    expect(text(root)).toContain("Fonte indisponível.");
    expect(text(root)).toContain("Sem histórico mensal disponível.");
    expect(elements(root, "figure")).toHaveLength(0);
    expect(elements(root, "time")).toHaveLength(0);
  });

  it("treats nonfinite and absent readings as missing but retains an all-zero month", () => {
    const missing = render({
      months: [
        {
          month: "2026-09",
          readings: [
            { key: "sales", value: Infinity },
            { key: "visits", value: NaN },
          ],
        },
      ],
    });
    expect(text(missing)).toContain("Sem histórico mensal disponível.");
    expect(text(missing)).not.toMatch(/NaN|Infinity/);
    const zero = render({ months: [{ month: "2026-09", readings: [{ key: "sales", value: 0 }] }] });
    expect(text(zero)).not.toContain("Sem histórico mensal disponível.");
    expect(elements(elements(zero, "figure")[5]!, "span").map(text)).toEqual(["0"]);
  });

  it("uses unique IDs for multiple cards and no inline CSS", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "main",
        null,
        createElement(DashboardMonthlyHistory, { title: "Média anual", months }),
        createElement(DashboardMonthlyHistory, { title: "Últimos 3 meses", months }),
      ),
    );
    const ids = elements(parseFragment(markup), "dialog").map((dialog) => attribute(dialog, "id"));
    expect(new Set(ids).size).toBe(2);
    expect(markup).not.toContain("style=");
  });

  it.runIf(process.env.DASHBOARD_MONTHLY_HISTORY_BROWSER === "1")(
    "opens, traps focus, closes and restores focus on mobile and desktop in all themes",
    async () => {
      const require = createRequire(import.meta.url);
      const vitestRequire = createRequire(require.resolve("vitest/package.json"));
      const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
      const root = resolve(".");
      const entry = resolve("tests/dashboard-monthly-history-memory.tsx").replaceAll("\\", "/");
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
            name: "dashboard-monthly-history-fixture",
            resolveId(id: string) {
              if (id.endsWith("dashboard-monthly-history-memory.tsx")) return entry;
            },
            load(id: string) {
              if (id === entry)
                return `
              import { createElement } from "react";
              import { createRoot } from "react-dom/client";
              import "@/app/globals.css";
              import { DashboardMonthlyHistory } from "@/app/(protected)/app/_components/DashboardMonthlyHistory";
              createRoot(document.getElementById("root")).render(createElement("main", null,
                createElement(DashboardMonthlyHistory, {
                  title: "Média dos últimos três meses completos",
                  months: ${JSON.stringify(months)}, coverage: "3 meses considerados"
                }), createElement("button", null, "Fora do modal")));
            `;
            },
          },
        ],
        build: {
          write: false,
          minify: false,
          lib: { entry, name: "MonthlyHistoryQa", formats: ["iife"] },
        },
      });
      type BundleFile =
        | { type: "chunk"; code: string }
        | { type: "asset"; fileName: string; source: string | Uint8Array };
      const outputs = (Array.isArray(built) ? built : [built]) as Array<{ output: BundleFile[] }>;
      const files = outputs.flatMap((output) => output.output);
      const script = files.flatMap((file) => (file.type === "chunk" ? [file.code] : [])).join("\n");
      const css = files
        .flatMap((file) =>
          file.type === "asset" && file.fileName.endsWith(".css") ? [String(file.source)] : [],
        )
        .join("\n");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setContent(
          '<html lang="pt-BR"><head></head><body><div id="root"></div></body></html>',
        );
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: script });
        const trigger = page.getByRole("button", { name: /^Ver histórico mensal:/ });
        const dialog = page.getByRole("dialog");
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
          for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            await trigger.focus();
            await page.keyboard.press("Enter");
            await browserExpect(dialog).toBeVisible();
            const close = page.getByRole("button", { name: "Fechar histórico mensal" });
            await browserExpect(close).toBeFocused();
            await page.keyboard.press("Tab");
            expect(
              await dialog.evaluate((element) => element.contains(document.activeElement)),
            ).toBe(true);
            await page.keyboard.press("Shift+Tab");
            await browserExpect(close).toBeFocused();
            expect(
              await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
            ).toBe(true);
            expect(
              await dialog
                .locator("li, figcaption, h2")
                .evaluateAll((nodes) =>
                  nodes.every((element) => element.scrollWidth <= element.clientWidth + 1),
                ),
            ).toBe(true);
            const stats = await sharp(await dialog.screenshot()).stats();
            expect(stats.channels.some((channel) => channel.stdev > 10)).toBe(true);
            await page.keyboard.press("Escape");
            await browserExpect(dialog).not.toBeVisible();
            await browserExpect(trigger).toBeFocused();
          }
        }
        await trigger.click();
        await page.getByRole("button", { name: "Fechar histórico mensal" }).click();
        await browserExpect(trigger).toBeFocused();
        await trigger.click();
        await page.mouse.click(1, 1);
        await browserExpect(dialog).not.toBeVisible();
        await browserExpect(trigger).toBeFocused();
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    180_000,
  );
});
