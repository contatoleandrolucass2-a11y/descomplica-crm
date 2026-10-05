import { InvestorCalculator } from "./archive-investor/InvestorCalculator";
import { SimulationCanvasHeader } from "./SimulationCanvasHeader";
import "./archive-investor/investor-archive.css";

export function AssociativeTableArchive() {
  return (
    <div
      className="app-shell simulation-page-shell investor-page-shell investor-associative-table-page"
      data-canvas-layout="simulator"
    >
      <main className="investor-main">
        <SimulationCanvasHeader
          eyebrow="Simulação · WF13"
          title="Simulador Tabela Associativo"
          description="Consulta de estoque e composição do fluxo linear para apoio à proposta."
          statusLabel="Estoque · fonte identificada"
        />
        <InvestorCalculator directTable={false} directVisualLayout />
        <div className="investor-page-closing">
          <p className="simulation-disclaimer">
            Resultado preliminar sujeito à política comercial vigente.
          </p>
          <footer className="investor-page-footer">
            <p>Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</p>
            <small>Desenvolvido e gerenciado por Leandro Lucas</small>
          </footer>
        </div>
      </main>
    </div>
  );
}
