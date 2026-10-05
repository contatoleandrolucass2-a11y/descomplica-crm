import { InvestorCalculator } from "./archive-investor/InvestorCalculator";
import { SimulationCanvasHeader } from "./SimulationCanvasHeader";
import "./archive-investor/investor-archive.css";

export async function DirectTableArchive() {
  return (
    <div
      className="app-shell simulation-page-shell investor-page-shell investor-direct-table-page"
      data-canvas-layout="simulator"
    >
      <main className="investor-main">
        <SimulationCanvasHeader
          eyebrow="Simulação · WF14"
          title="Simulador Tabela Direta"
          description="Simulação comercial com estoque SPC e fluxo editável."
          statusLabel="Estoque · fonte identificada"
        />
        <InvestorCalculator directTable directVisualLayout={false} />
      </main>
    </div>
  );
}
