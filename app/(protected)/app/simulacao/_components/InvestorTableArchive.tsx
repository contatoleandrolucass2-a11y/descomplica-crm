import { InvestorCalculator } from "./archive-investor/InvestorCalculator";
import { SimulationCanvasHeader } from "./SimulationCanvasHeader";
import "./archive-investor/investor-archive.css";

export function InvestorTableArchive() {
  return (
    <div
      className="app-shell simulation-page-shell investor-page-shell investor-standard-table-page"
      data-canvas-layout="simulator"
    >
      <main className="investor-main">
        <SimulationCanvasHeader
          eyebrow="Simulação · WF15"
          title="Simulador Tabela Investidor"
          description="Seleção de estoque e montagem da proposta para conferência comercial."
          statusLabel="Estoque · fonte identificada"
        />
        <InvestorCalculator />
      </main>
    </div>
  );
}
