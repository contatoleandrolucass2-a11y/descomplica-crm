import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { LockKeyhole } from "lucide-react";
import { forbidden, redirect } from "next/navigation";

import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import { getAuthorizedNavigation } from "@/lib/navigation/pages";

import styles from "./MetaAdsDashboardFrame.module.css";
import { MetaAdsSidebar } from "./MetaAdsSidebar";
import { MetaAdsDashboardFrame, type MetaAdsDashboardView } from "./MetaAdsDashboardFrame";

async function readDashboardDocument() {
  return readFile(
    join(process.cwd(), "app", "(protected)", "app", "meta-ads", "dashboard-frame.html"),
    "utf8",
  );
}

export async function MetaAdsPage({ path, view }: { path: string; view: MetaAdsDashboardView }) {
  const authorization = await enforcePageAccess(path);
  if (!getProtectedPageGate(path)?.releaseEnabled) forbidden();
  if (view === "map" && authorization.roleKey !== "master") redirect("/app/meta-ads");

  const pages = (await getAuthorizedNavigation(authorization)).filter(
    (page) => page.path === "/app/meta-ads" || page.parentKey === "crm.meta_ads",
  );

  return (
    <div className={styles.workspace}>
      <MetaAdsSidebar
        pages={pages}
        path={path}
        view={view}
        isMaster={authorization.roleKey === "master"}
      />
      <div className={styles.frameColumn}>
        {view === "map" ? (
          <div className={styles.maintenanceNotice} role="status">
            <LockKeyhole aria-hidden="true" size={20} />
            <div>
              <strong>Mapa temporariamente desabilitado para melhorias</strong>
              <span>
                A visualização permanece disponível para Master. Consulte o desenvolvedor para mais
                informações.
              </span>
            </div>
          </div>
        ) : null}
        <MetaAdsDashboardFrame
          document={await readDashboardDocument()}
          initialView={view}
          storageScope={authorization.userId}
        />
      </div>
    </div>
  );
}
