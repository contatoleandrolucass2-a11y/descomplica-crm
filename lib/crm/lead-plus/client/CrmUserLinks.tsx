import { useEffect, useState } from "react";
import { api, LeadApiError, useApi, type Resource } from "./api";
import { useAuth } from "./Auth";
import { Button, DataTable, Modal, Panel } from "./ui";

type CrmUser = { id: string; name: string; email: string };
type Directory = { data: CrmUser[]; total: number; offset: number; limit: number };
const roles = [
  { id: "admin", label: "Admin" },
  { id: "superintendent", label: "Superintendente" },
  { id: "manager", label: "Gerente" },
  { id: "broker", label: "Corretor" },
];
export default function CrmUserLinks() {
  const auth = useAuth();
  const linked = useApi<{ data: Resource[] }>("/resources/users");
  const realRole = auth.actor?.role || auth.user?.role;
  const canLink = realRole === "admin" && !auth.view_as?.active && auth.can("users.manage");
  return (
    <div className="system-screen">
      <h1>Usuários do DESCOMPLICA LEAD</h1>
      <p>
        Os vínculos operacionais usam pessoas já cadastradas no CRM. Nenhum vínculo cria login ou
        altera senha, nome ou e-mail no CRM.
      </p>
      <Panel title="Usuários vinculados">
        {linked.error ? (
          <p role="alert" className="api-error">
            {linked.error}
          </p>
        ) : linked.loading ? (
          <p role="status">Carregando vínculos…</p>
        ) : (
          <DataTable
            headers={["Nome", "E-mail", "Perfil", "Situação"]}
            rows={(linked.data?.data || []).map((user) => [
              String(user.name || ""),
              String(user.email || ""),
              roles.find((item) => item.id === user.role)?.label || String(user.role || ""),
              user.active ? "Ativo" : "Inativo",
            ])}
          />
        )}
      </Panel>
      {canLink && <CrmUserDirectory linked={linked} />}
    </div>
  );
}
function CrmUserDirectory({ linked }: { linked: ReturnType<typeof useApi<{ data: Resource[] }>> }) {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [target, setTarget] = useState<CrmUser | null>(null);
  const [role, setRole] = useState("broker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const directory = useApi<Directory>(
    "/crm-users?" + new URLSearchParams({ search: query, offset: String(offset) }),
  );
  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  return (
    <>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      <Panel title="Vincular usuário existente do CRM">
        <label className="field">
          Buscar nome ou e-mail
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={160}
            placeholder="Pesquisar no cadastro do CRM"
          />
        </label>
        {directory.error && (
          <p role="alert" className="api-error">
            {directory.error}{" "}
            <Button onClick={() => void directory.refresh()}>Tentar novamente</Button>
          </p>
        )}
        {directory.loading ? (
          <p role="status">Consultando usuários do CRM…</p>
        ) : (
          !directory.error &&
          directory.data && (
            <>
              <DataTable
                headers={["Nome", "E-mail", "Ação"]}
                rows={directory.data.data.map((user) => [
                  user.name,
                  user.email,
                  <Button
                    key={user.id}
                    onClick={() => {
                      const current = linked.data?.data.find(
                        (item) => item.auth_user_id === user.id || item.id === user.id,
                      );
                      setRole(String(current?.role || "broker"));
                      setTarget(user);
                      setError("");
                    }}
                  >
                    {linked.data?.data.some(
                      (item) => item.auth_user_id === user.id || item.id === user.id,
                    )
                      ? "Ajustar vínculo"
                      : "Vincular"}
                  </Button>,
                ])}
              />
              {!directory.data.data.length && (
                <p role="status">Nenhum usuário encontrado para esta busca.</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <Button
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - directory.data!.limit))}
                >
                  Anterior
                </Button>
                <span>
                  {directory.data.total} usuários · página{" "}
                  {Math.floor(offset / Math.max(1, directory.data.limit)) + 1}
                </span>
                <Button
                  disabled={offset + directory.data.limit >= directory.data.total}
                  onClick={() => setOffset(offset + directory.data!.limit)}
                >
                  Próxima
                </Button>
              </div>
            </>
          )
        )}
      </Panel>
      {target && (
        <Modal
          title="Vincular usuário do CRM"
          onClose={() => {
            if (!busy) setTarget(null);
          }}
        >
          <p>
            <strong>{target.name}</strong>
            <br />
            {target.email}
          </p>
          <p>Nome e e-mail são obtidos do CRM e não podem ser editados aqui.</p>
          <label className="field">
            Perfil no DESCOMPLICA LEAD
            <select value={role} disabled={busy} onChange={(event) => setRole(event.target.value)}>
              {roles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="api-error">
              {error}
            </p>
          )}
          <Button
            primary
            disabled={busy || linked.loading || !!linked.error}
            onClick={async () => {
              setBusy(true);
              setError("");
              setNotice("");
              try {
                const existing = linked.data?.data.find(
                  (item) => item.auth_user_id === target.id || item.id === target.id,
                );
                await api("/crm-users/link", "POST", {
                  auth_user_id: target.id,
                  role,
                  ...(existing?.version !== undefined ? { version: existing.version } : {}),
                });
                setTarget(null);
                await linked.refresh();
                await auth.refresh();
                setNotice(
                  "Vínculo operacional salvo. O cadastro de autenticação do CRM foi preservado.",
                );
              } catch (failure) {
                setError(
                  failure instanceof LeadApiError && failure.status === 409
                    ? "Este vínculo foi alterado por outra pessoa. Feche esta janela, atualize os vínculos e tente novamente."
                    : (failure as Error).message,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Salvando…" : "Salvar vínculo"}
          </Button>
        </Modal>
      )}
    </>
  );
}
