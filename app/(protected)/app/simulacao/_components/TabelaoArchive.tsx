import { InvestorGuideLauncher, InvestorInfoHint } from "./archive-investor/InvestorCalculator";
import { SimulationCanvasHeader } from "./SimulationCanvasHeader";
import "./archive-investor/investor-archive.css";
import "./archive-investor/tabelao-layout.css";
import { TabelaoClient } from "./TabelaoClient";
import { TabelaoResources } from "./TabelaoResources";

export async function TabelaoArchive() {
  return (
    <div
      className="app-shell simulation-page-shell investor-page-shell tabelao-page-shell"
      data-canvas-layout="simulator"
    >
      <main className="investor-main">
        <SimulationCanvasHeader
          eyebrow="Simulação · Consulta"
          title="Simulador Tabelão"
          description="Simulação comercial de estoques com menor valor por tipologia."
          statusLabel="Estoque · fonte identificada"
          titleAccessory={
            <InvestorInfoHint
              label="Tabelão"
              title="Tabelão"
              description="Todas as combinações de planta e quantidade de vagas de cada empreendimento, com uma unidade de menor valor por combinação, independentemente da metragem. Menor valor = Valor Final Com Kit − (B.A. da Unidade + Folga de Tabela)."
            />
          }
          actions={<InvestorGuideLauncher compact />}
        />
        <TabelaoClient />
        <TabelaoResources />
        <div className="investor-page-closing">
          <p className="simulation-disclaimer">
            Consulta de apoio comercial. Confirme disponibilidade, valor e condição da unidade no
            fluxo oficial antes de formalizar a proposta.
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
