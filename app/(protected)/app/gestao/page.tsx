import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowRight, CalendarCheck2, ClipboardList } from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import styles from "../configuracoes/ConfigurationCanvas.module.css";

export const metadata = { title: "Gestão" };

export default async function ManagementHubPage() {
  await enforcePermission("crm.settings.manage");
  if (!getProtectedPageGate("/app/gestao")?.releaseEnabled) forbidden();
  const routineReleased = getProtectedPageGate("/app/gestao/rotina")?.releaseEnabled === true;

  return (
    <ManagementPage className={styles.canvas ?? ""}>
      <ManagementPageHeader
        eyebrow="Gestão"
        title="Gestão comercial"
        description="Acompanhe rotinas operacionais e cadências do time em um só lugar."
        status={
          <ManagementStatusBadge tone={routineReleased ? "positive" : "warning"}>
            {routineReleased ? "Rotina liberada" : "Rotina indisponível"}
          </ManagementStatusBadge>
        }
      />

      <section
        className={`${styles.settingsGovernance} ${managementStyles.panel} ${managementStyles.panelStrong} grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)] md:items-center`}
        aria-labelledby="management-overview-title"
      >
        <div>
          <p className={managementStyles.sectionKicker}>Operação comercial</p>
          <h2
            id="management-overview-title"
            className="mt-1 text-2xl font-semibold text-[var(--analytics-ink)]"
          >
            Rotinas do time
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
            Use este menu para revisar, classificar e ajustar as rotinas por função.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface-muted)] p-4">
          <div className="flex items-start gap-3">
            <span className={managementStyles.iconFrame}>
              <ClipboardList aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.68rem] font-bold tracking-wide text-[var(--analytics-muted)] uppercase">
                Primeiro fluxo
              </p>
              <strong className="mt-1 block text-sm text-[var(--analytics-ink)]">
                Gerente regional house
              </strong>
              <p className="mt-1 text-xs leading-5 text-[var(--analytics-muted)]">
                Demais funções permanecem nulas até receberem rotina própria.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="management-areas-title" className="grid gap-3 pt-1">
        <div className={managementStyles.sectionHeader}>
          <div>
            <p className={managementStyles.sectionKicker}>Submenu</p>
            <h2 id="management-areas-title" className={managementStyles.sectionTitle}>
              Escolha a rotina
            </h2>
            <p className={managementStyles.sectionDescription}>
              A rotina fica editável, com inserção de linhas e salvamento local.
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Link
            href="/app/gestao/rotina"
            aria-label="Rotina"
            prefetch={false}
            className="group block rounded-xl no-underline focus-visible:outline-offset-4"
          >
            <article
              className={`${styles.settingsCard} ${managementStyles.panel} h-full p-4 group-hover:border-cyan-500 group-focus-visible:border-cyan-500`}
            >
              <div className="flex h-full min-h-56 flex-col">
                <div className="flex items-start gap-3">
                  <span className={managementStyles.iconFrame}>
                    <CalendarCheck2 aria-hidden="true" />
                  </span>
                  <span className="pt-2 text-[0.68rem] font-bold tracking-[0.11em] text-[var(--analytics-cyan-strong)] uppercase">
                    Gestão
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--analytics-ink)]">
                  Rotina
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
                  Classifique a rotina semanal por função e ajuste as atividades do time.
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--analytics-line)] pt-4 text-sm">
                  <span className="text-[var(--analytics-muted)]">Rotina comercial</span>
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--analytics-cyan-strong)] text-[var(--analytics-cyan-strong)]"
                    aria-hidden="true"
                  >
                    <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </article>
          </Link>
        </div>
      </section>
    </ManagementPage>
  );
}
