import { useState, type ReactNode } from "react";
import { api, sourceLabel, stages, useApi, type Lead } from "./api";
import { Button, DataTable, Modal } from "./ui";
import { LeadDetail } from "./ConnectedCRM";
import { Info, Check, ChevronRight } from "lucide-react";

export type AnalyticsFilters = {
  from: string;
  to: string;
  team: string;
  owner: string;
  source: string;
  negotiation: string;
  queue: string;
};
export type AnalyticsRecord = {
  id: string;
  name: string;
  owner: string;
  owner_id: string;
  source: string;
  product: string;
  stage: number;
  archived: boolean;
  unanswered: boolean;
  sameDay: boolean;
  bucket: boolean;
  overdue: boolean;
  hour: string;
};
export type AnalyticsPerson = {
  id: string;
  name: string;
  team: string;
  received: number;
  unanswered: number;
  firstResponse: number | null;
  bucket: number;
};
export type Group = { name: string; count: number };
type Metrics = {
  received: number;
  firstResponse: number | null;
  meanResponse: number | null;
  sameDay: number;
  closed: number;
};
export type AnalyticsData = {
  generatedAt: string;
  filters: AnalyticsFilters;
  previousPeriod: { from: string; to: string };
  metrics: Metrics;
  previous: Metrics;
  timeline: { date: string; label: string; received: number; interacted: number }[];
  team: AnalyticsPerson[];
  funnel: { stage: number; count: number }[];
  currentStages: { stage: number; count: number }[];
  transitions: { from: number; to: number; minutes: number; count: number }[];
  reasons: Group[];
  sources: Group[];
  products: Group[];
  negotiations: Group[];
  hours: Group[];
  needsAttention: { overdue: number; bucket: number };
  records: AnalyticsRecord[];
  options: {
    teams: string[];
    users: { id: string; name: string; team: string }[];
    sources: string[];
    queues: string[];
  };
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
export function period(days: number) {
  const to = today();
  return {
    to,
    from: new Date(Date.parse(to + "T12:00:00Z") - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10),
  };
}
export function useAnalytics(days = 30, endpoint = "/analytics") {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    ...period(days),
    team: "",
    owner: "",
    source: "",
    negotiation: "",
    queue: "",
  });
  const query = new URLSearchParams(filters).toString();
  const result = useApi<AnalyticsData>(endpoint + "?" + query);
  return { ...result, filters, setFilters };
}
export function timeLabel(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return Math.round(minutes) + " min";
  if (minutes < 1440) return Math.round((minutes / 60) * 10) / 10 + " h";
  return Math.round((minutes / 1440) * 10) / 10 + " dias";
}
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="analytics-info" tabIndex={0} role="img" aria-label={text} title={text}>
      <Info size={14} />
    </span>
  );
}
export function Card({
  title,
  hint,
  children,
  actions,
  className = "",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <article className={"analytics-card " + className}>
      <header>
        <h3>
          {title} {hint && <InfoTip text={hint} />}
        </h3>
        {actions}
      </header>
      {children}
    </article>
  );
}
export function Empty({ children = "Sem dados neste período." }: { children?: ReactNode }) {
  return <p className="analytics-empty">{children}</p>;
}
export function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="analytics-section-heading">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}
export function AnalyticsFiltersBar({
  filters,
  onChange,
  data,
}: {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  data: AnalyticsData | null;
}) {
  const [preset, setPreset] = useState("30");
  const change = (key: keyof AnalyticsFilters, value: string) =>
    onChange({ ...filters, [key]: value, ...(key === "team" ? { owner: "" } : {}) });
  return (
    <div className="analytics-filters">
      <select
        aria-label="Período do dashboard"
        value={preset}
        onChange={(event) => {
          setPreset(event.target.value);
          if (event.target.value !== "custom")
            onChange({ ...filters, ...period(Number(event.target.value)) });
        }}
      >
        {[7, 15, 30, 90, 180].map((days) => (
          <option key={days} value={String(days)}>
            Últimos {days} dias
          </option>
        ))}
        <option value="custom">Período personalizado</option>
      </select>
      {preset === "custom" && (
        <>
          <input
            aria-label="Data inicial"
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(event) => change("from", event.target.value)}
          />
          <input
            aria-label="Data final"
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(event) => change("to", event.target.value)}
          />
        </>
      )}
      <select
        aria-label="Equipe"
        value={filters.team}
        onChange={(event) => change("team", event.target.value)}
      >
        <option value="">Todas as equipes</option>
        {data?.options.teams.map((team) => (
          <option key={team}>{team}</option>
        ))}
      </select>
      <select
        aria-label="Tipo de negociação"
        value={filters.negotiation}
        onChange={(event) => change("negotiation", event.target.value)}
      >
        <option value="">Tipo de negociação</option>
        {["Compra", "Locação", "Indefinido"].map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <select
        aria-label="Corretor"
        value={filters.owner}
        onChange={(event) => change("owner", event.target.value)}
      >
        <option value="">Corretor</option>
        {data?.options.users
          .filter((user) => !filters.team || user.team === filters.team)
          .map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
      </select>
      <select
        aria-label="Fonte"
        value={filters.source}
        onChange={(event) => change("source", event.target.value)}
      >
        <option value="">Fonte</option>
        {data?.options.sources.map((source) => (
          <option key={source} value={source}>
            {sourceLabel(source)}
          </option>
        ))}
      </select>
      <select
        aria-label="Fila de distribuição"
        value={filters.queue}
        onChange={(event) => change("queue", event.target.value)}
      >
        <option value="">Fila de distribuição</option>
        {data?.options.queues.map((queue) => (
          <option key={queue}>{queue}</option>
        ))}
      </select>
      <span className="analytics-freshness">
        <i />
        {data
          ? "Atualizado às " +
            new Date(data.generatedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Carregando indicadores…"}
      </span>
    </div>
  );
}
export function GroupBars({
  groups,
  labels = false,
  onClick,
}: {
  groups: Group[];
  labels?: boolean;
  onClick?: (name: string) => void;
}) {
  const max = Math.max(1, ...groups.map((group) => group.count));
  if (!groups.length || !groups.some((group) => group.count)) return <Empty />;
  return (
    <div className="analytics-bars">
      {groups.map((group) => (
        <button
          key={group.name}
          type="button"
          disabled={!onClick}
          onClick={() => onClick?.(group.name)}
        >
          <span title={group.name}>{labels ? sourceLabel(group.name) : group.name}</span>
          <span className="analytics-bar-track">
            <i style={{ width: (group.count / max) * 100 + "%" }} />
          </span>
          <strong>{group.count}</strong>
        </button>
      ))}
    </div>
  );
}
export function LeadDrilldown({
  title,
  records,
  onClose,
}: {
  title: string;
  records: AnalyticsRecord[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Lead | null>(null),
    [error, setError] = useState("");
  if (selected) return <LeadDetail lead={selected} onClose={() => setSelected(null)} />;
  return (
    <Modal title={title} onClose={onClose} className="analytics-leads-modal">
      <p>{records.length} leads no recorte selecionado</p>
      {error && <p role="alert">{error}</p>}
      <DataTable
        headers={["Lead", "Responsável", "Etapa", ""]}
        rows={records.map((lead) => [
          lead.name,
          lead.owner,
          stages[lead.stage],
          <Button
            key={lead.id}
            onClick={async () => {
              try {
                setSelected(await api<Lead>("/leads/" + lead.id));
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            Abrir <ChevronRight size={14} />
          </Button>,
        ])}
      />
    </Modal>
  );
}
export function Attention({
  data,
  onSelect,
}: {
  data: AnalyticsData;
  onSelect: (title: string, records: AnalyticsRecord[]) => void;
}) {
  return (
    <Card
      title="Precisa de você"
      hint="Leads do período sem interação de ligação, WhatsApp ou visita."
    >
      <p>
        {data.needsAttention.overdue || data.needsAttention.bucket
          ? "Pontos de atenção neste recorte"
          : "Nada pendente neste recorte"}
      </p>
      <button
        className="analytics-attention-row"
        onClick={() =>
          onSelect(
            "Leads sem resposta",
            data.records.filter((lead) => lead.overdue),
          )
        }
      >
        <Check size={18} />
        <span>
          {data.needsAttention.overdue
            ? data.needsAttention.overdue + " leads sem resposta há mais de 24h"
            : "Nenhum lead sem resposta há mais de 24h"}
        </span>
        <small>{data.needsAttention.overdue ? "Ver leads" : "tudo em ordem"}</small>
      </button>
      {data.needsAttention.bucket > 0 && (
        <button
          className="analytics-attention-row"
          onClick={() =>
            onSelect(
              "Leads no Bolsão",
              data.records.filter((lead) => lead.bucket),
            )
          }
        >
          <Info size={18} />
          <span>{data.needsAttention.bucket} leads disponíveis no Bolsão</span>
          <small>Ver leads</small>
        </button>
      )}
    </Card>
  );
}
