import { forbidden } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import { RepasseLookup } from "./RepasseLookup";

export const metadata = { title: "Consulta de repasse" };

export default async function RepassePage() {
  await enforcePermission("crm.partnerships.view");
  if (!getProtectedPageGate("/app/repasse")?.releaseEnabled) forbidden();
  return <RepasseLookup />;
}
