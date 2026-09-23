import type { Metadata } from "next";

import { enforcePermission } from "@/lib/authorization/enforce";

import { TabelaoArchive } from "../_components/TabelaoArchive";

export const metadata: Metadata = {
  title: "Tabelão | Estoque SPC",
  description:
    "Consulte cada empreendimento e planta uma única vez, sempre com o menor valor disponível no estoque SPC.",
  alternates: { canonical: "/app/simulacao/tabelao" },
};
export const dynamic = "force-dynamic";

export default async function TabelaoPage() {
  await enforcePermission("crm.simulators.view");
  return <TabelaoArchive />;
}
