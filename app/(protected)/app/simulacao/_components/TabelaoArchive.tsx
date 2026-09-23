import { cookies } from "next/headers";
import Link from "next/link";

import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsent } from "@/lib/privacy/cookie-consent";

import { SiteMenu } from "./archive-investor/SiteMenu";
import "./archive-investor/investor-archive.css";
import { TabelaoClient } from "./TabelaoClient";

export async function TabelaoArchive() {
  const cookieStore = await cookies();
  const consent = parseCookieConsent(cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value);

  return (
    <div className="app-shell tabelao-page-shell">
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
      <main className="tabelao-main">
        <section className="tabelao-hero">
          <div>
            <nav className="documentation-breadcrumb" aria-label="Trilha de navegação">
              <Link href="/app/simulacao" prefetch={false}>
                Simulação
              </Link>
              <span aria-hidden="true">/</span>
              <strong>Tabelão</strong>
            </nav>
            <p className="goal-kicker">Estoque comercial</p>
            <h1>Tabelão</h1>
            <p>Consulte cada unidade disponível no estoque SPC em uma única tabela.</p>
          </div>
          <aside className="tabelao-hero-note" aria-label="Como usar o Tabelão">
            <span>Consulta completa</span>
            <strong>Uma linha para cada unidade do estoque.</strong>
            <p>Compare incorporadora, produto, metragem, entrega, planta e valor do imóvel.</p>
          </aside>
        </section>
        <TabelaoClient />
        <p className="simulation-disclaimer">
          Consulta de apoio comercial. Confirme disponibilidade, valor e condição da unidade no
          fluxo oficial antes de formalizar a proposta.
        </p>
      </main>
    </div>
  );
}
