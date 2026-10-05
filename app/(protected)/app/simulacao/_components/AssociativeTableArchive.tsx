import {
  InvestorCalculator,
  InvestorGuideLauncher,
  InvestorInfoHint,
} from "./archive-investor/InvestorCalculator";
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
          title="Simulador Tabela Associativo"
          titleAccessory={
            <InvestorInfoHint
              label="Tabela Associativo"
              title="Tabela Associativo"
              description="Compare duas formas de pagar à construtora: parcelas iguais ou que diminuem por etapa. Informe entrada, sinais e anuais. Os valores incluem os reajustes da simulação e precisam de confirmação antes da compra."
            />
          }
          actions={<InvestorGuideLauncher compact />}
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
