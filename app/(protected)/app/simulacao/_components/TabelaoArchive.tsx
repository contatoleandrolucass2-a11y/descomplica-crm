import { InvestorGuideLauncher, InvestorInfoHint } from "./archive-investor/InvestorCalculator";
import { ArchiveHeader } from "./archive-investor/ArchiveHeader";
import "./archive-investor/investor-archive.css";
import "./archive-investor/tabelao-layout.css";
import { TabelaoClient } from "./TabelaoClient";
import { TabelaoResources } from "./TabelaoResources";

export async function TabelaoArchive() {
  return (
    <div className="app-shell simulation-page-shell investor-page-shell tabelao-page-shell">
      <ArchiveHeader />
      <main className="investor-main">
        <section className="goal-page-hero investor-compact-hero">
          <div className="goal-hero-copy">
            <div className="investor-hero-title">
              <h1>Simulador Tabelão</h1>
              <InvestorInfoHint
                label="Tabelão"
                title="Tabelão"
                description="Todas as combinações de planta e quantidade de vagas de cada empreendimento, com uma unidade de menor valor por combinação, independentemente da metragem. Menor valor = Valor Final Com Kit − (B.A. da Unidade + Folga de Tabela)."
              />
            </div>
          </div>
          <InvestorGuideLauncher compact />
        </section>
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
