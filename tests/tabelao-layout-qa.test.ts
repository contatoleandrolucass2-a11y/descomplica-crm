import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const qaHarness = readFileSync(
  new URL("../scripts/qa/tabelao-layout.mjs", import.meta.url),
  "utf8",
);
const layoutCss = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/archive-investor/tabelao-layout.css",
    import.meta.url,
  ),
  "utf8",
);

describe("gate visual do Tabelão", () => {
  it("executa o fixture no shell protegido real sem depender de globals do Node no navegador", () => {
    expect(qaHarness).toContain('define: { "process.env.NODE_ENV": JSON.stringify("production") }');
    expect(qaHarness).toContain("import { ProtectedShellFrame }");
    expect(qaHarness).toContain("data-protected-topbar");
    expect(qaHarness).toContain('url.pathname === "/information-at-mark.png"');
  });

  it("mantém o contrato de impressão dividido em condições estritas e agregado", () => {
    for (const condition of [
      "printApplicationChromeHidden",
      "printControlsHidden",
      "printContentVisible",
      "printRowsExpanded",
      "printTableSemantics",
      "printOverflowVisible",
      "printHeaderTransformsReset",
    ]) {
      expect(qaHarness).toContain(condition);
    }
    expect(qaHarness).toContain("checks.printLayout = Object.values(printLayout).every(Boolean)");
    expect(layoutCss).toContain("@media print");
    expect(layoutCss).toContain("overflow: visible");
    expect(layoutCss).toContain("min-width: 0");
    expect(layoutCss).toContain("transform: none");
  });
});
