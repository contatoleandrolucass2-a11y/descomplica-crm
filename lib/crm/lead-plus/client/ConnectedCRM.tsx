import MetaCampaignSelection from "./MetaCampaignSelection";
import { useEffect, useState } from "react";
import { useAuth } from "./Auth";
import {
  Star,
  Plus,
  Filter,
  Search,
  MessageCircle,
  Network,
  Clock,
  Pencil,
  Trash2,
  Download,
  CheckCircle,
} from "lucide-react";
import { api, useApi, stages, sourceLabel, type Lead, type User, type Resource } from "./api";
import LeadTabs from "./LeadTabs";
import LeadCountdown from "./LeadCountdown";
import { Button, Panel, Modal, DataTable, Tabs, downloadCSV } from "./ui";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="api-error">
      {error}
    </div>
  ) : null;
}
export function LeadEditor({
  onClose,
  stage = 0,
  defaultProduct = "",
  propertyId,
}: {
  onClose: () => void;
  stage?: number;
  defaultProduct?: string;
  propertyId?: string;
}) {
  const users = useApi<{ data: User[] }>("/resources/users");
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  return (
    <Modal title="Criar novo lead" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          const values = new FormData(e.currentTarget);
          setSaving(true);
          try {
            const saved = await api<{ lead: Lead }>(
              "/leads",
              "POST",
              {
                name: values.get("name"),
                email: values.get("email"),
                phone: values.get("phone"),
                product: values.get("product"),
                owner_id: values.get("owner") || undefined,
                message: values.get("message"),
                attribution: {
                  ...(propertyId ? { property_id: propertyId } : {}),
                  negotiation_type: String(values.get("negotiation_type")),
                },
              },
              key,
            );
            if (stage)
              await api("/leads/" + saved.lead.id, "PATCH", {
                version: saved.lead.version,
                stage,
                confirm_sale: stage === 5,
              });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="field">
          Natureza da negociação
          <select name="negotiation_type">
            <option>Indefinido</option>
            <option>Compra</option>
            <option>Locação</option>
          </select>
        </label>
        {[
          ["Nome", "name"],
          ["E-mail", "email"],
          ["Telefone", "phone"],
          ["Produto de interesse", "product"],
        ].map(([label, name]) => (
          <label className="field" key={name}>
            {label}
            <input
              name={name}
              required={name === "name" || name === "product"}
              type={name === "email" ? "email" : "text"}
              defaultValue={name === "product" ? defaultProduct : undefined}
            />
          </label>
        ))}
        <label className="field">
          Responsável
          <select name="owner">
            <option value="">Distribuição automática</option>
            {users.data?.data
              .filter((u) => u.active)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Mensagem do cliente
          <textarea name="message" />
        </label>
        <ErrorMessage error={error} />
        <div className="modal-actions">
          <Button onClick={onClose}>Cancelar</Button>
          <Button primary type="submit">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function LeadDetail({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { data, error } = useApi<{
    data: { id: string; body: string; type: string; created_at: string }[];
  }>("/leads/" + lead.id + "/activities");
  const auth = useAuth();
  const preferences = useApi<{ data: (Resource & { favorites: string[] })[] }>(
    "/resources/lead-preferences",
  );
  const preference = preferences.data?.data[0];
  const favorite = preference?.favorites.includes(lead.id) || false;
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const contactDate = lead.attribution?.next_contact_at
    ? new Date(lead.attribution.next_contact_at)
    : null;
  const contactInput =
    contactDate && Number.isFinite(contactDate.getTime())
      ? new Date(contactDate.getTime() - contactDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  const users = useApi<{ data: User[] }>("/resources/users");
  const canManage =
    auth.can("leads.edit.scope") &&
    (auth.user?.scope === "all" || !!users.data?.data.some((user) => user.id === lead.owner_id));
  const canEdit = lead.owner_id === auth.user?.id || canManage;
  const [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState(lead.owner_id || "");
  return (
    <Modal title={lead.name} onClose={onClose} className="lead-detail-modal">
      <div className="lead-detail-meta">
        <p>{[lead.email, lead.phone].filter(Boolean).join(" · ")}</p>
        <p>
          {lead.product} · {sourceLabel(lead.source)}
        </p>
      </div>
      <Button
        disabled={preferences.loading || favoriteBusy}
        onClick={async () => {
          if (!auth.user) return;
          setFavoriteBusy(true);
          try {
            const favorites = new Set(preference?.favorites || []);
            if (favorite) favorites.delete(lead.id);
            else favorites.add(lead.id);
            await api("/resources/lead-preferences/" + auth.user.id, "PUT", {
              favorites: [...favorites],
              version: preference?.version,
            });
            await preferences.refresh();
          } catch (error) {
            setFailure((error as Error).message);
          } finally {
            setFavoriteBusy(false);
          }
        }}
      >
        <Star size={16} fill={favorite ? "currentColor" : "none"} />
        {favorite ? "Remover dos favoritos" : "Favoritar lead"}
      </Button>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const stage = Number(f.get("stage"));
            if (
              stage === 5 &&
              lead.stage !== 5 &&
              !confirm("Confirmar que o negócio foi realmente fechado?")
            )
              return;
            await api("/leads/" + lead.id, "PATCH", {
              version: lead.version,
              next_contact_at: f.get("next_contact_at")
                ? new Date(String(f.get("next_contact_at"))).toISOString()
                : null,
              stage,
              ...(canManage ? { owner_id: String(f.get("owner") || "") } : {}),
              value: Number(f.get("value")),
              archived: f.get("archived") === "on",
              ...(f.get("archived") === "on" ? { archive_reason: f.get("reason") } : {}),
              confirm_sale: stage === 5,
              negotiation_type: String(f.get("negotiation_type")),
            });
            onClose();
          } catch (e) {
            setFailure((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="lead-detail-fields" disabled={!canEdit || busy}>
          <label className="field">
            Etapa
            <select name="stage" defaultValue={lead.stage}>
              {stages.map((s, i) => (
                <option value={i} key={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Natureza da negociação
            <select name="negotiation_type" defaultValue={lead.negotiation_type || "Indefinido"}>
              <option>Indefinido</option>
              <option>Compra</option>
              <option>Locação</option>
            </select>
          </label>
          <label className="field">
            Responsável
            <select
              disabled={!canManage}
              name="owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              <option value="">Não atribuído</option>
              {users.data?.data
                .filter((u) => u.active)
                .map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Próximo retorno
            <input name="next_contact_at" type="datetime-local" defaultValue={contactInput} />
          </label>
          <label className="field">
            Valor
            <input name="value" type="number" min="0" step="0.01" defaultValue={lead.value} />
          </label>
          <label className="lead-detail-archive">
            <input name="archived" type="checkbox" defaultChecked={lead.archived} /> Arquivado
          </label>
          <label className="field lead-detail-wide">
            Motivo de arquivamento
            <input name="reason" />
          </label>
          <ErrorMessage error={failure} />
          <div className="lead-detail-actions">
            <Button primary type="submit">
              {busy ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </fieldset>
      </form>
      {!canEdit && <p>Assuma este lead pelo Bolsão antes de alterar o atendimento.</p>}
      <details className="lead-detail-history">
        <summary>Histórico e interações</summary>
        <ErrorMessage error={error} />
        {data?.data.map((a) => (
          <div className="activity" key={a.id}>
            <small>
              {new Date(a.created_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              · {a.type}
            </small>
            <p>{a.body}</p>
          </div>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            try {
              await api("/leads/" + lead.id + "/activities", "POST", {
                body: new FormData(form).get("body"),
                type: new FormData(form).get("type"),
              });
              form.reset();
              setFailure("");
            } catch (e) {
              setFailure((e as Error).message);
            }
          }}
        >
          <fieldset disabled={!canEdit}>
            <label className="field">
              Tipo de interação
              <select name="type">
                <option value="note">Anotação interna</option>
                <option value="call">Ligação realizada</option>
                <option value="whatsapp">Contato por WhatsApp realizado</option>
                <option value="visit">Visita realizada</option>
              </select>
            </label>
            <p>Anotações internas não contam como atendimento para o prazo do Bolsão.</p>
            <label className="field">
              Registrar interação
              <textarea name="body" required maxLength={4000} />
            </label>
            <Button primary type="submit">
              Salvar interação
            </Button>
          </fieldset>
        </form>
      </details>
    </Modal>
  );
}
export function ConnectedLeads({ kanban = false }: { kanban?: boolean }) {
  const favoritesResult = useApi<{ data: (Resource & { favorites: string[] })[] }>(
    "/resources/lead-preferences",
  );
  const favorites = new Set(favoritesResult.data?.data[0]?.favorites || []);
  const { data, error, loading, refresh } = useApi<{ data: Lead[]; server_time?: string }>(
    "/leads",
  );
  const [clock, setClock] = useState(Date.now);
  const [serverOffset, setServerOffset] = useState(0);
  const now = clock + serverOffset;
  useEffect(() => {
    if (data?.server_time) {
      const serverTime = Date.parse(data.server_time);
      const update = setTimeout(() => {
        setServerOffset(serverTime - Date.now());
        setClock(Date.now());
      }, 0);
      return () => clearTimeout(update);
    }
  }, [data?.server_time]);
  useEffect(() => {
    const deadlines = (data?.data || [])
      .map((lead) => Date.parse(lead.bucket_deadline_at || ""))
      .filter((deadline) => Number.isFinite(deadline) && deadline > Date.now() + serverOffset);
    if (!deadlines.length) return;
    const delay = Math.min(
      2147483647,
      Math.max(250, Math.min(...deadlines) - Date.now() - serverOffset + 250),
    );
    const timeout = setTimeout(() => {
      if (!document.hidden) void refresh();
    }, delay);
    return () => clearTimeout(timeout);
  }, [data, refresh, serverOffset]);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setClock(Date.now());
    };
    const resume = () => {
      tick();
      if (!document.hidden) window.dispatchEvent(new Event("crm-update"));
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  const [query, setQuery] = useState(""),
    [owner, setOwner] = useState(""),
    [recordStatus, setRecordStatus] = useState("all"),
    [showFilters, setShowFilters] = useState(false),
    [tab, setTab] = useState(kanban ? "Kanban" : "A fazer"),
    [create, setCreate] = useState<number | null>(null),
    [selected, setSelected] = useState<Lead | null>(null),
    [failure, setFailure] = useState("");
  const users = useApi<{ data: User[] }>("/resources/users");
  const all = data?.data || [],
    filtered = all.filter(
      (l) =>
        l.name.toLowerCase().includes(query.toLowerCase()) &&
        (!owner || l.owner_id === owner) &&
        (recordStatus === "all" || l.archived === (recordStatus === "archived")),
    );
  const future = (lead: Lead) =>
    !lead.archived && lead.stage < 5 && Date.parse(lead.attribution?.next_contact_at || "") > now;
  const matches = (lead: Lead, category: string) =>
    category === "Todos"
      ? true
      : category === "Favoritos"
        ? favorites.has(lead.id)
        : category === "Visitas"
          ? !lead.archived && [2, 3].includes(lead.stage)
          : category === "Futuras"
            ? future(lead)
            : !lead.archived && lead.stage < 5 && !future(lead);
  const displayed = filtered.filter((lead) => matches(lead, tab));
  const counts = Object.fromEntries(
    ["A fazer", "Visitas", "Futuras", "Favoritos", "Todos"].map((category) => [
      category,
      filtered.filter((lead) => matches(lead, category)).length,
    ]),
  );
  async function move(id: string, stage: number) {
    const lead = all.find((l) => l.id === id);
    if (!lead) return;
    if (stage === 5 && !confirm("Confirmar que o negócio foi realmente fechado?")) return;
    try {
      await api("/leads/" + id, "PATCH", {
        version: lead.version,
        stage,
        confirm_sale: stage === 5,
      });
      setFailure("");
    } catch (e) {
      setFailure((e as Error).message);
      void refresh();
    }
  }
  return (
    <div className={"system-screen " + (kanban ? "funnel-screen" : "leads-screen")}>
      <div className="toolbar funnel-toolbar">
        <h2>{kanban ? "Funil de Vendas" : "Leads"}</h2>
        <input
          placeholder="Buscar lead por nome..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="spacer" />
        <Button onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} />
          Filtros
        </Button>
        <Button primary onClick={() => setCreate(0)}>
          <Plus size={16} />
          Criar novo lead
        </Button>
      </div>
      {showFilters && (
        <Panel title="Filtros">
          <label className="field">
            Responsável
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Todos os usuários</option>
              {users.data?.data.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Situação
            <select
              aria-label="Situação dos leads"
              value={recordStatus}
              onChange={(event) => setRecordStatus(event.target.value)}
            >
              <option value="all">Todos os registros</option>
              <option value="active">Ativos</option>
              <option value="archived">Arquivados</option>
            </select>
          </label>
        </Panel>
      )}
      {kanban ? (
        <Tabs items={["Kanban", "Análise do Funil", "Consultores"]} value={tab} onChange={setTab} />
      ) : (
        <LeadTabs
          value={tab}
          counts={counts}
          loading={loading || favoritesResult.loading}
          onChange={setTab}
        />
      )}
      <div
        id="leads-tabpanel"
        role={kanban ? undefined : "tabpanel"}
        aria-labelledby={
          kanban
            ? undefined
            : "lead-tab-" + ["A fazer", "Visitas", "Futuras", "Favoritos", "Todos"].indexOf(tab)
        }
      >
        <ErrorMessage error={error || failure || favoritesResult.error} />
        {loading ? (
          <p>Carregando dados do Supabase…</p>
        ) : kanban && tab === "Kanban" ? (
          <div className="kanban">
            {stages.map((s, i) => (
              <div
                key={s}
                className={"kanban-column stage-" + i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void move(e.dataTransfer.getData("text/plain"), i)}
              >
                <div className="kanban-title">
                  <strong>{s}</strong>
                  <span>{filtered.filter((l) => !l.archived && l.stage === i).length}</span>
                  <small>
                    {filtered
                      .filter((l) => !l.archived && l.stage === i)
                      .reduce((n, l) => n + l.value, 0)
                      .toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                  </small>
                </div>
                {filtered
                  .filter((l) => !l.archived && l.stage === i)
                  .map((l) => (
                    <button
                      key={l.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                      onClick={() => setSelected(l)}
                      className="kanban-card"
                    >
                      <strong>{l.name}</strong>
                      <p>
                        <MessageCircle size={13} />
                        {l.source}
                      </p>
                      <p>
                        <Network size={13} />
                        {l.product}
                      </p>
                      <div className="kanban-owner">{l.owner}</div>
                      <small className="kanban-date">
                        <Clock size={12} />
                        {new Date(l.created_at).toLocaleDateString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </small>
                    </button>
                  ))}
                <button className="add-card" onClick={() => setCreate(i)}>
                  <Plus size={14} />
                  Adicionar lead
                </button>
              </div>
            ))}
          </div>
        ) : kanban ? (
          <Panel title={tab}>
            <DataTable
              headers={
                tab === "Consultores"
                  ? ["Usuário", "Leads atribuídos"]
                  : ["Etapa", "Volume", "Valor"]
              }
              rows={
                tab === "Consultores"
                  ? (users.data?.data || []).map((u) => [
                      u.name,
                      all.filter((l) => l.owner_id === u.id && !l.archived).length,
                    ])
                  : stages.map((s, i) => [
                      s,
                      all.filter((l) => l.stage === i && !l.archived).length,
                      all
                        .filter((l) => l.stage === i && !l.archived)
                        .reduce((n, l) => n + l.value, 0)
                        .toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }),
                    ])
              }
            />
          </Panel>
        ) : displayed.length ? (
          <div className="lead-list">
            {displayed.map((l) => (
              <button className="lead-list-item" key={l.id} onClick={() => setSelected(l)}>
                <span className="avatar">{l.name[0]}</span>
                <div>
                  <strong>{l.name}</strong>
                  {l.bucket_available_at && (
                    <span className="bucket-badge">
                      Disponível no Bolsão · Sem atendimento no prazo
                    </span>
                  )}
                  <p>
                    {l.product} · {stages[l.stage]}
                  </p>
                  <small>
                    {l.owner} · {l.source}
                  </small>
                </div>
                <span className="lead-card-trailing">
                  <span className="lead-card-contact">{l.phone || l.email}</span>
                  <LeadCountdown lead={l} now={now} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="leads-empty">
            <h2>Nenhum lead neste recorte</h2>
            <div>
              <CheckCircle size={65} color="#bce477" />
              <p>Cadastre um lead ou configure uma entrada de integração.</p>
            </div>
          </div>
        )}
      </div>
      {create !== null && <LeadEditor stage={create} onClose={() => setCreate(null)} />}
      {selected && <LeadDetail lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
type Dashboard = {
  total: number;
  active: number;
  archived: number;
  stages: { name: string; count: number; value: number }[];
  sources: { name: string; leads: number; convertidos: number }[];
};
export function ConnectedDashboard({ report = false }: { report?: boolean }) {
  const auth = useAuth();
  const { data, error, loading } = useApi<Dashboard>("/dashboard");
  return (
    <div className="system-screen">
      <h1>{report ? "Relatórios da operação" : "Como está minha operação"}</h1>
      <p>Dados persistidos no Supabase · Atualização automática entre telas</p>
      <ErrorMessage error={error} />
      {loading ? (
        <p>Carregando…</p>
      ) : (
        data && (
          <>
            <div className="three-columns">
              {[
                ["Leads recebidos", data.total],
                ["Em operação", data.active],
                ["Arquivados", data.archived],
              ].map(([n, v]) => (
                <Panel key={n} title={String(n)}>
                  <strong className="metric">{v}</strong>
                </Panel>
              ))}
            </div>
            <Panel title="Onde a operação perde leads">
              <DataTable
                headers={["Etapa", "Volume atual", "Valor"]}
                rows={data.stages.map((s) => [
                  s.name,
                  s.count,
                  s.value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }),
                ])}
              />
              <p>
                Volume atual por etapa. Conversão histórica exige análise dos eventos de passagem,
                não divisão dos saldos atuais.
              </p>
            </Panel>
            <Panel title="Leads por origem">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.sources.map((source) => ({
                    ...source,
                    name: sourceLabel(source.name),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="leads" name="Recebidos" fill="#459be5" />
                </BarChart>
              </ResponsiveContainer>
              <DataTable
                headers={["Origem", "Recebidos", "Negócios fechados"]}
                rows={data.sources.map((s) => [sourceLabel(s.name), s.leads, s.convertidos])}
              />
              <Button
                disabled={!auth.can("reports.export")}
                onClick={() =>
                  downloadCSV(
                    "relatorio",
                    ["Origem", "Recebidos", "Negócios fechados"],
                    data.sources.map((s) => [s.name, String(s.leads), String(s.convertidos)]),
                  )
                }
              >
                Exportar
              </Button>
            </Panel>
          </>
        )
      )}
    </div>
  );
}
export function PersistentRecords({
  kind,
  title,
  headers,
}: {
  kind: string;
  title: string;
  headers: string[];
}) {
  const auth = useAuth();
  const editable =
    kind === "users"
      ? auth.can("users.manage")
      : kind === "referrals" || auth.can("crm.settings.manage");
  const { data, error, loading } = useApi<{ data: Resource[] }>("/resources/" + kind);
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Resource | null>(null),
    [failure, setFailure] = useState("");
  const rows = data?.data || [];
  const asRow = (r: Resource) =>
    kind === "users"
      ? [
          String(r.team || ""),
          String(r.name || ""),
          String(r.email || ""),
          String(r.phone || ""),
          r.active === false ? "Não" : "Sim",
        ]
      : r.row || [];
  return (
    <div className="system-screen">
      <Panel title={title}>
        <div className="toolbar">
          <Button
            primary
            disabled={!editable}
            onClick={() => setEditing({ id: crypto.randomUUID(), version: 0, row: [] })}
          >
            <Plus size={15} />
            {kind === "users" ? "Criar usuário" : "Novo"}
          </Button>
          <input
            placeholder="Buscar registros"
            aria-label="Buscar registros"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button onClick={() => downloadCSV(title, headers, rows.map(asRow))}>
            <Download size={15} />
            Exportar
          </Button>
        </div>
        <ErrorMessage error={error || failure} />
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <DataTable
            headers={[...headers, "Ações"]}
            rows={rows
              .filter((r) => asRow(r).join(" ").toLowerCase().includes(query.toLowerCase()))
              .map((r) => [
                ...asRow(r),
                <div key={r.id} className="row-actions">
                  <Button disabled={!editable} onClick={() => setEditing(r)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    disabled={!editable}
                    onClick={async () => {
                      if (!confirm("Excluir este registro do DESCOMPLICA LEAD?")) return;
                      try {
                        await api(
                          "/resources/" + kind + "/" + r.id + "?version=" + r.version,
                          "DELETE",
                        );
                        setFailure("");
                      } catch (e) {
                        setFailure((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>,
              ])}
          />
        )}
      </Panel>
      {editing && (
        <Modal
          title={editing.version ? "Editar registro" : "Novo registro"}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Array.from(
                e.currentTarget.querySelectorAll<HTMLInputElement>("input"),
              ).map((i) => i.value);
              try {
                const payload =
                  kind === "users"
                    ? {
                        team: values[0],
                        name: values[1],
                        email: values[2],
                        phone: values[3],
                        active: (values[4] || "").toLowerCase() !== "não",
                      }
                    : { row: values };
                await api("/resources/" + kind + "/" + editing.id, "PUT", {
                  ...payload,
                  ...(editing.version ? { version: editing.version } : {}),
                });
                setEditing(null);
                setFailure("");
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            {headers.map((h, i) => (
              <label className="field" key={h}>
                {h}
                <input
                  defaultValue={asRow(editing)[i] || ""}
                  required={kind === "users" ? i === 1 || i === 2 : i === 0}
                />
              </label>
            ))}
            <ErrorMessage error={failure} />
            <div className="modal-actions">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button primary type="submit">
                Salvar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
type Integration = {
  provider: string;
  status: string;
  total_received: number;
  last_received_at: string | null;
};
export function ConnectedIntegrations() {
  const auth = useAuth();
  const { data, error } = useApi<{
    data: Integration[];
    events: { provider: string; external_id: string; status: string; received_at: string }[];
  }>("/integrations");
  const facebook = data?.data.find((item) => item.provider === "facebook");
  return (
    <div className="system-screen">
      <h1>Integrações</h1>
      <Panel title="Facebook">
        <p>Meta/Facebook → DESCOMPLICA LEAD</p>
        <p>
          Os leads dos formulários do Facebook serão recebidos diretamente aqui, sem depender da
          sincronização do nosso Meta Ads.
        </p>
        <ErrorMessage error={error} />
        <span className="badge-gray">
          {error
            ? "Não foi possível consultar a conexão"
            : !facebook
              ? "Carregando…"
              : facebook.status === "configured"
                ? "Recebimento direto configurado · aguardando validação"
                : "Aguardando configuração da conexão direta com a Meta"}
        </span>
        {facebook && (
          <p>
            Leads recebidos diretamente da Meta: <strong>{facebook.total_received}</strong>
          </p>
        )}
        {facebook?.last_received_at && (
          <p>
            Última entrega registrada:{" "}
            {new Date(facebook.last_received_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        )}
      </Panel>
      {auth.user?.scope === "all" && auth.can("crm.settings.manage") && <MetaCampaignSelection />}
      <Panel title="Leads recebidos do Facebook">
        {error ? (
          <p role="alert">
            Não foi possível consultar o histórico de entregas. A ausência de dados não confirma
            ausência de leads.
          </p>
        ) : !data ? (
          <p role="status">Carregando histórico de entregas…</p>
        ) : data.events?.length ? (
          <DataTable
            headers={["Origem", "ID do lead", "Recebido em", "Situação"]}
            rows={data.events.map((event) => [
              "Facebook",
              event.external_id,
              new Date(event.received_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              }),
              "Recebido",
            ])}
          />
        ) : (
          <p>Nenhuma entrega registrada. Os leads de demonstração não indicam uma conexão ativa.</p>
        )}
      </Panel>
    </div>
  );
}
export function ConnectedAudit() {
  const { data, error } = useApi<{
    data: {
      id: number;
      entity: string;
      action: string;
      entity_id: string;
      created_at: string;
    }[];
  }>("/audit");
  return (
    <div className="system-screen">
      <Panel title="Auditoria">
        <ErrorMessage error={error} />
        <DataTable
          headers={["Horário", "Entidade", "Registro", "Ação"]}
          rows={(data?.data || []).map((e) => [
            new Date(e.created_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            }),
            e.entity,
            e.entity_id,
            e.action,
          ])}
        />
      </Panel>
    </div>
  );
}
