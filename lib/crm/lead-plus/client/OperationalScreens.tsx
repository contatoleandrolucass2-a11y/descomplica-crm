import { useState } from "react";
import { CheckCircle, Download, Network, Plus } from "lucide-react";
import { api, useApi, type Lead, type Resource, type User } from "./api";
import { canAccessRoute } from "./navigation";
import { useAuth } from "./Auth";
import { Button, DataTable, Modal, Panel, Tabs, downloadCSV } from "./ui";
import { PersistentRecords } from "./ConnectedCRM";

export function WorkspaceHome({ navigate }: { navigate: (route: string) => void }) {
  const { can } = useAuth();
  const leads = useApi<{ data: Lead[] }>("/leads");
  return (
    <div className="system-screen">
      <h1>Meu DESCOMPLICA LEAD</h1>
      <p>Atendimento e gestão da operação em um só lugar.</p>
      <div className="three-columns">
        <Panel title="Leads em atendimento">
          <strong className="metric">
            {leads.data?.data.filter((lead) => !lead.archived).length ?? "—"}
          </strong>
          <Button onClick={() => navigate("Leads")}>Ver leads</Button>
        </Panel>
        <Panel title="Bolsão de oportunidades">
          <p>Resgate leads que ficaram sem atendimento.</p>
          <Button onClick={() => navigate("Bolsão")}>Abrir Bolsão</Button>
        </Panel>
      </div>
      <Panel title="Configuração da operação">
        <div className="toolbar">
          {[
            "Filas de Distribuição",
            "Ajustes do Bolsão",
            "Integrações",
            "Mensagens prontas",
            "Relatórios",
          ]
            .filter((route) => canAccessRoute(route, can))
            .map((route) => (
              <Button key={route} onClick={() => navigate(route)}>
                {route}
              </Button>
            ))}
        </div>
      </Panel>
      {leads.error && (
        <p role="alert" className="api-error">
          {leads.error}
        </p>
      )}
    </div>
  );
}

