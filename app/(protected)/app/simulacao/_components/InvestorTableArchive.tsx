import {
  InvestorCalculator,
  InvestorGuideLauncher,
  InvestorInfoHint,
} from "./archive-investor/InvestorCalculator";
import "./archive-investor/investor-archive.css";

const INVESTOR_DESCRIPTION =
  "Modalidade, geralmente, destinada a clientes de alto poder aquisitivo, com parcelamento do valor do imóvel conforme política interna, ainda no período obra.\n\nA principal vantagem deste formato é a não incidência de qualquer forma de correção.\n\nPara vendas na modalidade Tabela Investidor, não é feita análise de crédito.";

export function InvestorTableArchive() {
  return (
    <div className="app-shell simulation-page-shell investor-page-shell investor-standard-table-page">
      <main className="investor-main">
        <section className="goal-page-hero investor-compact-hero">
          <div className="goal-hero-copy">
            <p className="goal-kicker">Simulação comercial</p>
            <div className="investor-hero-title">
              <h1>Simulador Tabela Investidor</h1>
              <InvestorInfoHint
                label="Tabela Investidor"
                title="Tabela Investidor"
                description={INVESTOR_DESCRIPTION}
              />
            </div>
          </div>
          <InvestorGuideLauncher />
        </section>
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
