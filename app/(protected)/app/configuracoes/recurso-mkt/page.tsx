import { forbidden } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { MarketingResources } from "./MarketingResources";

export const metadata = { title: "Recurso MKT" };

export default async function MarketingResourcesPage() {
  await enforcePermission("crm.settings.manage");
  if (!getProtectedPageGate("/app/configuracoes/recurso-mkt")?.releaseEnabled) forbidden();
  return <MarketingResources />;
}
