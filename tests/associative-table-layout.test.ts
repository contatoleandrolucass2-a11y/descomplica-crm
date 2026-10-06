import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SimulationCanvasHeader } from "@/app/(protected)/app/simulacao/_components/SimulationCanvasHeader";

const { checkAssociativeCanvasHeading } = createRequire(import.meta.url)(
  "../scripts/qa/associative-compact-layout.mjs",
);

const archive = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/AssociativeTableArchive.tsx",
    import.meta.url,
  ),
  "utf8",
);

const styles = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
    import.meta.url,
  ),
  "utf8",
);

describe("cabecalho do simulador Associativo", () => {
  it.runIf(process.env.ASSOCIATIVE_EFFECTS_BROWSER === "1")(
    "accepts the real title-only header and rejects every removed label",
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        for (const width of [375, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          const header = renderToStaticMarkup(
            createElement(SimulationCanvasHeader, { title: "Simulador Tabela Associativo" }),
          );
          await page.setContent(
            `<style>body{margin:0}h1{margin:0}[data-protected-topbar]{height:58px}.investor-main{padding:10px}</style><header data-protected-topbar></header><main data-protected-main-content><div class="investor-main">${header}</div></main>`,
          );
          expect((await checkAssociativeCanvasHeading(page)).removedCopyAbsent).toBe(true);
          for (const className of [
            "simulation-canvas-eyebrow",
            "simulation-canvas-description",
            "simulation-canvas-status",
            "simulation-canvas-header-aside",
          ]) {
            await page.locator(".simulation-canvas-header").evaluate((element, value) => {
              const obsolete = document.createElement("div");
              obsolete.className = value;
              element.append(obsolete);
            }, className);
            await expect(checkAssociativeCanvasHeading(page)).rejects.toThrow();
            await page.locator(`.${className}`).evaluate((element) => element.remove());
          }
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
  );

  it("omits optional copy without empty labels and preserves other simulators", () => {
    const compact = renderToStaticMarkup(
      createElement(SimulationCanvasHeader, { title: "Associativo" }),
    );
    expect(compact).toContain("<h1>Associativo</h1>");
    expect(compact).not.toMatch(/simulation-canvas-(eyebrow|description|status)/);
    expect(compact).not.toContain('role="status"');
    expect(compact).not.toContain("simulation-canvas-header-aside");
    const complete = renderToStaticMarkup(
      createElement(SimulationCanvasHeader, {
        title: "Outra tabela",
        eyebrow: "Simulação",
        description: "Descrição",
        statusLabel: "Estoque",
      }),
    );
    expect(complete).toContain("Simulação");
    expect(complete).toContain("Descrição");
    expect(complete).toContain('role="status"');
    expect(complete).toContain("simulation-canvas-header-aside");
    const actionable = renderToStaticMarkup(
      createElement(SimulationCanvasHeader, {
        title: "Outra tabela",
        actions: createElement("button", null, "Abrir"),
      }),
    );
    expect(actionable).toContain("simulation-canvas-actions");
    expect(actionable).toContain("Abrir");
  });
  it("remove os rotulos duplicados e preserva o titulo acessivel", () => {
    expect(archive).toContain("<SimulationCanvasHeader");
    expect(archive).toContain('title="Simulador Tabela Associativo"');
    expect(archive).toContain('data-canvas-layout="simulator"');
    expect(archive).not.toContain('className="documentation-breadcrumb"');
    expect(archive).not.toContain('className="goal-kicker"');
    expect(archive).not.toContain("Simulação comercial");
    expect(archive).not.toContain("eyebrow=");
    expect(archive).not.toContain("statusLabel=");
    expect(archive).not.toContain("Consulta de estoque e composição");
  });

  it("compacta somente o espaco do cabecalho Associativo", () => {
    const canvasStyles = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(canvasStyles).toContain(".simulation-canvas-header");
    expect(canvasStyles).toContain(
      '.investor-page-shell[data-canvas-layout="simulator"] .investor-main',
    );
    expect(canvasStyles).toMatch(
      /\.investor-page-shell\[data-canvas-layout="simulator"\] \.simulation-canvas-header\s*\{[\s\S]*?padding-bottom:\s*10px;/u,
    );
    expect(canvasStyles).toMatch(
      /\.simulation-canvas-title-row h1\s*\{[\s\S]*?font-size:\s*clamp\(1\.85rem, 3vw, 2\.8rem\)/u,
    );
    expect(canvasStyles).toMatch(
      /\.simulation-canvas-actions[\s\S]*?\.investor-guided-start\s*\{[\s\S]*?min-height:\s*44px\s*!important/u,
    );
  });

  it("mantem aviso e rodape na mesma faixa responsiva", () => {
    expect(archive).toContain('className="investor-page-closing"');
    expect(archive).toMatch(
      /investor-page-closing[\s\S]*simulation-disclaimer[\s\S]*investor-page-footer/u,
    );
    expect(styles).toMatch(
      /\.investor-page-closing\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;[\s\S]*?align-items:\s*start;/u,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*?\.investor-page-closing\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/u,
    );
  });
});
