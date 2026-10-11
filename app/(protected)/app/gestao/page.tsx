import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowRight, CalendarCheck2 } from "lucide-react";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
  managementStyles,
} from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import styles from "../configuracoes/ConfigurationCanvas.module.css";
import routineStyles from "./rotina/RoutineSettings.module.css";

export const metadata = { title: "Gestão" };

export default async function ManagementHubPage() {
  await enforcePermission("crm.settings.manage");
  if (!getProtectedPageGate("/app/gestao")?.releaseEnabled) forbidden();
  const routineReleased = getProtectedPageGate("/app/gestao/rotina")?.releaseEnabled === true;

  return (
    <ManagementPage className={`${styles.canvas ?? ""} ${routineStyles.hub}`}>
      <ManagementPageHeader
        eyebrow="Gestão"
        title="Gestão"
        description="Rotinas comerciais"
        status={
          <ManagementStatusBadge tone={routineReleased ? "positive" : "warning"}>
            {routineReleased ? "Rotina liberada" : "Rotina indisponível"}
          </ManagementStatusBadge>
        }
      />

      <section aria-labelledby="management-areas-title" className="grid gap-3 pt-1">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="management-areas-title" className={managementStyles.sectionTitle}>
              Rotinas do time
            </h2>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Link
            href="/app/gestao/rotina"
            aria-label="Rotina"
            prefetch={false}
            className="group block rounded-lg no-underline focus-visible:outline-offset-4"
          >
            <article
              className={`${styles.settingsCard} ${managementStyles.panel} h-full p-4 group-hover:border-cyan-500 group-focus-visible:border-cyan-500`}
            >
              <div className="flex h-full min-h-36 flex-col">
                <div className="flex items-start gap-3">
                  <span className={managementStyles.iconFrame}>
                    <CalendarCheck2 aria-hidden="true" />
                  </span>
                  <span className="pt-2 text-xs font-bold text-[var(--analytics-cyan-strong)]">
                    Gestão
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-[var(--analytics-ink)]">Rotina</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--analytics-muted)]">
                  Gerente regional house
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
