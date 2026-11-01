import { useState } from "react";
import { useAuth } from "./Auth";
import { api, stages, useApi, type Lead, type Resource } from "./api";
import { Button, DataTable, Panel, downloadCSV } from "./ui";
type ExportItem = {
  id: string;
  name: string;
  count: number;
  created_at: string;
};
export default function Exportations() {
  const auth = useAuth();
  const id = auth.user?.id || "local-preview";
  const result = useApi<{ data: Resource[] }>("/resources/exports");
  const record = result.data?.data.find((record) => record.id === id);
  const items = (record?.items as ExportItem[] | undefined) || [];
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <div className="system-screen">
      <h1>Minhas exportações</h1>
      <Panel title="Exportar leads acessíveis">
        <p>O arquivo contém os leads que seu usuário pode consultar. O histórico é individual.</p>
        <Button
          disabled={!auth.can("reports.export")}
          primary
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setFailure("");
            try {
              const { data } = await api<{ data: Lead[] }>("/exports/leads");
              const item = {
                id: crypto.randomUUID(),
                name: "Leads DESCOMPLICA LEAD",
                count: data.length,
                created_at: new Date().toISOString(),
              };
              await api("/resources/exports/" + id, "PUT", {
                items: [item, ...items].slice(0, 30),
                ...(record ? { version: record.version } : {}),
              });
              downloadCSV(
                "descomplica-lead-leads",
                ["Nome", "E-mail", "Telefone", "Imóvel", "Responsável", "Origem", "Etapa"],
                data.map((lead) => [
                  lead.name,
                  lead.email || "",
                  lead.phone || "",
                  lead.product,
                  lead.owner,
                  lead.source,
                  lead.archived ? "Arquivado" : stages[lead.stage] || "Etapa não informada",
                ]),
              );
            } catch (error) {
              setFailure((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Preparando…" : "Exportar leads em CSV"}
        </Button>
        {(result.error || failure) && (
          <p role="alert" className="api-error">
            {result.error || failure}
          </p>
        )}
      </Panel>
      <Panel title="Histórico de exportações">
        <DataTable
          headers={["Arquivo", "Registros", "Data", "Status"]}
          rows={items.map((item) => [
            item.name,
            String(item.count),
            new Date(item.created_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            }),
            "Arquivo gerado",
          ])}
        />
        <p>
          O arquivo é entregue ao navegador. Para obter dados atualizados, gere uma nova exportação.
        </p>
      </Panel>
    </div>
  );
}
