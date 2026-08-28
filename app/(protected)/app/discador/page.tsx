import Link from "next/link";
import { forbidden } from "next/navigation";

import {
  AnalyticsCard,
  DataState,
  PageHeader,
  SectionHeading,
} from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate, protectedPageGateIsReleased } from "@/lib/authorization/page-gates";

import styles from "./discador.module.css";

export const metadata = { title: "Discador" };
export const dynamic = "force-dynamic";

export default async function DialerPage() {
  const authorization = await enforcePermission("crm.dialer.view");
  const pageGate = getProtectedPageGate("/app/discador");
  if (authorization.roleKey !== "master" || !pageGate || !protectedPageGateIsReleased(pageGate)) {
    forbidden();
  }

  const forecastGate = getProtectedPageGate("/app/discador/previsao-final-de-semana");
  const forecastEnabled = forecastGate ? protectedPageGateIsReleased(forecastGate) : false;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          eyebrow="Descomplica Voz"
          title="Discador"
          description="Fundação visual e contratos seguros para a futura operação de atendimento."
        />
        <DataState
          variant="warning"
          compact
          title="Página em desenvolvimento"
          description="Campanhas, agentes, chamadas, telefonia e integrações externas permanecem desligados."
        />
        <section aria-labelledby="dialer-modules-title">
          <SectionHeading
            id="dialer-modules-title"
            kicker="Operação protegida"
            title="Módulos preparados"
            description="Nenhuma senha de telefonia é solicitada ou armazenada pelo CRM."
          />
          <div className={styles.cardGrid}>
            <AnalyticsCard tone="navy">
              <div className={styles.cardContent}>
                <span className={styles.badge}>DV</span>
                <div>
                  <h2>Operação de voz</h2>
                  <p>Contrato futuro para campanhas e agentes autenticados.</p>
                </div>
                <span className={styles.blocked}>Integração desligada</span>
              </div>
            </AnalyticsCard>
            <AnalyticsCard>
              <div className={styles.cardContent}>
                <span className={styles.badge}>FS</span>
                <div>
                  <h2>Previsão Final de Semana</h2>
                  <p>Estrutura de visitas, vendas, totais e estados sem gravação operacional.</p>
                </div>
                {forecastEnabled ? (
                  <Link href="/app/discador/previsao-final-de-semana" className={styles.link}>
                    Abrir previsão
                  </Link>
                ) : (
                  <span className={styles.blocked}>Aguardando canário</span>
                )}
              </div>
            </AnalyticsCard>
          </div>
        </section>
      </div>
    </main>
  );
}
