import { forbidden } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { RoutineSettings } from "./RoutineSettings";

export const metadata = { title: "Rotina" };

export default async function RoutineSettingsPage() {
  await enforcePermission("crm.dashboard.view");
  if (!getProtectedPageGate("/app/gestao/rotina")?.releaseEnabled) forbidden();
  return <RoutineSettings />;
}
