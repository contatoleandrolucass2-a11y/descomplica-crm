import { enforcePageAccess } from "@/lib/authorization/enforce";
import { LeadPlusClient } from "@/app/(protected)/app/leads/_components/LeadPlusClient";

export const metadata = { title: "DESCOMPLICA LEAD" };
export default async function LeadPlusPage() {
  await enforcePageAccess("/app/leads/configuracoes");
  return <LeadPlusClient initialScreen="Ajustes" />;
}
