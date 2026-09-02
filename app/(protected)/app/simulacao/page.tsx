import Link from "next/link";

import { DataState, PageHeader, SectionHeading } from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { SIMULATOR_LIST } from "@/lib/crm/simulators/catalog";
import {
  getOfficialSimulatorRuntimeConfiguration,
  officialSimulatorExecutionIsEnabled,
} from "@/lib/crm/simulators/official/config";

import styles from "./simulators.module.css";

export const metadata = { title: "Simulação" };
export const dynamic = "force-dynamic";

function CalculatorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="2.75" width="16" height="18.5" rx="3" />
      <path d="M7.5 6.5h9v3h-9zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
    </svg>
  );
}

function SimulatorCardContent({
  simulator,
  releaseEnabled,
}: {
  simulator: (typeof SIMULATOR_LIST)[number];
  releaseEnabled: boolean;
}) {
  return (
    <>
      <span className={styles.hubIcon}>
        <CalculatorIcon />
      </span>
      <span>
        <h2>{simulator.title}</h2>
        <p>{simulator.description}</p>
        <span className={styles.hubCode}>{simulator.code}</span>
        {!releaseEnabled ? <span className={styles.hubBlocked}>Aguardando autorização</span> : null}
      </span>
      <span className={styles.hubArrow} aria-hidden="true">
        {releaseEnabled ? "↗" : "🔒"}
      </span>
    </>
  );
}

export default async function SimulationHubPage() {
  const authorization = await enforcePermission("crm.simulators.view");
  const wf13Enabled = officialSimulatorExecutionIsEnabled(
    getOfficialSimulatorRuntimeConfiguration(),
    "associativo-fluxo-linear",
    authorization,
  );
  const authorizedJourneyCount = SIMULATOR_LIST.filter(
    (simulator) =>
      getProtectedPageGate(`/app/simulacao/${simulator.slug}`)?.releaseEnabled === true,
  ).length;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          eyebrow="Ferramentas comerciais"
          title="Simulação"
          description={
            wf13Enabled
              ? "WF13 disponível em validação Master. Demais motores permanecem bloqueados."
              : "Interfaces completas para preparar propostas. Motores permanecem bloqueados até validação oficial de cada regra."
          }
          meta={
            <div className={styles.headerStatus}>
              <CalculatorIcon />
              <span>
                <small>Ferramentas disponíveis</small>
                <strong>{authorizedJourneyCount} jornada autorizada</strong>
              </span>
            </div>
          }
        />

        {wf13Enabled ? (
          <DataState
            variant="warning"
            compact
            title="WF13 disponível em canário Master"
            description="Simulador Associativo pode ser calculado sem persistência. Demais motores continuam indisponíveis."
          />
        ) : (
          <DataState
            variant="unavailable"
            compact
            title="Cálculos temporariamente indisponíveis"
            description="As jornadas podem ser consultadas. Nenhuma fórmula, resultado ou regra não validada atua no runtime."
          />
        )}

        <section aria-labelledby="simulation-tools-title">
          <SectionHeading
            id="simulation-tools-title"
            kicker="Escolha uma jornada"
            title="Ferramentas comerciais em um só lugar"
            description="Cada tela preserva campos, seções, alertas e painel de resultado sem publicar cálculo não validado."
          />
          <div className={styles.hubGrid}>
            {SIMULATOR_LIST.map((simulator) => {
              const releaseEnabled =
                getProtectedPageGate(`/app/simulacao/${simulator.slug}`)?.releaseEnabled === true;
              return releaseEnabled ? (
                <Link
                  className={styles.hubCard}
                  href={`/app/simulacao/${simulator.slug}`}
                  key={simulator.slug}
                >
                  <SimulatorCardContent simulator={simulator} releaseEnabled />
                </Link>
              ) : (
                <article
                  className={`${styles.hubCard} ${styles.hubCardBlocked}`}
                  data-release-state="blocked"
                  key={simulator.slug}
                >
                  <SimulatorCardContent simulator={simulator} releaseEnabled={false} />
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="simulation-process-title">
          <SectionHeading
            id="simulation-process-title"
            kicker="Fluxo seguro"
            title="Da entrada ao resultado validado"
          />
          <div className={styles.processGrid}>
            <article className={styles.processCard}>
              <span>01</span>
              <strong>Preencha a proposta</strong>
              <small>Campos organizados para conferir as informações da proposta.</small>
            </article>
            <article className={styles.processCard}>
              <span>02</span>
              <strong>Aguarde regra oficial</strong>
              <small>Motores não executam fórmulas importadas ou valores demonstrativos.</small>
            </article>
            <article className={styles.processCard}>
              <span>03</span>
              <strong>Conecte fonte validada</strong>
              <small>
                Resultados só serão liberados em incremento próprio, com contrato e testes.
              </small>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
