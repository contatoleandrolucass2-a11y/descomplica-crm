import Link from "next/link";

import { InvestorCalculator, InvestorGuideLauncher } from "./archive-investor/InvestorCalculator";
import "./archive-investor/investor-archive.css";

export function AssociativeTableArchive() {
  return (
    <div className="investor-page-shell">
      <main className="investor-main">
        <section className="goal-page-hero investor-compact-hero">
          <div className="goal-hero-copy">
            <nav className="documentation-breadcrumb" aria-label="Trilha de navegação">
              <Link href="/app/simulacao">Simulação</Link>
              <span aria-hidden="true">/</span>
              <strong>Simulador Tabela Associativo</strong>
            </nav>
            <p className="goal-kicker">Simulação comercial</p>
            <div className="investor-hero-title">
              <h1>Simulador Tabela Associativo</h1>
            </div>
          </div>
          <InvestorGuideLauncher />
        </section>
        <InvestorCalculator directTable={false} directVisualLayout />
        <p className="simulation-disclaimer">
          Resultado preliminar sujeito à política comercial vigente.
        </p>
      </main>
    </div>
  );
}
