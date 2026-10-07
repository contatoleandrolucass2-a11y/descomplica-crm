import { forbidden } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import { RepasseLookup } from "./RepasseLookup";

export const metadata = { title: "Consulta de repasse" };

export default async function RepassePage() {
  const context = await enforcePermission("crm.partnerships.view");
  const gate = getProtectedPageGate("/app/repasse");
  if (!gate?.releaseEnabled || gate.requiredRole !== "master" || context.roleKey !== "master") {
    forbidden();
  }
  return <RepasseLookup />;
}
