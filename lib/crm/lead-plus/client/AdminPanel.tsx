import { useApi } from "./api";
import { Button, Panel } from "./ui";

type Overview = {
  totals: { leads: number; users: number; teams: number; properties: number };
  permissions: string[];
};

export default function AdminPanel({ navigate }: { navigate: (route: string) => void }) {
  const result = useApi<Overview>("/admin/overview");
  return (
    <div className="system-screen admin-screen">
      <h1>Administração do DESCOMPLICA LEAD</h1>
      <p>Acesso global aos módulos e às equipes do DESCOMPLICA LEAD.</p>
      {result.error && (
        <p role="alert" className="api-error">
          {result.error}
        </p>
      )}
      <div className="admin-overview-grid">
        {(
          [
            ["Leads", result.data?.totals.leads],
            ["Usuários", result.data?.totals.users],
            ["Equipes", result.data?.totals.teams],
          ] as const
        ).map(([label, total]) => (
          <Panel key={label} title={label}>
            <strong className="metric">{result.loading ? "—" : (total ?? "—")}</strong>
          </Panel>
        ))}
      </div>
      <Panel title="Administração global">
        <div className="toolbar">
          {[
            "Usuários",
            "Hierarquia",
            "Ajustes",
            "Ajustes do Bolsão",
            "Filas de Distribuição",
            "Integrações",
            "Auditoria",
            "Permissões",
          ].map((route) => (
            <Button key={route} onClick={() => navigate(route)}>
              {route}
            </Button>
          ))}
        </div>
        <p>
          O Admin pode administrar todas as equipes e os módulos disponíveis. Configurações pessoais
          continuam vinculadas ao próprio usuário.
        </p>
      </Panel>
    </div>
  );
}
