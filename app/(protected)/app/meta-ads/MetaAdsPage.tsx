import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
  if (view === "map" || view === "settings") redirect("/app/meta-ads");

  const pages = (await getAuthorizedNavigation(authorization)).filter(
    (page) => page.path === "/app/meta-ads" || page.parentKey === "crm.meta_ads",
  );

  return (
    <div className={styles.workspace}>
      <MetaAdsSidebar pages={pages} path={path} />
      <div className={styles.frameColumn}>
        <MetaAdsDashboardFrame
          document={await readDashboardDocument()}
          initialView={view}
          storageScope={authorization.userId}
        />
      </div>
    </div>
  );
}
