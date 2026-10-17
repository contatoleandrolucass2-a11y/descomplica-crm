// Synthetic authenticated reader and UI checks; no remote services.
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QlikRankingV2 } from "@/lib/crm/qlik/contracts-v2";
import type { QlikRankingV2Data } from "@/lib/crm/qlik/data-v2";

const { enforcePermission, loadQlikRankingV2 } = vi.hoisted(() => ({
  enforcePermission: vi.fn(),
  loadQlikRankingV2: vi.fn(),
}));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePermission }));
vi.mock("@/lib/crm/qlik/data-v2", () => ({ loadQlikRankingV2 }));
import RankingPage from "@/app/(protected)/app/canal-de-parcerias/page";
import {
  buildRankingV2Selection,
  formatRankingMoney,
  parseRankingFilters,
  RankingDashboard,
} from "@/app/(protected)/app/canal-de-parcerias/RankingDashboard";
import rankingStyles from "@/app/(protected)/app/canal-de-parcerias/PartnershipsRanking.module.css";
import managementStyles from "@/app/(protected)/_components/ManagementCanvas.module.css";
import analyticsStyles from "@/app/(protected)/app/_components/analytics/analytics.module.css";
import shellStyles from "@/app/(protected)/_components/ProtectedShell.module.css";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
function elements(node: Node): Element[] {
  return [
    ...("tagName" in node ? [node] : []),
    ...("childNodes" in node ? node.childNodes.flatMap(elements) : []),
  ];
}
function attr(node: Element, key: string) {
  return node.attrs.find((item) => item.name === key)?.value;
}
function text(node: Node): string {
  return "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(text).join("")
      : "";
}
function publication(): Extract<QlikRankingV2Data, { status: "ready" }> {
  const cube = {
    coverage: { state: "complete" as const, sourceRows: 12 },
    nativeTotals: { vgv: "780.00", contracts: 12 },
    rows: Array.from({ length: 12 }, (_, i) => ({
      key: `imob-${String(i).padStart(2, "0")}`,
      name: i === 11 ? "Águia Sintética" : `Parceira ${i}`,
      vgv: `${(12 - i) * 10}.00`,
      contracts: 1,
    })),
  };
  const product = {
    coverage: { state: "complete" as const, sourceRows: 1 },
    nativeTotals: { vgv: "50.00", contracts: 2 },
    rows: [{ key: "product-01", name: "Produto Sintético", vgv: "50.00", contracts: 2 }],
  };
  const current: QlikRankingV2 = {
    schemaVersion: 2,
    batchId: "9f37407b-251c-43f3-8370-01b49e37ac40",
    requestId: "e0cfacb3-ea4b-4ca8-9587-a449e7dec1d3",
    startedAt: "2026-10-14T10:00:00Z",
    completedAt: "2026-10-14T10:10:00Z",
    source: {
      appId: "7c000871-8b32-4c0f-bfd5-4b9d46946575",
      sheetId: "46d5bcf7-965d-40fc-a808-2fdde2d0f74d",
      mappingSha256: "a".repeat(64),
      reloadTimestamp: "2026-10-14T09:00:00Z",
    },
    scope: { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" },
    months: ["2026-01-01", "2026-02-01", "2026-03-01"].map((periodMonth) => ({
      periodMonth,
      imobs: structuredClone(cube),
      developments: structuredClone(product),
    })),
  };
  return {
    status: "ready",
    current,
    previous: null,
    publishedAt: "2026-10-14T10:15:00Z",
    availableYears: [2026, 2025],
  };
}
function withHistory() {
  const data = publication();
  data.previous = structuredClone(data.current);
  data.previous.batchId = "bf2b6c33-cad4-4053-864c-a1605a5c3f47";
  data.previous.requestId = "915709b0-ecf2-430d-b5d6-a48e444d0ad7";
  return data;
}
async function rendered(params: Record<string, string | string[] | undefined> = {}) {
  const html = renderToStaticMarkup(await RankingPage({ searchParams: Promise.resolve(params) }));
  return { html, nodes: elements(parseFragment(html)) };
}

function rankingFixtureCss() {
  const require = createRequire(import.meta.url);
  const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
    parse(source: string): {
      walkRules(callback: (rule: { selector: string }) => void): void;
      toString(): string;
    };
  };
  const sheets = [
    ["../app/(protected)/app/canal-de-parcerias/PartnershipsRanking.module.css", rankingStyles],
    ["../app/(protected)/_components/ManagementCanvas.module.css", managementStyles],
    ["../app/(protected)/app/_components/analytics/analytics.module.css", analyticsStyles],
    ["../app/(protected)/_components/ProtectedShell.module.css", shellStyles],
  ] as const;
  const css = sheets
    .map(([file, classes]) => {
      const sheet = parse(readFileSync(new URL(file, import.meta.url), "utf8"));
      sheet.walkRules((rule) => {
        rule.selector = rule.selector
          .replace(/:global\(([^)]+)\)/g, "$1")
          .replace(/\.([a-zA-Z][\w-]*)/g, (_, name: string) => `.${classes[name] ?? name}`);
      });
      return sheet.toString();
    })
    .join("\n");
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(
    /@import[^;]+;/g,
    "",
  );
  const preflight = readFileSync(require.resolve("tailwindcss/preflight.css"), "utf8");
  return `${preflight}\n${globals}\nbody{font-family:Arial,sans-serif}${css}`;
}

