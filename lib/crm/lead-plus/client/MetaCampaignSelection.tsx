import { useEffect, useState } from "react";
import { api, LeadApiError } from "./api";
import { Button, Panel } from "./ui";

type Campaign = {
  id: string;
  name: string;
  status: string;
  account_id: string;
  account_name: string;
};
type Selection = { campaign_ids: string[]; version: number };
type Catalog = { data: Campaign[]; selection: Selection; available: boolean };

export default function MetaCampaignSelection() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const next = await api<Catalog>("/integrations/facebook/campaigns");
      setCatalog(next);
      setSelected(next.selection.campaign_ids);
      setConflict(false);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  const filtered = (catalog?.data || []).filter((item) =>
    (item.name + " " + item.id + " " + item.account_name)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const unavailable = !catalog?.available || loading || saving || conflict || !!error;
  return (
    <Panel title="Campanhas que enviam leads">
      <p>Selecione as campanhas autorizadas a enviar cadastros ao DESCOMPLICA LEAD.</p>
      <p>
        <strong>
          Somente cadastros de formulários; conversas WhatsApp não entram por esta conexão.
        </strong>
      </p>
      <p>Sem campanhas selecionadas, a captação fica pausada. Salvar não altera seus anúncios.</p>
      {loading && <p role="status">Carregando campanhas e seleção salva…</p>}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {conflict && (
        <p role="alert">
          A seleção foi alterada por outra pessoa. Recarregue a seleção salva antes de editar
          novamente.
        </p>
      )}
      {(error || conflict) && (
        <Button disabled={loading || saving} onClick={() => void load()}>
          Recarregar seleção salva
        </Button>
      )}
      {catalog && !loading && (
        <>
          {!catalog.available ? (
            <div>
              <p role="status">
                A consulta de campanhas está indisponível. A seleção salva será preservada.
              </p>
              <p>{catalog.selection.campaign_ids.length} campanhas na seleção salva.</p>
              <Button disabled={loading || saving} onClick={() => void load()}>
                Tentar consultar novamente
              </Button>
            </div>
          ) : (
            <>
              <label className="field">
                Buscar campanha ou conta
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome ou ID da campanha"
                />
              </label>
              <p>
                {selected.length} campanhas selecionadas
                {selected.length === 0 ? " · Captação pausada" : ""}
              </p>
              <div
                style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto", minWidth: 0 }}
              >
                {filtered.map((campaign) => (
                  <label
                    key={campaign.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      border: "1px solid var(--analytics-line)",
                      borderRadius: 10,
                      padding: 12,
                      minWidth: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, minHeight: 18, flexShrink: 0, marginTop: 3 }}
                      checked={selected.includes(campaign.id)}
                      disabled={unavailable}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...new Set([...current, campaign.id])]
                            : current.filter((id) => id !== campaign.id),
                        )
                      }
                    />
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      <strong>{campaign.name}</strong>
                      <br />
                      <small>
                        {campaign.account_name || campaign.account_id} · {campaign.status} ·{" "}
                        {campaign.id}
                      </small>
                    </span>
                  </label>
                ))}
                {!filtered.length && (
                  <p role="status">
                    {catalog.data.length
                      ? "Nenhuma campanha corresponde à busca."
                      : "Nenhuma campanha disponível na conta conectada."}
                  </p>
                )}
              </div>
              <p>IDs selecionados: {selected.length ? selected.join(", ") : "nenhum"}</p>
            </>
          )}
          <Button
            primary
            disabled={unavailable}
            onClick={async () => {
              setSaving(true);
              setError("");
              setNotice("");
              try {
                const saved = await api<{ selection: Selection }>(
                  "/integrations/facebook/campaigns",
                  "PUT",
                  { campaign_ids: selected, version: catalog.selection.version },
                );
                setCatalog({ ...catalog, selection: saved.selection });
                setSelected(saved.selection.campaign_ids);
                setNotice(
                  saved.selection.campaign_ids.length
                    ? "Seleção salva. A entrada de leads respeitará estas campanhas."
                    : "Seleção salva. Captação pausada.",
                );
              } catch (failure) {
                if (failure instanceof LeadApiError && failure.status === 409) setConflict(true);
                else setError((failure as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando…" : "Salvar campanhas"}
          </Button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </Panel>
  );
}
