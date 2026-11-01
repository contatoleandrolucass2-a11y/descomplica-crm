import { useState } from "react";
import { useApi, type Lead } from "./api";
import { Button, DataTable, Panel, downloadCSV } from "./ui";

import { useAuth } from "./Auth";

export default function MetaDashboard() {
  const auth = useAuth();
  const result = useApi<{ data: Lead[] }>("/report-leads");
  const [now] = useState(Date.now);
  const [days, setDays] = useState(30);
  const [campaign, setCampaign] = useState("");
  const meta = (result.data?.data || []).filter(
    (lead) =>
      ["facebook", "instagram"].includes(lead.source) &&
      new Date(lead.created_at).getTime() >= now - days * 86400000,
  );
  const name = (lead: Lead) =>
    lead.attribution?.campaign_name || lead.attribution?.campaign_id || "Campanha não identificada";
  const groups = [...new Set(meta.map(name))];
  const leads = meta.filter((lead) => !campaign || name(lead) === campaign);
  const headers = ["Campanha", "Leads recebidos", "Visitas", "Negócios fechados", "Arquivados"];
  const rows = groups
    .filter((group) => !campaign || campaign === group)
    .map((group) => {
      const current = leads.filter((lead) => name(lead) === group);
      return [
        group,
        String(current.length),
        String(current.filter((lead) => [2, 3].includes(lead.stage) && !lead.archived).length),
        String(current.filter((lead) => lead.stage === 5 && !lead.archived).length),
        String(current.filter((lead) => lead.archived).length),
      ];
    });
  return (
    <div className="system-screen meta-dashboard">
      <h1>Dashboard Meta</h1>
      <p>Atendimentos recebidos pelo Facebook e Instagram, com dados do DESCOMPLICA LEAD.</p>
      <Panel title="Filtros">
        <div className="toolbar">
          <label className="field">
            Período
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[7, 15, 30, 90, 180].map((days) => (
                <option key={days} value={days}>
                  Últimos {days} dias
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Campanha
            <select value={campaign} onChange={(event) => setCampaign(event.target.value)}>
              <option value="">Todas as campanhas identificadas</option>
              {groups.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </label>
          <Button
            disabled={!auth.can("reports.export")}
            onClick={() => downloadCSV("descomplica-lead-meta", headers, rows)}
          >
            Exportar CSV
          </Button>
          {auth.can("crm.settings.manage") && (
            <a className="btn" href="#Integra%C3%A7%C3%B5es">
              Configurar integração Meta
            </a>
          )}
        </div>
      </Panel>
      <div className="three-columns">
        <Panel title="Leads recebidos">
          <strong className="metric">{result.loading ? "—" : leads.length}</strong>
        </Panel>
        <Panel title="Visitas agendadas / realizadas">
          <strong className="metric">
            {result.loading
              ? "—"
              : leads.filter((lead) => [2, 3].includes(lead.stage) && !lead.archived).length}
          </strong>
        </Panel>
        <Panel title="Negócios fechados">
          <strong className="metric">
            {result.loading
              ? "—"
              : leads.filter((lead) => lead.stage === 5 && !lead.archived).length}
          </strong>
        </Panel>
      </div>
      <p className="notice">
        Investimento, alcance e custo por lead dependem de um conector de métricas de anúncios.
        Nenhum valor é estimado quando esses dados não estão disponíveis.
      </p>
      {result.error && (
        <p role="alert" className="api-error">
          {result.error}
        </p>
      )}
      <Panel title="Campanhas e atendimento">
        {result.loading ? <p>Carregando…</p> : <DataTable headers={headers} rows={rows} />}
      </Panel>
    </div>
  );
}
