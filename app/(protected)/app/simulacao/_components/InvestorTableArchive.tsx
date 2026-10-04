import {
  InvestorCalculator,
  InvestorGuideLauncher,
  InvestorInfoHint,
} from "./archive-investor/InvestorCalculator";
import { SimulationCanvasHeader } from "./SimulationCanvasHeader";
import "./archive-investor/investor-archive.css";

const INVESTOR_DESCRIPTION =
  "Modalidade, geralmente, destinada a clientes de alto poder aquisitivo, com parcelamento do valor do imóvel conforme política interna, ainda no período obra.\n\nA principal vantagem deste formato é a não incidência de qualquer forma de correção.\n\nPara vendas na modalidade Tabela Investidor, não é feita análise de crédito.";

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
          titleAccessory={
            <InvestorInfoHint
              label="Tabela Investidor"
              title="Tabela Investidor"
              description={INVESTOR_DESCRIPTION}
            />
          }
          actions={<InvestorGuideLauncher />}
        />
        <InvestorCalculator />
        <p className="simulation-disclaimer">
          Simulação de apoio comercial. Confirme dados da unidade e resultado no fluxo oficial antes
          de formalizar a proposta.
        </p>
      </main>
      <footer className="investor-page-footer">
        <p>Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</p>
        <small>Desenvolvido e gerenciado por Leandro Lucas</small>
      </footer>
    </div>
  );
}