export function Hierarchy() {
  const teams = useApi<{ data: Resource[] }>("/resources/teams");
  const users = useApi<{ data: User[] }>("/resources/users");
  const { can } = useAuth();
  const [editing, setEditing] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <div className="system-screen">
      <div className="toolbar">
        <h1>Hierarquia</h1>
        <div className="spacer" />
        {can("teams.manage") && (
          <Button primary onClick={() => setEditing({ id: crypto.randomUUID(), version: 0 })}>
            <Plus size={16} /> Criar equipe
          </Button>
        )}
      </div>
      <p>Equipes cadastradas e usuários vinculados à operação.</p>
      {(teams.error || users.error || failure) && (
        <p role="alert" className="api-error">
          {teams.error || users.error || failure}
        </p>
      )}
      <div className="three-columns">
        <Panel title="Equipes">
          <strong className="metric">{teams.data?.data.length ?? "—"}</strong>
        </Panel>
        <Panel title="Usuários ativos">
          <strong className="metric">
            {users.data?.data.filter((user) => user.active).length ?? "—"}
          </strong>
        </Panel>
        <Panel title="Usuários sem equipe">
          <strong className="metric">
            {users.data?.data.filter((user) => !user.team).length ?? "—"}
          </strong>
        </Panel>
      </div>
      {teams.loading ? (
        <p>Carregando hierarquia…</p>
      ) : !teams.data?.data.length ? (
        <Panel title="Nenhuma equipe cadastrada">
          <p>Cadastre as equipes e vincule os usuários na tela Usuários.</p>
        </Panel>
      ) : (
        <div className="property-grid">
          {teams.data.data.map((team) => (
            <Panel key={team.id} title={String(team.name)}>
              <p>
                <Network size={16} /> {String(team.parent || "Equipe principal")}
              </p>
              <p>Gestor: {String(team.manager || "Não informado")}</p>
              {users.data?.data
                .filter((user) => user.team === team.name)
                .map((user) => (
                  <p key={user.id}>
                    {user.name} · {user.active ? "Ativo" : "Inativo"}
                  </p>
                ))}
              {can("teams.manage") && (
                <Button onClick={() => setEditing(team)}>Editar equipe</Button>
              )}
            </Panel>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.version ? "Editar equipe" : "Criar equipe"}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
              if (fields.parent === fields.name) {
                setFailure("Uma equipe não pode ser subordinada a si mesma.");
                return;
              }
              setBusy(true);
              try {
                await api("/resources/teams/" + editing.id, "PUT", {
                  ...fields,
                  ...(editing.version ? { version: editing.version } : {}),
                });
                setEditing(null);
                setFailure("");
              } catch (error) {
                setFailure((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Nome da equipe
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={String(editing.name || "")}
              />
            </label>
            <label className="field">
              Gestor
              <select name="manager" defaultValue={String(editing.manager || "")}>
                <option value="">Não informado</option>
                {users.data?.data
                  .filter((user) => user.active)
                  .map((user) => (
                    <option key={user.id}>{user.name}</option>
                  ))}
              </select>
            </label>
            <label className="field">
              Equipe superior
              <select name="parent" defaultValue={String(editing.parent || "")}>
                <option value="">Equipe principal</option>
                {teams.data?.data
                  .filter((team) => team.id !== editing.id)
                  .map((team) => (
                    <option key={team.id}>{String(team.name)}</option>
                  ))}
              </select>
            </label>
            {failure && (
              <p role="alert" className="api-error">
                {failure}
              </p>
            )}
            <div className="modal-actions">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button primary type="submit">
                {busy ? "Salvando…" : "Salvar equipe"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function Financial() {
  const { data, error } = useApi<{ data: Resource[] }>("/resources/invoices");
  const rows = data?.data || [];
  const sum = (status: string) =>
    rows
      .filter((record) => record.row?.[5] === status)
      .reduce((total, record) => total + Number(record.row?.[4]?.replace(",", ".") || 0), 0)
      .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="system-screen financial">
      <h1>Financeiro</h1>
      <p>Controle interno de cobranças. O cadastro não emite boletos nem realiza pagamentos.</p>
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      <div className="three-columns">
        <Panel title="Pendente">
          <strong className="metric">{sum("Pendente")}</strong>
        </Panel>
        <Panel title="Pago">
          <strong className="metric">{sum("Pago")}</strong>
        </Panel>
        <Panel title="Cancelado">
          <strong className="metric">{sum("Cancelado")}</strong>
        </Panel>
      </div>
      <PersistentRecords
        kind="invoices"
        title="Lançamentos financeiros"
        headers={[
          "Referência",
          "Descrição",
          "Cliente",
          "Vencimento (AAAA-MM-DD)",
          "Valor (R$)",
          "Status (Pendente/Pago/Cancelado)",
        ]}
      />
    </div>
  );
}

const lessons = [
  [
    "Primeiro atendimento",
    "Abra Leads, selecione o cliente e consulte o histórico. Registre ligações, WhatsApp e visitas no tipo correto para que o atendimento seja considerado no prazo do Bolsão.",
  ],
  [
    "Bolsão de oportunidades",
    "O Bolsão reúne novos leads sem atendimento após o prazo definido pela administração. Ao confirmar o resgate, o responsável é o usuário autenticado no CRM. O primeiro resgate confirmado vence.",
  ],
  [
    "Cadastro de imóveis",
    "Cadastre o interesse do cliente diretamente no lead e mantenha o histórico de atendimento atualizado.",
  ],
  [
    "Funil e acompanhamento",
    "Arraste os cartões entre etapas no Funil. A conclusão de uma venda exige confirmação. Consulte Relatórios para acompanhar os registros acessíveis ao seu usuário.",
  ],
];
export function Training() {
  const auth = useAuth();
  const id = auth.user?.id || "local-preview";
  const result = useApi<{ data: Resource[] }>("/resources/training");
  const record = result.data?.data.find((record) => record.id === id);
  const completed = (record?.completed as string[] | undefined) || [];
  const [active, setActive] = useState(lessons[0]?.[0] || "");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="system-screen">
      <h1>Treinamentos</h1>
      <p>
        Guia operacional DESCOMPLICA LEAD · {completed.length} de {lessons.length} concluídos
      </p>
      <div className="training-progress">
        <span style={{ width: `${(completed.length / lessons.length) * 100}%` }} />
      </div>
      <div className="two-columns">
        <Panel title="Conteúdo">
          {lessons.map(([title]) => (
            <button className="training-lesson" key={title} onClick={() => setActive(title || "")}>
              {completed.includes(title || "") ? <CheckCircle size={18} /> : <Network size={18} />}
              {title}
            </button>
          ))}
        </Panel>
        <Panel title={active}>
          <p>{lessons.find(([title]) => title === active)?.[1]}</p>
          <Button
            primary
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await api("/resources/training/" + id, "PUT", {
                  completed: [...new Set([...completed, active])],
                  ...(record ? { version: record.version } : {}),
                });
                setFailure("");
              } catch (error) {
                setFailure((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {completed.includes(active)
              ? "Concluído"
              : busy
                ? "Salvando…"
                : "Marcar como concluído"}
          </Button>
        </Panel>
      </div>
      {(result.error || failure) && (
        <p className="api-error" role="alert">
          {result.error || failure}
        </p>
      )}
    </div>
  );
}
