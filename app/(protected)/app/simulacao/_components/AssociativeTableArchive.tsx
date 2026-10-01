import {
  InvestorCalculator,
  InvestorGuideLauncher,
  InvestorInfoHint,
} from "./archive-investor/InvestorCalculator";
import { ArchiveHeader } from "./archive-investor/ArchiveHeader";
import "./archive-investor/investor-archive.css";

export function AssociativeTableArchive() {
  return (
    <div className="app-shell simulation-page-shell investor-page-shell investor-associative-table-page">
      <ArchiveHeader />
      <main className="investor-main">
        <section className="goal-page-hero investor-compact-hero investor-associative-hero">
          <div className="goal-hero-copy">
            <div className="investor-hero-title">
              <h1>Simulador Tabela Associativo</h1>
              <InvestorInfoHint
                label="Tabela Associativo"
                title="Tabela Associativo"
                description="Fluxo linear com sinais, anuais, mensais pré e pós-obra e parcela corrigida."
              />
            </div>
          </div>
          <InvestorGuideLauncher compact />
        </section>
        <InvestorCalculator directTable={false} directVisualLayout />
        <p className="simulation-disclaimer">
          Resultado preliminar sujeito à política comercial vigente.
        </p>
      </main>
      <footer className="investor-page-footer">
        <p>Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</p>
        <small>Desenvolvido e gerenciado por Leandro Lucas</small>
      </footer>
    </div>
  );
}
