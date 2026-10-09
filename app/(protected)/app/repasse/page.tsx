import { forbidden } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate, pageGateAllowsRole } from "@/lib/authorization/page-gates";
import type { RepasseOverviewState } from "@/lib/crm/repasse/contracts";
import { listRepasseOverview } from "@/lib/crm/repasse/data";

import { RepasseWorkspace } from "./RepasseWorkspace";

export const metadata = { title: "Visão geral de repasses" };

export default async function RepassePage() {
  const context = await enforcePermission("crm.partnerships.view");
  const gate = getProtectedPageGate("/app/repasse");
  if (
    !gate?.releaseEnabled ||
    gate.allowedRoles?.length !== 2 ||
    !gate.allowedRoles.includes("master") ||
    !gate.allowedRoles.includes("admin") ||
    !pageGateAllowsRole(gate, context.roleKey)
  ) {
    forbidden();
  }

  let overviewState: RepasseOverviewState;
  try {
    overviewState = { status: "ready", overview: await listRepasseOverview() };
  } catch {
    overviewState = {
      status: "unavailable",
      message:
        "A visão geral está temporariamente indisponível. A consulta individual por FID continua disponível.",
    };
  }

  return <RepasseWorkspace overviewState={overviewState} />;
}
