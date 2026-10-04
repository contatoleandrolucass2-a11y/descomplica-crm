import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
  it("remove os rotulos duplicados e preserva o titulo acessivel", () => {
    expect(archive).toContain("<SimulationCanvasHeader");
    expect(archive).toContain('title="Simulador Tabela Associativo"');
    expect(archive).toContain('data-canvas-layout="simulator"');
    expect(archive).not.toContain('className="documentation-breadcrumb"');
    expect(archive).not.toContain('className="goal-kicker"');
    expect(archive).not.toContain("Simulação comercial");
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
      /\.investor-page-shell\[data-canvas-layout="simulator"\] \.simulation-canvas-header\s*\{[\s\S]*?padding-bottom:\s*14px;/u,
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
