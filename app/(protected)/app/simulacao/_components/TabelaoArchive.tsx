import { cookies } from "next/headers";
import Link from "next/link";

import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import { InvestorGuideLauncher, InvestorInfoHint } from "./archive-investor/InvestorCalculator";
import { SiteMenu } from "./archive-investor/SiteMenu";
import "./archive-investor/investor-archive.css";
import { TabelaoClient } from "./TabelaoClient";

export async function TabelaoArchive() {
  const cookieStore = await cookies();
  const consent = parseCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value);

  return (
    <div className="app-shell simulation-page-shell investor-page-shell tabelao-page-shell">
      <header className="topbar simulation-topbar">
        <Link className="brand-lockup brand-link" href="/app" prefetch={false}>
          <div className="brand-mark" aria-hidden="true">
            D
          </div>
          <div>
            <strong>Descomplica</strong>
            <span>Inteligência comercial</span>
          </div>
        </Link>
        <SiteMenu canPersistTheme={consent?.categories.functional === true} />
      </header>
      <main className="investor-main">
        <section className="goal-page-hero investor-compact-hero">
          <div className="goal-hero-copy">
            <nav className="documentation-breadcrumb" aria-label="Trilha de navegação">
              <Link href="/app/simulacao" prefetch={false}>
                Simulação
              </Link>
              <span aria-hidden="true">/</span>
              <strong>Simulador Tabelão</strong>
            </nav>
            <p className="goal-kicker">Simulação comercial</p>
            <div className="investor-hero-title">
              <h1>Simulador Tabelão</h1>
              <InvestorInfoHint
                label="Tabelão"
                title="Tabelão"
                description="Todas as combinações de empreendimento, tipo de planta e metragem, com uma unidade de menor valor por opção. Menor valor = Valor Final Com Kit − (B.A. da Unidade + Folga de Tabela)."
              />
            </div>
          </div>
          <InvestorGuideLauncher />
        </section>
        <TabelaoClient />
        <p className="simulation-disclaimer">
          Consulta de apoio comercial. Confirme disponibilidade, valor e condição da unidade no
          fluxo oficial antes de formalizar a proposta.
        </p>
      </main>
      <footer className="investor-page-footer">
        <p>Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</p>
        <small>Desenvolvido e gerenciado por Leandro Lucas</small>
      </footer>
    </div>
  );
}
