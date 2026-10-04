import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";

import { TabelaoArchive } from "../_components/TabelaoArchive";

export const metadata: Metadata = {
  title: "Simulador Tabelão | Estoque SPC",
  description:
    "Consulte e filtre todas as unidades disponíveis no estoque SPC em uma tabela completa.",
  alternates: { canonical: "/app/simulacao/tabelao" },
};
export const dynamic = "force-dynamic";

export default async function TabelaoPage() {
  await enforcePermission("crm.simulators.view");
  if (!getProtectedPageGate("/app/simulacao/tabelao")?.releaseEnabled) forbidden();
  return <TabelaoArchive />;
}
