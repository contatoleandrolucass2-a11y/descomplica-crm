import { forbidden } from "next/navigation";

import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { MarketingResources } from "./MarketingResources";

export const metadata = { title: "Recurso MKT" };

export default async function MarketingResourcesPage() {
  await enforcePageAccess("/app/configuracoes/recurso-mkt");
  if (!getProtectedPageGate("/app/configuracoes/recurso-mkt")?.releaseEnabled) forbidden();
  return <MarketingResources />;
}
