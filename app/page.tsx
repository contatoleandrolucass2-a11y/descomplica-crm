import { headers } from "next/headers";
import { getDb } from "@/db";
import { collaboratorDashboards } from "@/db/schema";
import { aggregateDashboards } from "./aggregate-dashboard";
import { DashboardClient } from "./DashboardClient";
import { requireChatGPTUser } from "./chatgpt-auth";
import { demoDashboard } from "./demo-data";
import type { DashboardPayload } from "./types";

export const dynamic = "force-dynamic";

async function isLocalPreview() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export default async function Home() {
  const localPreview = await isLocalPreview();
  const user = localPreview
    ? {
        email: "leandro@descomplicapro.com.br",
        displayName: "Leandro Lucas",
        fullName: "Leandro Lucas",
      }
    : await requireChatGPTUser("/");

  let dashboard: DashboardPayload | null = null;
  let dataStatus: "live" | "demo" | "waiting" = "waiting";

  if (localPreview) {
    dashboard = demoDashboard;
    dataStatus = "demo";
  } else {
    try {
      const records = await getDb().select().from(collaboratorDashboards);
      const dashboards = records.map(
        (record) => JSON.parse(record.payloadJson) as DashboardPayload,
      );
      dashboard = aggregateDashboards(dashboards);

      if (dashboard) {
        dataStatus = "live";
      }
    } catch {
      dataStatus = "waiting";
    }
  }

  return (
    <DashboardClient
      dashboard={dashboard}
      dataStatus={dataStatus}
      signedInEmail={user.email}
      signedInName={user.fullName ?? user.displayName}
      isConsolidated={!localPreview}
    />
  );
}
