import Link from "next/link";

import {
  InvestorCalculator,
  InvestorGuideLauncher,
  InvestorInfoHint,
} from "./archive-investor/InvestorCalculator";
import { ArchiveHeader } from "./archive-investor/ArchiveHeader";
import "./archive-investor/investor-archive.css";

const DIRECT_TABLE_DESCRIPTION =
  "Modalidade destinada, geralmente, a clientes com renda que comporte parcelas mais altas que o financiamento, e/ou desejam quitar o imóvel em tempo menor, e/ou possuem alguma restrição para financiamento CAIXA, e/ou têm preferência por financiamento em outra instituição financeira.\n\nPara vendas na modalidade Financiamento Direto, é feita a análise de crédito interna.";

export async function DirectTableArchive() {
  return (
    <div className="app-shell simulation-page-shell investor-page-shell investor-direct-table-page">
      <ArchiveHeader />
      <main className="investor-main">
        <section className="goal-page-hero investor-compact-hero">
          <div className="goal-hero-copy">
            <nav className="documentation-breadcrumb" aria-label="Trilha de navegação">
              <Link href="/app/simulacao" prefetch={false}>
                Simulação
              </Link>
              <span aria-hidden="true">/</span>
              <strong>Simulador Tabela Direta</strong>
            </nav>
            <p className="goal-kicker">Simulação comercial</p>
            <div className="investor-hero-title">
              <h1>Simulador Tabela Direta</h1>
              <InvestorInfoHint
                label="Tabela Direta"
                title="Tabela Direta"
                description={DIRECT_TABLE_DESCRIPTION}
              />
            </div>
          </div>
          <InvestorGuideLauncher />
        </section>
        <InvestorCalculator directTable directVisualLayout={false} />
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
