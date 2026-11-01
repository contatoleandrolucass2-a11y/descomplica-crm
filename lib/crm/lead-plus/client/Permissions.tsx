import { useApi } from "./api";
import { useAuth } from "./Auth";
import { DataTable, Panel } from "./ui";
export default function Permissions() {
  const auth = useAuth();
  const result = useApi<{
    labels: Record<string, string>;
    current: Record<string, boolean>;
    levels: Record<string, Record<string, boolean>>;
  }>("/permissions");
  const levels = Object.keys(result.data?.levels || {});
  const rows = Object.entries(result.data?.labels || {}).map(([key, label]) => [
    label + (key === "access_finance" ? " (módulo removido)" : ""),
    result.data?.current[key] ? "Sim" : "Não",
    ...levels.map((level) => (result.data?.levels[level]?.[key] ? "Sim" : "Não")),
  ]);
  return (
    <div className="system-screen">
      <h1>Permissões do nível</h1>
      <p>
        {auth.user?.label || auth.user?.role} ·{" "}
        {auth.user?.scope === "all"
          ? "Todas as hierarquias"
          : auth.user?.scope === "team"
            ? "Equipe e hierarquia gerenciada: " + auth.user.team
            : "Leads próprios e oportunidades disponíveis no Bolsão"}
      </p>
      <Panel title="Matriz do DESCOMPLICA LEAD">
        <p>
          O Admin possui acesso global e administração exclusiva do DESCOMPLICA LEAD. Gerente e
          Superintendente mantêm os módulos permitidos em seus respectivos alcances. Esta tela
          apenas consulta a matriz; não altera permissões do CRM principal.
        </p>
        {result.loading ? (
          <p>Carregando…</p>
        ) : (
          <DataTable headers={["Permissão", "Usuário atual", ...levels]} rows={rows} />
        )}
        {result.error && (
          <p role="alert" className="api-error">
            {result.error}
          </p>
        )}
      </Panel>
    </div>
  );
}
