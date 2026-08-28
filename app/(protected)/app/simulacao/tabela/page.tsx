import { forbidden } from "next/navigation";

import { DataState, PageHeader } from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate, protectedPageGateIsReleased } from "@/lib/authorization/page-gates";

import { InventoryTable } from "./_components/InventoryTable";
import styles from "./tabelao.module.css";

export const metadata = { title: "Tabelão" };
export const dynamic = "force-dynamic";

export default async function TabelaoPage() {
  const authorization = await enforcePermission("crm.simulators.view");
  const pageGate = getProtectedPageGate("/app/simulacao/tabela");
  if (authorization.roleKey !== "master" || !pageGate || !protectedPageGateIsReleased(pageGate)) {
    forbidden();
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          eyebrow="Estoque comercial"
          title="Tabelão"
          description="Cada empreendimento e planta aparece uma única vez, sempre com o menor valor recebido da fonte oficial."
        />
        <DataState
          variant="warning"
          compact
          title="Consulta de apoio comercial"
          description="Confirme disponibilidade, valor e condição da unidade no fluxo oficial antes de formalizar a proposta."
        />
        <section aria-labelledby="inventory-title" className={styles.section}>
          <div className={styles.heading}>
            <p>Consulta exclusiva</p>
            <h2 id="inventory-title">Empreendimentos, plantas e menores valores</h2>
            <span>Sem combinações repetidas. Nenhuma reserva é inferida.</span>
          </div>
          <InventoryTable />
        </section>
      </div>
    </main>
  );
}
