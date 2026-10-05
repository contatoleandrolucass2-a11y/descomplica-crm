import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { DataState } from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { SIMULATOR_LIST } from "@/lib/crm/simulators/catalog";
import {
  getOfficialSimulatorRuntimeConfiguration,
  officialSimulatorExecutionIsEnabled,
} from "@/lib/crm/simulators/official/config";

import { SimulationCanvasHeader } from "./_components/SimulationCanvasHeader";
import styles from "./simulators.module.css";

export const metadata = { title: "Simulação" };
export const dynamic = "force-dynamic";

interface HubSimulator {
  slug: string;
  code: string;
  title: string;
  description: string;
}

const TABELAO_HUB_ITEM: HubSimulator = {
  slug: "tabelao",
  code: "CONSULTA",
  title: "Tabelão",
  description: "Consulta unificada de estoque para visão ampliada e análise comercial.",
};

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
  simulator: HubSimulator;
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
        {releaseEnabled ? "↗" : <LockKeyhole size={18} strokeWidth={1.8} />}
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
  const simulatorCards = SIMULATOR_LIST.map((simulator) => ({
    simulator,
    releaseEnabled:
      getProtectedPageGate(`/app/simulacao/${simulator.slug}`)?.releaseEnabled === true,
  }));
  const tabelaoGate = getProtectedPageGate("/app/simulacao/tabelao");
  const tabelaoAuthorized =
    tabelaoGate?.releaseEnabled === true &&
    tabelaoGate.pageKey === "crm.simulation.tabelao" &&
    tabelaoGate.permission === "crm.simulators.view" &&
    authorization.permissions.includes(tabelaoGate.permission);
  const hubCards = tabelaoAuthorized
    ? [...simulatorCards, { simulator: TABELAO_HUB_ITEM, releaseEnabled: true }]
    : simulatorCards;
  const authorizedJourneyCount = hubCards.filter(({ releaseEnabled }) => releaseEnabled).length;
  const authorizedJourneyLabel = `${authorizedJourneyCount} ${
    authorizedJourneyCount === 1 ? "jornada autorizada" : "jornadas autorizadas"
  }`;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <SimulationCanvasHeader
          eyebrow="Ferramentas comerciais"
          title="Hub de Simulação"
          subtitle="Ferramentas comerciais em um só lugar"
          description="Acesse os simuladores para preparar propostas, validar cenários e apoiar a operação com informações das fontes identificadas e regras vigentes."
          statusLabel={authorizedJourneyLabel}
          statusTone={wf13Enabled ? "canary" : "default"}
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
          <h2 id="simulation-tools-title" className={styles.visuallyHidden}>
            Ferramentas comerciais em um só lugar
          </h2>
          <div className={styles.hubGrid}>
            {hubCards.map(({ simulator, releaseEnabled }) => {
              return releaseEnabled ? (
                <Link
                  className={styles.hubCard}
                  href={`/app/simulacao/${simulator.slug}`}
                  prefetch={false}
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
      </div>
    </main>
  );
}
