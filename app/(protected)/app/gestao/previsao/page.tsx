import { forbidden } from "next/navigation";

import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { ForecastSettings } from "./ForecastSettings";

export const metadata = { title: "Previsão" };

export default async function ForecastSettingsPage() {
  await enforcePageAccess("/app/gestao/previsao");
  if (!getProtectedPageGate("/app/gestao/previsao")?.releaseEnabled) forbidden();
  return <ForecastSettings />;
}
