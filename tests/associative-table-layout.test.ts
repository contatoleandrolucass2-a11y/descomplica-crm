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
    expect(archive).toContain("investor-associative-hero");
    expect(archive).toContain("<h1>Simulador Tabela Associativo</h1>");
    expect(archive).not.toContain('className="documentation-breadcrumb"');
    expect(archive).not.toContain('className="goal-kicker"');
    expect(archive).not.toContain("Simulação comercial");
  });

  it("compacta somente o espaco do cabecalho Associativo", () => {
    expect(styles).toContain(
      ".investor-page-shell.investor-associative-table-page .investor-associative-hero",
    );
    expect(styles).toMatch(/\.investor-associative-hero\s*\{[\s\S]*?padding-top:\s*0;/u);
    expect(styles).toMatch(/\.investor-associative-hero\s*\{[\s\S]*?padding-bottom:\s*16px;/u);
  });
});
