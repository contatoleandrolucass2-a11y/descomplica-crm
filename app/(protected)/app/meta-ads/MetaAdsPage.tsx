import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { forbidden } from "next/navigation";

import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import { MetaAdsDashboardFrame, type MetaAdsDashboardView } from "./MetaAdsDashboardFrame";

async function readDashboardDocument() {
  return readFile(
    join(process.cwd(), "app", "(protected)", "app", "meta-ads", "dashboard-frame.html"),
    "utf8",
  );
}

export async function MetaAdsPage({ path, view }: { path: string; view: MetaAdsDashboardView }) {
  await enforcePageAccess(path);
  if (!getProtectedPageGate(path)?.releaseEnabled) forbidden();

  return <MetaAdsDashboardFrame document={await readDashboardDocument()} initialView={view} />;
}
