import { useState } from "react";
import { api, stages, useApi, type Lead, type User } from "./api";
import { Button, DataTable, Panel, downloadCSV } from "./ui";
import { useAuth } from "./Auth";

export default function ConnectedReports({ screen }: { screen: string }) {
  const auth = useAuth();
  const result = useApi<{ data: Lead[] }>("/report-leads");
  const users = useApi<{ data: User[] }>("/resources/users");
  const [owner, setOwner] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [property, setProperty] = useState("");
  const [source, setSource] = useState("");
  const [failure, setFailure] = useState("");
  const invalidRange = !!(from && to && from > to);
  const leads = (result.data?.data || []).filter(
    (lead) =>
      !invalidRange &&
      (!owner || lead.owner_id === owner) &&
      (!source || lead.source === source) &&
      (!from || lead.created_at.slice(0, 10) >= from) &&
      (!to || lead.created_at.slice(0, 10) <= to) &&
      lead.product.toLocaleLowerCase().includes(property.toLocaleLowerCase()),
  );
  const closed = leads.filter((lead) => lead.stage === 5 && !lead.archived);
  const reportsByLead = [
    "Relatório de leads",
    "Acompanhamento de Uso",
    "Visitas e Negócios Fechados",
  ].includes(screen);
  const byProperty = screen === "Relatórios por imóvel";
  const byUser = screen === "Métricas de desempenho";
  const salesOnly = screen.startsWith("Negócio Fechado");
  const byNature = screen === "Negócio Fechado por natureza da negociação";
  const grouped = new Map<string, Lead[]>();
  for (const lead of leads) {
    const key = byNature
      ? lead.negotiation_type || "Indefinido"
      : byProperty
        ? lead.product
        : byUser
          ? lead.owner
          : lead.source;
    grouped.set(key, [...(grouped.get(key) || []), lead]);
  }
  const headers = reportsByLead
    ? ["Lead", "Imóvel / produto", "Responsável", "Origem", "Etapa", "Recebido em"]
    : [
        byNature
          ? "Natureza da negociação"
          : byProperty
            ? "Imóvel"
            : byUser
              ? "Responsável"
              : "Origem",
        "Recebidos",
        "Em operação",
        "Visitas",
        "Negócios fechados",
        "Valor fechado",
      ];
  const display =
    screen === "Visitas e Negócios Fechados"
      ? leads.filter((lead) => [2, 3, 5].includes(lead.stage))
      : leads;
  const rows: string[][] = reportsByLead
    ? display.map((lead) => [
        lead.name,
        lead.product,
        lead.owner,
        lead.source,
        lead.archived ? "Arquivado" : stages[lead.stage] || "Etapa não informada",
        new Date(lead.created_at).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
      ])
    : [...grouped.entries()]
        .filter(
          ([, group]) => !salesOnly || group.some((lead) => lead.stage === 5 && !lead.archived),
        )
        .map(([name, group]) => [
          name,
          String(group.length),
          String(group.filter((lead) => !lead.archived).length),
          String(group.filter((lead) => [2, 3].includes(lead.stage) && !lead.archived).length),
          String(group.filter((lead) => lead.stage === 5 && !lead.archived).length),
          group
            .filter((lead) => lead.stage === 5 && !lead.archived)
            .reduce((sum, lead) => sum + lead.value, 0)
            .toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        ]);
  return (
    <div className="system-screen reports">
      <h1>{screen}</h1>
      <Panel title="Filtros">
        <div className="toolbar">
          <label className="field">
            Responsável
            <select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="">Todos os responsáveis acessíveis</option>
              {users.data?.data.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            De
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            Até
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="field">
            Origem
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">Todas</option>
              {[...new Set(result.data?.data.map((lead) => lead.source))].map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Imóvel / produto
            <input
              value={property}
              onChange={(event) => setProperty(event.target.value)}
              placeholder="Pesquisar imóvel"
            />
          </label>
          <Button
            onClick={() => {
              setOwner("");
              setFrom("");
              setTo("");
              setProperty("");
              setSource("");
            }}
          >
            Limpar filtros
          </Button>
        </div>
        {invalidRange && (
          <p role="alert" className="api-error">
            A data inicial deve ser anterior à data final.
          </p>
        )}
      </Panel>
      <div className="three-columns">
        <Panel title="Leads no período">
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
          <strong className="metric">{result.loading ? "—" : closed.length}</strong>
        </Panel>
      </div>
      {screen === "Acompanhamento de Uso" && (
        <p className="notice">
          Este recorte mostra os leads acessíveis. Atividade e tempo de resposta não são estimados a
          partir da etapa.
        </p>
      )}
      {(result.error || failure) && (
        <p role="alert" className="api-error">
          {result.error || failure}
        </p>
      )}
      <Panel title="Registros do relatório">
        <Button
          disabled={!auth.can("reports.export")}
          onClick={() => downloadCSV("descomplica-lead-" + screen, headers, rows)}
        >
          Exportar CSV
        </Button>
        {result.loading ? (
          <p>Carregando relatório…</p>
        ) : (
          <DataTable headers={headers} rows={rows} />
        )}
      </Panel>
    </div>
  );
}