describe("ranking v2 route and UI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enforcePermission.mockResolvedValue({});
    loadQlikRankingV2.mockResolvedValue(publication());
  });

  it.runIf(process.env.RANKING_V2_BROWSER === "1")(
    "checks desktop/mobile themes and submits real GET filters without remote requests",
    async () => {
      const { chromium, expect: browserExpect } = await import("@playwright/test");
      const { default: sharp } = await import("sharp");
      const css = rankingFixtureCss();
      const browser = await chromium.launch({ headless: true });
      let theme = "light";
      try {
        const page = await browser.newPage();
        await page.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== "http://ranking.test" || url.pathname !== "/app/canal-de-parcerias")
            return route.abort();
          const { html } = await rendered(Object.fromEntries(url.searchParams));
          await route.fulfill({
            contentType: "text/html",
            // Real shell sizing and reset; navigation is synthetic, with no session or reader.
            body: `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ranking sintético</title><style>${css}</style></head><body><header class="${shellStyles.topbar}"><div class="${shellStyles.topbarInner}">CRM sintético</div></header><nav class="${shellStyles.breadcrumbs}" aria-label="Caminho"><ol><li>CRM</li><li>Ranking</li></ol></nav>${html}</body></html>`,
          });
        });
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          for (theme of ["light", "balanced", "dark"]) {
            await page.goto("http://ranking.test/app/canal-de-parcerias");
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            ).toBe(true);
            const boxes = await page
              .locator("form > label, form > fieldset, form > button")
              .evaluateAll((nodes) =>
                nodes.map((node) => {
                  const r = node.getBoundingClientRect();
                  return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
                }),
              );
            for (let i = 0; i < boxes.length; i++)
              for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i]!;
                const b = boxes[j]!;
                expect(
                  a.right <= b.x + 1 ||
                    b.right <= a.x + 1 ||
                    a.bottom <= b.y + 1 ||
                    b.bottom <= a.y + 1,
                ).toBe(true);
              }
            const pixels = await sharp(await page.screenshot()).stats();
            expect(pixels.channels.some((channel) => channel.stdev > 10)).toBe(true);
          }
        }
        await page.getByRole("searchbox").fill("aguia");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();
        await browserExpect(page.locator("tbody")).toContainText("Águia Sintética");
        await browserExpect(page.locator("tbody tr")).toHaveCount(1);
        await page.getByRole("searchbox").fill("");
        await page.getByLabel("Produtos", { exact: true }).check();
        await page.getByRole("button", { name: "Aplicar filtros" }).click();
        await browserExpect(page.locator("tbody")).toContainText("Produto Sintético");
        await page.getByLabel("Período", { exact: true }).selectOption("custom");
        await page.getByLabel("Mês inicial", { exact: true }).selectOption("01");
        await page.getByLabel("Mês final", { exact: true }).selectOption("02");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();
        await browserExpect(page.locator("tbody")).toContainText("R$ 100,00");
        await page.getByLabel("Ano", { exact: true }).selectOption("2025");
        await page.getByRole("button", { name: "Aplicar filtros" }).click();
        await browserExpect(page).toHaveURL(/year=2025/);
        expect(loadQlikRankingV2).toHaveBeenLastCalledWith(2025);
        loadQlikRankingV2.mockResolvedValue({ status: "unavailable" });
        await page.reload();
        await browserExpect(
          page.getByRole("heading", { name: "Dados indisponíveis" }),
        ).toBeVisible();
        await browserExpect(page.locator("tbody tr")).toHaveCount(0);
        await page.getByRole("button", { name: "Tentar novamente" }).click();
        await browserExpect(
          page.getByRole("heading", { name: "Dados indisponíveis" }),
        ).toBeVisible();
        loadQlikRankingV2.mockResolvedValue({ status: "empty", availableYears: [] });
        for (const kind of ["imobs", "developments"]) {
          await page.goto(`http://ranking.test/app/canal-de-parcerias?period=latest&kind=${kind}`);
          await browserExpect(
            page.getByRole("heading", { name: "Nenhuma publicação disponível", exact: true }),
          ).toBeVisible();
          await browserExpect(
            page.getByRole("heading", {
              name: kind === "imobs" ? "Top 10 imobiliárias" : "Top 10 empreendimentos",
              exact: true,
            }),
          ).toBeVisible();
          await browserExpect(page.getByRole("table")).toHaveCount(1);
          await browserExpect(page.locator("tbody tr")).toHaveCount(0);
          await browserExpect(page.locator("main")).not.toContainText("R$");
          await browserExpect(
            page.getByRole("radio", {
              name: kind === "imobs" ? "Imobiliárias" : "Produtos",
              exact: true,
            }),
          ).toBeChecked();
          await browserExpect(
            page.getByRole("button", { name: "Aplicar filtros", exact: true }),
          ).toBeDisabled();
        }
        for (const status of ["empty", "unavailable"] as const) {
          loadQlikRankingV2.mockResolvedValue(
            status === "empty" ? { status, availableYears: [] } : { status },
          );
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            for (theme of ["light", "balanced", "dark"]) {
              for (const kind of ["imobs", "developments"]) {
                await page.goto(`http://ranking.test/app/canal-de-parcerias?kind=${kind}`);
                const podiumCards = page.locator(
                  "section[aria-labelledby='ranking-podium-title'] article",
                );
                expect(
                  await podiumCards.evaluateAll((cards) =>
                    cards.map((card) => {
                      const style = getComputedStyle(card);
                      return { borderRadius: style.borderRadius, boxShadow: style.boxShadow };
                    }),
                  ),
                ).toEqual(
                  Array.from({ length: 3 }, () => ({ borderRadius: "8px", boxShadow: "none" })),
                );
                const geometry = await page.evaluate(() => {
                  const overlaps: string[] = [];
                  const groups = [
                    "main > div > *",
                    "form > label, form > fieldset, form > button",
                    "section[aria-labelledby='ranking-podium-title'] article",
                  ];
                  for (const selector of groups) {
                    const nodes = [...document.querySelectorAll(selector)];
                    for (let i = 0; i < nodes.length; i++) {
                      for (let j = i + 1; j < nodes.length; j++) {
                        const a = nodes[i]!.getBoundingClientRect();
                        const b = nodes[j]!.getBoundingClientRect();
                        if (
                          a.width &&
                          b.width &&
                          a.height &&
                          b.height &&
                          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
                        )
                          overlaps.push(selector);
                      }
                    }
                  }
                  const clippedText = [
                    ...document.querySelectorAll(
                      "main h1, main h2, main h3, main p, main dt, main dd, main strong, form label",
                    ),
                  ]
                    .filter(
                      (node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1,
                    )
                    .map((node) => node.tagName);
                  return {
                    height: Math.max(
                      document.documentElement.scrollHeight,
                      document.body.scrollHeight,
                    ),
                    width: document.documentElement.scrollWidth,
                    overlaps,
                    clippedText,
                  };
                });
                expect(geometry.width).toBeLessThanOrEqual(width);
                expect(geometry.overlaps).toEqual([]);
                expect(geometry.clippedText).toEqual([]);
                if (width === 1440) expect(geometry.height).toBeLessThanOrEqual(1125);
                await browserExpect(page.locator("main h1")).toBeVisible();
                await browserExpect(page.locator("#ranking-podium-title")).toBeVisible();
                await browserExpect(page.locator("#ranking-table-title")).toBeVisible();
                await browserExpect(page.locator("main dl[aria-label^='Resumo']")).toBeVisible();
                await browserExpect(page.locator("tbody tr")).toHaveCount(0);
                await browserExpect(page.locator("main")).not.toContainText("R$");
                if (process.env.RANKING_LAYOUT_ARTIFACTS === "1") {
                  await page.screenshot({
                    path: `output/playwright/ranking-${status}-${kind}-${theme}-${width}.png`,
                    fullPage: true,
                  });
                  console.log("Ranking layout", { status, kind, theme, ...geometry });
                }
              }
            }
          }
        }
        for (const period of ["month", "week"]) {
          await page.goto(
            `http://ranking.test/app/canal-de-parcerias?period=${period}&scope=managers`,
          );
          await browserExpect(
            page.getByRole("heading", { name: "Filtros inválidos", exact: true }),
          ).toBeVisible();
          await browserExpect(page.locator("main")).not.toContainText("R$");
          await browserExpect(
            page.getByRole("button", { name: "Tentar novamente", exact: true }),
          ).toBeEnabled();
        }
      } finally {
        await browser.close();
      }
    },
    60_000,
  );

  it.runIf(process.env.RANKING_V2_BROWSER === "1")(
    "keeps tablet view labels on one real text line without overflow in both views and all themes",
    async () => {
      const { chromium } = await import("@playwright/test");
      const css = rankingFixtureCss();
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.route("**/*", (route) => route.abort());
        for (const status of ["empty", "unavailable"] as const) {
          loadQlikRankingV2.mockResolvedValue(
            status === "empty" ? { status, availableYears: [] } : { status },
          );
          for (const width of [768, 1024]) {
            await page.setViewportSize({ width, height: 900 });
            for (const theme of ["light", "balanced", "dark"]) {
              for (const kind of ["imobs", "developments"]) {
                const { html } = await rendered({ kind });
                await page.setContent(
                  `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`,
                );
                const measured = await page
                  .locator("form fieldset label > span")
                  .evaluateAll((spans) =>
                    spans.map((span) => {
                      const box = span.getBoundingClientRect();
                      const lines = new Set<number>();
                      let contained = true;
                      // Measure each visible character, not CSS nowrap or element overflow alone.
                      for (const node of span.childNodes) {
                        if (node.nodeType !== Node.TEXT_NODE) continue;
                        const value = node.textContent ?? "";
                        for (let i = 0; i < value.length; i++) {
                          if (!value[i]!.trim()) continue;
                          const range = document.createRange();
                          range.setStart(node, i);
                          range.setEnd(node, i + 1);
                          const rect = range.getBoundingClientRect();
                          lines.add(Math.round(rect.top));
                          contained &&=
                            rect.width > 0 && rect.left >= box.left && rect.right <= box.right + 1;
                        }
                      }
                      return { text: span.textContent?.trim(), lines: lines.size, contained };
                    }),
                  );
                expect(measured, `${status}/${width}/${theme}/${kind}`).toEqual([
                  { text: "Imobiliárias", lines: 1, contained: true },
                  { text: "Produtos", lines: 1, contained: true },
                ]);
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth),
                ).toBeLessThanOrEqual(width);
                const boxes = await page
                  .locator("form > label, form > fieldset, form > button")
                  .evaluateAll((nodes) =>
                    nodes.map((node) => {
                      const { x, y, right, bottom } = node.getBoundingClientRect();
                      return { x, y, right, bottom };
                    }),
                  );
                for (let i = 0; i < boxes.length; i++)
                  for (let j = i + 1; j < boxes.length; j++) {
                    const a = boxes[i]!;
                    const b = boxes[j]!;
                    expect(
                      a.right <= b.x + 1 ||
                        b.right <= a.x + 1 ||
                        a.bottom <= b.y + 1 ||
                        b.bottom <= a.y + 1,
                    ).toBe(true);
                  }
              }
            }
          }
        }
      } finally {
        await browser.close();
      }
    },
    60_000,
  );

  it("keeps ranking.view before all reads and propagates denial", async () => {
    await rendered();
    expect(enforcePermission).toHaveBeenCalledExactlyOnceWith("crm.partnerships.view");
    expect(enforcePermission.mock.invocationCallOrder[0]).toBeLessThan(
      loadQlikRankingV2.mock.invocationCallOrder[0]!,
    );
    loadQlikRankingV2.mockClear();
    enforcePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(RankingPage()).rejects.toThrow("FORBIDDEN");
    expect(loadQlikRankingV2).not.toHaveBeenCalled();
  });

  it("passes only the selected year to the reader, never a broader client scope", async () => {
    await rendered({ year: "2025", scope: "other", channel: "other" });
    expect(loadQlikRankingV2).toHaveBeenCalledExactlyOnceWith(2025);
  });

  it.each([
    { year: "2026x" },
    { year: ["2025", "2026"] },
    { start: "13" },
    { query: "x".repeat(257) },
    { kind: "brokers" },
    { period: "__proto__" },
  ])("rejects invalid filters %j without a read", async (params) => {
    expect((await rendered(params)).html).toContain("Filtros inválidos");
    expect(loadQlikRankingV2).not.toHaveBeenCalled();
  });

  it("renders real totals from all twelve identities, only ten rows, and ordered podium", async () => {
    const { nodes, html } = await rendered();
    const tbody = nodes.find((node) => node.tagName === "tbody")!;
    expect(elements(tbody).filter((node) => node.tagName === "tr")).toHaveLength(10);
    expect(html).toContain("R$ 780,00");
    expect(html).toContain("Imobiliárias representadas");
    expect(html).not.toContain("com produção");
    expect(
      nodes.filter((node) => node.tagName === "article").map((node) => attr(node, "aria-label")),
    ).toEqual(["Prata: Parceira 1", "Ouro: Parceira 0", "Bronze: Parceira 2"]);
    expect(
      nodes.filter((node) => node.tagName === "time").map((node) => attr(node, "datetime")),
    ).toEqual(["2026-10-14T09:00:00Z", "2026-10-14T10:10:00Z", "2026-10-14T10:15:00Z"]);
  });

  it("searches accents beyond the top ten without changing rank, podium or totals", async () => {
    const { nodes, html } = await rendered({ query: "aguia" });
    const tbody = nodes.find((node) => node.tagName === "tbody")!;
    expect(text(tbody)).toContain("12Não comparávelÁguia Sintética");
    expect(html).toContain("R$ 780,00");
    expect(html).toContain("Ouro: Parceira 0");
  });

  it("switches to products with its own native totals, without forcing dimension equality", async () => {
    const { html } = await rendered({ kind: "developments" });
    expect(html).toContain("Produto Sintético");
    expect(html).toContain("R$ 50,00");
    expect(html).not.toContain("Parceira 0");
    expect(html).not.toContain("R$ 780,00");
  });

  it("has native GET controls, bounded year options and no mutable scope controls", async () => {
    const { nodes } = await rendered();
    const form = nodes.find((node) => node.tagName === "form")!;
    expect(attr(form, "action")).toBe("/app/canal-de-parcerias");
    expect(attr(form, "method")).toBe("get");
    expect(
      nodes.filter((node) => node.tagName === "select").map((node) => attr(node, "name")),
    ).toEqual(["year", "period", "start", "end"]);
    expect(
      nodes.filter((node) => attr(node, "type") === "radio").map((node) => attr(node, "value")),
    ).toEqual(["imobs", "developments"]);
    const years = nodes.find((node) => attr(node, "name") === "year")!;
    expect(
      elements(years)
        .filter((node) => node.tagName === "option")
        .map(text),
    ).toEqual(["2026", "2025"]);
  });

  it.each(["unavailable", "empty"] as const)(
    "does not invent numbers for %s publications",
    async (status) => {
      loadQlikRankingV2.mockResolvedValue(
        status === "empty" ? { status, availableYears: [] } : { status },
      );
      const { html, nodes } = await rendered();
      expect(html).not.toContain("R$");
      expect(html).toContain(
        status === "empty" ? "Nenhuma publicação disponível" : "Dados indisponíveis",
      );
      expect(nodes.filter((node) => node.tagName === "time")).toHaveLength(0);
      expect(
        nodes
          .filter((node) => node.tagName === "dd")
          .every((node) => text(node) === "Indisponível"),
      ).toBe(true);
    },
  );

  it("reports valid empty cubes as empty with legitimate zero totals", async () => {
    const data = publication();
    for (const month of data.current.months) {
      month.imobs.rows = [];
      month.imobs.coverage.sourceRows = 0;
      month.imobs.nativeTotals = { vgv: "0.00", contracts: 0 };
    }
    loadQlikRankingV2.mockResolvedValue(data);
    const { html } = await rendered();
    expect(html).toContain("Nenhum registro no período");
    expect(html).toContain("R$ 0,00");
    expect(html).not.toContain("Ouro: Parceira");
  });

  it("distinguishes no search results from an empty source", async () => {
    const { html } = await rendered({ query: "not found" });
    expect(html).toContain("Nenhum resultado para a busca");
    expect(html).toContain("R$ 780,00");
  });

  it("keeps malformed and missing coverage unavailable, not zero", async () => {
    const data = publication();
    data.current.months.splice(1, 1);
    loadQlikRankingV2.mockResolvedValue(data);
    const { html } = await rendered({ period: "year" });
    expect(html).toContain("Período sem cobertura completa");
    expect(html).not.toContain("R$");
  });

  it.each([
    ["2026-10-14T11:59:59.999Z", false],
    ["2026-10-14T12:00:00.000Z", true],
    ["2026-10-14T12:00:00.001Z", true],
  ])(
    "uses the source reload clock and an inclusive three-hour stale threshold at %s",
    (now, stale) => {
      const data = publication();
      data.publishedAt = "2026-10-14T11:59:00Z";
      data.current.completedAt = "2026-10-14T11:58:00Z";
      const html = renderToStaticMarkup(
        <RankingDashboard data={data} filters={parseRankingFilters({})} now={new Date(now)} />,
      );
      const nodes = elements(parseFragment(html));
      const badge = nodes.find((node) => attr(node, "data-tone") !== undefined)!;
      expect(attr(badge, "data-tone")).toBe(stale ? "warning" : "positive");
      expect(text(badge)).toBe(stale ? "Fonte desatualizada" : "Publicação Qlik disponível");
      expect(nodes.some((node) => attr(node, "data-variant") === "stale")).toBe(stale);
      expect(html.includes("pelo menos 3 horas")).toBe(stale);
      expect(html).toContain("R$ 780,00");
      expect(html).toContain("Ouro: Parceira 0");
      expect(html).not.toContain("Conectado");
      const body = nodes.find((node) => node.tagName === "tbody")!;
      expect(elements(body).filter((node) => node.tagName === "tr")).toHaveLength(10);
    },
  );

  it("keeps January previous unavailable without zeros or a read of the previous year", async () => {
    const data = publication();
    data.current.months = [data.current.months[0]!];
    loadQlikRankingV2.mockResolvedValue(data);
    const { html, nodes } = await rendered({ year: "2026", period: "previous" });
    expect(loadQlikRankingV2).toHaveBeenCalledExactlyOnceWith(2026);
    expect(html).toContain("Período sem cobertura completa");
    expect(html).not.toContain("R$");
    const body = nodes.find((node) => node.tagName === "tbody")!;
    expect(elements(body).filter((node) => node.tagName === "tr")).toHaveLength(0);
    const summary = nodes.find((node) => attr(node, "aria-label") === "Resumo de imobiliárias")!;
    expect(
      elements(summary)
        .filter((node) => node.tagName === "dd")
        .map(text),
    ).toEqual(["Indisponível", "Indisponível", "Indisponível"]);
  });
});

