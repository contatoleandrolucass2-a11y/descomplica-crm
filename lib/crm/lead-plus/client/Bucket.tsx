import { useState } from "react";
import { Clock, Inbox, Search } from "lucide-react";
import { api, useApi, type Lead } from "./api";
import { useAuth } from "./Auth";
import { LeadDetail } from "./ConnectedCRM";
import { Button, Modal, Panel } from "./ui";

type Policy = {
  enabled: boolean;
  timeout_minutes: number | null;
  version: number | null;
};
type BucketData = { data: Lead[]; policy: Policy };

export function BucketSettings() {
  const { can } = useAuth();
  const { data, error, loading } = useApi<Policy>("/bucket/policy");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  return (
    <div className="system-screen">
      <Panel title="Ajustes do Bolsão">
        <p>
          Leads novos sem atendimento ficam disponíveis para usuários de outras equipes após o prazo
          definido.
        </p>
        {loading ? (
          <p>Carregando configuração…</p>
        ) : (
          data && (
            <form
              key={data.version ?? "new"}
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                const form = new FormData(event.currentTarget);
                setBusy(true);
                setNotice("");
                setFailure("");
                try {
                  await api("/bucket/policy", "PUT", {
                    enabled: form.get("enabled") === "on",
                    timeout_minutes: Number(form.get("minutes")),
                    version: data.version,
                  });
                  setNotice("Ajustes do Bolsão salvos no Supabase.");
                } catch (error) {
                  setFailure((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={busy || !can("bucket.manage")}>
                <label className="bucket-enable">
                  <input type="checkbox" name="enabled" defaultChecked={data.enabled} /> Ativar
                  entrada automática no Bolsão
                </label>
                <label className="field">
                  Prazo sem atendimento (minutos)
                  <input
                    name="minutes"
                    type="number"
                    min="1"
                    max="525600"
                    step="1"
                    required
                    defaultValue={data.timeout_minutes ?? ""}
                    placeholder="Defina o prazo da sua operação"
                  />
                </label>
                <p>
                  O prazo começa no recebimento ou na última atribuição. Somente leads na etapa
                  Novos leads, não arquivados e sem ligação, WhatsApp ou visita registrados entram
                  no Bolsão.
                </p>
                <p>
                  O resgate troca o responsável e reinicia o prazo. Se continuar sem atendimento, o
                  lead poderá voltar ao Bolsão. Alterar o prazo também afeta leads já recebidos.
                </p>
                <p>
                  A lista é atualizada automaticamente a cada 10 segundos enquanto a tela estiver
                  aberta.
                </p>
                <Button primary type="submit">
                  {busy ? "Salvando…" : "Salvar ajustes do Bolsão"}
                </Button>
              </fieldset>
            </form>
          )
        )}
        {(error || failure) && (
          <p className="api-error" role="alert">
            {error || failure}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </Panel>
    </div>
  );
}

export function ConnectedBucket({ navigate }: { navigate: (route: string) => void }) {
  const { data, error, loading, refresh } = useApi<BucketData>("/bucket");
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [claim, setClaim] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const leads = (data?.data ?? []).filter((lead) =>
    [lead.name, lead.product, lead.source, lead.owner, lead.owner_team]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="system-screen leads-screen bucket-screen">
      <div className="toolbar funnel-toolbar">
        <h2>Bolsão de leads</h2>
        <label className="bucket-search">
          <Search size={16} />
          <input
            aria-label="Buscar no Bolsão"
            placeholder="Nome, imóvel, responsável ou equipe"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="spacer" />
        <Button onClick={() => navigate("Ajustes do Bolsão")}>Ajustes do Bolsão</Button>
      </div>
      <p>Oportunidades sem atendimento no prazo, disponíveis para resgate entre equipes.</p>
      {data && (
        <div className="bucket-summary">
          <Inbox size={18} />
          <strong>{data.data.length} leads disponíveis</strong>
          <span>
            {data.policy.enabled
              ? `Prazo: ${data.policy.timeout_minutes} minutos`
              : "Entrada automática desativada"}
          </span>
        </div>
      )}
      {(error || failure) && (
        <p className="api-error" role="alert">
          {error || failure}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p>Carregando Bolsão…</p>
      ) : !data?.policy.enabled ? (
        <Panel title="Configure o Bolsão">
          <p>Defina o prazo e ative a entrada automática em Ajustes do Bolsão.</p>
        </Panel>
      ) : leads.length ? (
        <div className="lead-list">
          {leads.map((lead) => (
            <article key={lead.id} className="bucket-item">
              <button className="lead-list-item" onClick={() => setSelected(lead)}>
                <span className="avatar">{lead.name[0]}</span>
                <div>
                  <strong>{lead.name}</strong>
                  <span className="bucket-badge">
                    <Clock size={12} /> Sem atendimento dentro do prazo
                  </span>
                  <p>
                    {lead.product} · {lead.source}
                  </p>
                  <small>
                    Responsável anterior: {lead.owner}
                    {lead.owner_team ? ` · ${lead.owner_team}` : ""}
                  </small>
                  <small>
                    Disponível desde{" "}
                    {new Date(lead.bucket_available_at!).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </small>
                </div>
                <span>{lead.phone || lead.email}</span>
              </button>
              <button
                className="btn primary"
                disabled={!user}
                title={!user ? "O resgate usa o usuário autenticado no CRM" : undefined}
                onClick={() => {
                  setClaim(lead);
                  setFailure("");
                }}
              >
                Assumir lead
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Panel title="Nenhum lead disponível">
          <p>
            {query
              ? "Nenhum lead corresponde à busca."
              : "Os leads aparecerão aqui quando ficarem sem atendimento além do prazo configurado."}
          </p>
        </Panel>
      )}
      {selected && <LeadDetail lead={selected} onClose={() => setSelected(null)} />}
      {claim && (
        <Modal
          title="Assumir lead do Bolsão"
          onClose={() => {
            if (!busy) setClaim(null);
          }}
        >
          <p>
            <strong>{claim.name}</strong> será retirado do Bolsão e atribuído ao seu usuário
            autenticado.
          </p>
          <p>
            Responsável pelo atendimento: <strong>{user?.name}</strong> · {user?.email}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setFailure("");
              try {
                await api("/bucket/" + claim.id + "/claim", "POST", {
                  version: claim.version,
                });
                setNotice(
                  "Lead assumido e atribuído. Registre o atendimento antes de vencer o novo prazo.",
                );
                setClaim(null);
                await refresh();
              } catch (error) {
                setFailure((error as Error).message);
                void refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              {failure && (
                <p role="alert" className="api-error">
                  {failure}
                </p>
              )}
              <div className="modal-actions">
                <Button onClick={() => setClaim(null)}>Cancelar</Button>
                <Button primary type="submit">
                  {busy ? "Assumindo…" : "Confirmar resgate"}
                </Button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </div>
  );
}