describe("ranking v2 selections", () => {
  it.each([
    [{}, "2026-03-01", "2026-03-01", 78000n],
    [{ period: "previous" }, "2026-02-01", "2026-02-01", 78000n],
    [{ period: "custom", start: "01", end: "02" }, "2026-01-01", "2026-02-01", 156000n],
    [{ period: "q1" }, "2026-01-01", "2026-03-01", 234000n],
  ] as const)("selects %j exactly", (params, startMonth, endMonth, cents) => {
    const result = buildRankingV2Selection(publication(), parseRankingFilters(params)!);
    expect(result).toMatchObject({
      startMonth,
      endMonth,
      view: { status: "ready", totals: { vgvCents: cents, entities: 12 } },
    });
  });

  it.each([
    { period: "q2" },
    { period: "custom", start: "03", end: "01" },
    { period: "custom" },
    { period: "q4" },
  ])("fails closed for uncovered selection %j", (params) => {
    expect(buildRankingV2Selection(publication(), parseRankingFilters(params)!).view.status).toBe(
      "unavailable",
    );
  });

  it("does not cross years or skip a missing intermediate month", () => {
    const data = publication();
    data.current.months = [data.current.months[0]!];
    expect(
      buildRankingV2Selection(data, parseRankingFilters({ period: "previous" })!).view.status,
    ).toBe("unavailable");
    data.current.months.push(publication().current.months[2]!);
    expect(buildRankingV2Selection(data, parseRankingFilters({ period: "q1" })!).view.status).toBe(
      "unavailable",
    );
  });

  it.each([10, 12])(
    "aggregates January through the last available month %s, not future months",
    async (lastMonth) => {
      const data = publication();
      const month = data.current.months[0]!;
      data.current.months = Array.from({ length: lastMonth }, (_, index) => ({
        ...structuredClone(month),
        periodMonth: `2026-${String(index + 1).padStart(2, "0")}-01`,
      }));
      const result = buildRankingV2Selection(data, parseRankingFilters({ period: "year" })!);
      expect(result).toMatchObject({
        startMonth: "2026-01-01",
        endMonth: `2026-${lastMonth}-01`,
        view: {
          status: "ready",
          totals: {
            vgvCents: 78000n * BigInt(lastMonth),
            contracts: 12n * BigInt(lastMonth),
            entities: 12,
          },
        },
      });
      loadQlikRankingV2.mockResolvedValue(data);
      const { html } = await rendered({ period: "year" });
      expect(html).toContain("Ano até a última competência");
      expect(html).toContain(`01/2026 a ${lastMonth}/2026`);
      expect(html).not.toContain("Período sem cobertura completa");
    },
  );

  it("rejects year-to-date with missing August and a future quarter without inventing zeros", async () => {
    const data = publication();
    const month = data.current.months[0]!;
    data.current.months = Array.from({ length: 10 }, (_, index) => ({
      ...structuredClone(month),
      periodMonth: `2026-${String(index + 1).padStart(2, "0")}-01`,
    })).filter((item) => item.periodMonth !== "2026-08-01");
    expect(
      buildRankingV2Selection(data, parseRankingFilters({ period: "year" })!).view.status,
    ).toBe("unavailable");
    expect(buildRankingV2Selection(data, parseRankingFilters({ period: "q4" })!).view.status).toBe(
      "unavailable",
    );
    loadQlikRankingV2.mockResolvedValue(data);
    const { html } = await rendered({ period: "year" });
    expect(html).toContain("01/2026 a 10/2026");
    expect(html).toContain("Período sem cobertura completa");
    expect(html).not.toContain("R$");
  });

  it("uses exact cents above Number.MAX_SAFE_INTEGER", () => {
    expect(formatRankingMoney(900719925474099303n)).toBe("R$ 9.007.199.254.740.993,03");
  });

  it("compares positions below the former top ten, including renamed identities", () => {
    const data = withHistory();
    const row = data.current.months[2]!.imobs.rows[11]!;
    row.vgv = "1000.00";
    row.name = "Renamed";
    const result = buildRankingV2Selection(data, parseRankingFilters({})!);
    expect(result.movement.get(row.key)).toEqual({ state: "compared", delta: 11 });
    expect(result.movement.get("imob-00")).toEqual({ state: "compared", delta: -1 });
  });

  it("marks stable and new identities only with comparable coverage", () => {
    const data = withHistory();
    expect(buildRankingV2Selection(data, parseRankingFilters({})!).movement.get("imob-00")).toEqual(
      { state: "compared", delta: 0 },
    );
    data.current.months[2]!.imobs.rows[0]!.key = "new-key";
    expect(buildRankingV2Selection(data, parseRankingFilters({})!).movement.get("new-key")).toEqual(
      { state: "new" },
    );
  });

  it.each(["mapping", "coverage", "batch", "year"])(
    "suppresses movement for incompatible %s",
    (reason) => {
      const data = withHistory();
      if (reason === "mapping") data.previous!.source.mappingSha256 = "b".repeat(64);
      if (reason === "coverage") data.previous!.months.pop();
      if (reason === "batch") data.previous!.batchId = data.current.batchId;
      if (reason === "year")
        for (const month of data.previous!.months)
          month.periodMonth = month.periodMonth.replace("2026", "2025");
      const result = buildRankingV2Selection(data, parseRankingFilters({})!);
      expect(result.view.status).toBe("ready");
      expect(result.movement.size).toBe(0);
    },
  );

  it("fails closed for conflicting entity names across selected months", () => {
    const data = publication();
    data.current.months[0]!.imobs.rows[0]!.name = "Conflict";
    expect(buildRankingV2Selection(data, parseRankingFilters({ period: "q1" })!).view.status).toBe(
      "unavailable",
    );
  });
});
