import { workspaceDocument } from "./workspace-document";
import { useEffect, useState } from "react";
import { LayoutDashboard, ChartNoAxesCombined, FolderDown, CheckCircle2, Plus } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api, stages, sourceLabel, useApi, type Resource } from "./api";
import { useAuth } from "./Auth";
import { Button, DataTable, Modal } from "./ui";
import {
  AnalyticsFiltersBar,
  Attention,
  Card,
  Empty,
  GroupBars,
  LeadDrilldown,
  SectionHeading,
  InfoTip,
  timeLabel,
  useAnalytics,
  type AnalyticsRecord,
  type AnalyticsData,
} from "./analytics";

const sections = [
  ["operation", "Operação"],
  ["funnel", "Funil"],
  ["team", "Time e bolsão"],
  ["demand", "Demanda"],
  ["analyses", "Minhas análises"],
];
const humanDate = (value: string) => value.slice(8, 10) + "/" + value.slice(5, 7);
type Analysis = {
  id: string;
  title: string;
  dimension: "sources" | "hours" | "funnel" | "team";
  metric: "received" | "closed";
};
export default function OperationDashboard() {
  const auth = useAuth();
  const result = useAnalytics();
  const [active, setActive] = useState("operation");
  const [drill, setDrill] = useState<{ title: string; records: AnalyticsRecord[] } | null>(null);
  const [builder, setBuilder] = useState<Analysis | null>(null),
    [saving, setSaving] = useState(false),
    [failure, setFailure] = useState("");
  const profiles = useApi<{ data: Resource[] }>("/resources/profile");
  const profile = profiles.data?.data[0];
  const saved = (profile?.dashboard_analyses as Analysis[] | undefined) || [];
  const data = result.data;
  useEffect(() => {
    if (data && sessionStorage.getItem("lead-dashboard-section") === "analyses") {
      sessionStorage.removeItem("lead-dashboard-section");
      const frame = requestAnimationFrame(() => {
        setActive("analyses");
        workspaceDocument()
          .getElementById("analytics-analyses")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [data]);

  const select = (title: string, records: AnalyticsRecord[]) => setDrill({ title, records });
  const scroll = (id: string) => {
    setActive(id);
    workspaceDocument()
      .getElementById("analytics-" + id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const newAnalysis = (dimension: Analysis["dimension"], title: string) =>
    setBuilder({ id: crypto.randomUUID(), dimension, title, metric: "received" });
  const sampleAnalysis = builder && data ? analysisGroups(data, builder) : [];
  return (
    <div className="system-screen analytics-screen operation-dashboard">
      <nav className="analytics-top-tabs" aria-label="Páginas de dashboards">
        <a aria-current="page" href="#Dashboards">
          <LayoutDashboard size={18} />
          Dashboards
        </a>
        <a href="#Dashboard%20Meta">
          <ChartNoAxesCombined size={18} />
          Dashboard Meta
        </a>
        {auth.can("reports.export") && (
          <a href="#Minhas%20exporta%C3%A7%C3%B5es">
            <FolderDown size={18} />
            Minhas exportações
          </a>
        )}
      </nav>
      <span className="analytics-product-tag">DESCOMPLICA LEAD</span>
      <div className="analytics-sticky">
        <div className="analytics-section-tabs" role="tablist" aria-label="Seções do dashboard">
          {sections.map(([id, title]) => (
            <button
              role="tab"
              aria-selected={active === id}
              key={id}
              onClick={() => scroll(id || "")}
            >
              {title}
            </button>
          ))}
        </div>
        <AnalyticsFiltersBar filters={result.filters} onChange={result.setFilters} data={data} />
      </div>
      {result.error && (
        <p role="alert" className="api-error">
          {result.error} <Button onClick={() => void result.refresh()}>Tentar novamente</Button>
        </p>
      )}
      {!data && result.loading && <p role="status">Carregando indicadores…</p>}
      {data && (
        <>
          <section id="analytics-operation" className="analytics-section">
            <SectionHeading
              title="Como está minha operação"
              subtitle={
                "Comparado com " +
                humanDate(data.previousPeriod.from) +
                " – " +
                humanDate(data.previousPeriod.to) +
                " · clique em qualquer indicador para ver os leads"
              }
            />
            <div className="analytics-kpis">
              {[
                {
                  label: "Leads recebidos",
                  value: String(data.metrics.received),
                  previous: data.previous.received,
                  current: data.metrics.received,
                  records: data.records,
                  hint: "Leads criados no período selecionado.",
                  spark: true,
                },
                {
                  label: "Tempo até a 1ª resposta",
                  value: timeLabel(data.metrics.firstResponse),
                  previous: null,
                  current: null,
                  records: data.records.filter((lead) => !lead.unanswered),
                  hint: "Mediana entre a criação do lead e a primeira ligação, WhatsApp ou visita registrados.",
                },
                {
                  label: "Interagidos no mesmo dia",
                  value:
                    data.metrics.sameDay.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
                    "%",
                  previous: data.previous.sameDay,
                  current: data.metrics.sameDay,
                  records: data.records.filter((lead) => lead.sameDay),
                  hint: "Percentual dos recebidos com primeira interação no mesmo dia, no fuso de São Paulo.",
                  percent: true,
                  spark: true,
                },
                {
                  label: "Negócios fechados",
                  value: String(data.metrics.closed),
                  previous: data.previous.closed,
                  current: data.metrics.closed,
                  records: data.records.filter((lead) => lead.stage === 5 && !lead.archived),
                  hint: "Leads recebidos no período que estão em negócio fechado.",
                },
              ].map((metric) => (
                <button
                  className="analytics-kpi"
                  key={metric.label}
                  onClick={() => select(metric.label, metric.records)}
                >
                  <span className="analytics-kpi-title">
                    {metric.label} <InfoTip text={metric.hint} />
                  </span>
                  <strong>{metric.value}</strong>
                  {metric.current !== null && (
                    <small className={metric.current > (metric.previous || 0) ? "positive" : ""}>
                      {metric.previous
                        ? (metric.percent
                            ? (metric.current - metric.previous).toLocaleString("pt-BR", {
                                maximumFractionDigits: 1,
                              }) + " p.p."
                            : ((metric.current / metric.previous - 1) * 100).toLocaleString(
                                "pt-BR",
                                { maximumFractionDigits: 1 },
                              ) + "%") + " no período"
                        : metric.current
                          ? "Sem base anterior"
                          : "Sem movimento no período"}
                    </small>
                  )}
                  {metric.spark && data.metrics.received > 0 && (
                    <svg className="analytics-spark" viewBox="0 0 160 32" aria-hidden="true">
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        points={data.timeline
                          .map(
                            (point, index, list) =>
                              (index / Math.max(1, list.length - 1)) * 160 +
                              "," +
                              (30 -
                                (point.received /
                                  Math.max(1, ...list.map((point) => point.received))) *
                                  28),
                          )
                          .join(" ")}
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <div className="analytics-operation-grid">
              <Card
                title="Leads recebidos × interagidos"
                hint="Coorte de leads criados em cada dia; interagidos possuem ao menos uma interação registrada."
                actions={<small>Mesmo período · mesma escala</small>}
              >
                <div className="analytics-line-chart">
                  <ResponsiveContainer width="100%" height={270}>
                    <AreaChart data={data.timeline}>
                      <CartesianGrid vertical={false} stroke="var(--header-line)" />
                      <XAxis
                        dataKey="label"
                        minTickGap={65}
                        tick={{ fontSize: 11, fill: "var(--analytics-muted)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                        tick={{ fontSize: 11, fill: "var(--analytics-muted)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--analytics-surface)",
                          borderColor: "var(--header-line)",
                          color: "var(--analytics-ink)",
                          borderRadius: 8,
                        }}
                      />
                      <Area
                        name="Recebidos"
                        dataKey="received"
                        stroke="#4285ff"
                        fill="#4285ff"
                        fillOpacity={0.07}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <Area
                        name="Interagidos"
                        dataKey="interacted"
                        stroke="#92b8f4"
                        strokeDasharray="5 5"
                        fill="transparent"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="analytics-legend">
                  <span>
                    <i />
                    Recebidos
                  </span>
                  <span>
                    <i />
                    Interagidos
                  </span>
                </div>
              </Card>
              <Attention data={data} onSelect={select} />
            </div>
          </section>
          <section id="analytics-funnel" className="analytics-section">
            <SectionHeading
              title="Onde a operação perde leads"
              subtitle="Novos leads do período e quantos passaram por cada etapa"
            />
            <Card
              title="Funil"
              hint="Etapas efetivamente registradas no histórico. Pular uma etapa não conta como passagem por ela."
              actions={
                <a className="btn" href="#Funil">
                  Ver no funil
                </a>
              }
            >
              <div className="analytics-funnel">
                {data.funnel.map((step, index) => (
                  <button
                    key={step.stage}
                    onClick={() =>
                      select(
                        stages[step.stage] || "Etapa",
                        data.records.filter((lead) => lead.stage === step.stage),
                      )
                    }
                  >
                    <div>
                      <span>{stages[step.stage]}</span>
                      <strong>{step.count}</strong>
                    </div>
                    <span className="analytics-funnel-bar">
                      <i
                        style={{
                          width: data.metrics.received
                            ? (step.count / data.metrics.received) * 100 + "%"
                            : "0%",
                          opacity: 1 - index * 0.1,
                        }}
                      />
                    </span>
                    <small>
                      {data.metrics.received
                        ? Math.round((step.count / data.metrics.received) * 100)
                        : 0}
                      % dos recebidos
                    </small>
                  </button>
                ))}
              </div>
              <p className="analytics-footnote">
                Barras mostram passagens registradas. Clique para consultar os leads atualmente na
                etapa.
              </p>
            </Card>
            <div className="analytics-two-columns">
              <Card
                title="Motivos de arquivamento"
                hint="Motivo informado no último arquivamento dos leads atualmente arquivados."
              >
                <p>Top 4 + demais agrupados</p>
                <GroupBars groups={topReasons(data.reasons)} />
              </Card>
              <Card
                title="Tempo entre etapas"
                hint="Mediana do tempo em cada transição registrada, sem inferir etapas puladas."
              >
                <p>Metade dos leads levou até este tempo para avançar</p>
                {data.transitions.length ? (
                  data.transitions.map((step) => (
                    <div className="analytics-transition" key={step.from + ":" + step.to}>
                      <span>
                        {stages[step.from]} → {stages[step.to]}
                      </span>
                      <strong>{timeLabel(step.minutes)}</strong>
                    </div>
                  ))
                ) : (
                  <Empty>Ainda não há transições registradas no período.</Empty>
                )}
              </Card>
            </div>
          </section>
          <section id="analytics-team" className="analytics-section">
            <SectionHeading
              title="Como o time está atendendo"
              subtitle="Uma linha por pessoa · somente leitura"
            />
            <Card
              title="Time e bolsão"
              hint="Recebimentos agrupados pelo responsável atual e respeitando seu acesso."
            >
              <p>Recebidos, sem resposta e 1ª resposta por pessoa</p>
              <DataTable
                headers={["Pessoa", "Leads recebidos", "Sem resposta", "1ª resposta", "Bolsão"]}
                rows={data.team.map((person) => [
                  <button
                    key={person.id}
                    className="analytics-text-button"
                    onClick={() =>
                      select(
                        person.name,
                        data.records.filter((lead) => lead.owner_id === person.id),
                      )
                    }
                  >
                    {person.name}
                  </button>,
                  person.received,
                  person.unanswered,
                  timeLabel(person.firstResponse),
                  person.bucket,
                ])}
              />
              <p>{data.team.length} pessoas no período</p>
            </Card>
            <Card title="Destaques do período">
              <p>
                Metade dos leads da pessoa foi respondida em até este tempo · só entra quem recebeu
                10 leads ou mais
              </p>
              <div className="analytics-highlights">
                {data.team
                  .filter((person) => person.received >= 10 && person.firstResponse !== null)
                  .sort((a, b) => a.firstResponse! - b.firstResponse!)
                  .slice(0, 3)
                  .map((person) => (
                    <button
                      key={person.id}
                      onClick={() =>
                        select(
                          person.name,
                          data.records.filter((lead) => lead.owner_id === person.id),
                        )
                      }
                    >
                      <span className="analytics-person">
                        <i>
                          {person.name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </i>
                        {person.name}
                      </span>
                      <strong>{timeLabel(person.firstResponse)}</strong>
                      <small>mediana de 1ª resposta em {person.received} leads</small>
                    </button>
                  ))}
              </div>
              {!data.team.some(
                (person) => person.received >= 10 && person.firstResponse !== null,
              ) && <Empty>Nenhuma pessoa com volume e histórico suficientes neste período.</Empty>}
            </Card>
          </section>
          <section id="analytics-demand" className="analytics-section">
            <SectionHeading
              title="De onde vem a demanda"
              subtitle="De onde vêm os leads e em que horário chegam"
            />
            <Card title="Fontes com mais leads" hint="Fonte registrada no recebimento do lead.">
              <p>No período selecionado</p>
              <GroupBars
                groups={data.sources}
                labels
                onClick={(name) =>
                  select(
                    name,
                    data.records.filter((lead) => lead.source === name),
                  )
                }
              />
            </Card>
            <Card
              title="Horários de chegada"
              hint="Horário de São Paulo; volume de criação dos leads no período."
            >
              <div className="analytics-hours">
                {data.hours.map((group) => (
                  <div key={group.name} title={group.name + ": " + group.count + " leads"}>
                    <span
                      style={{
                        height:
                          (group.count / Math.max(1, ...data.hours.map((item) => item.count))) *
                            90 +
                          2 +
                          "px",
                      }}
                    />
                    <small>{group.name}</small>
                  </div>
                ))}
              </div>
            </Card>
          </section>
          <section id="analytics-analyses" className="analytics-section">
            <SectionHeading
              title="Minhas análises"
              subtitle="Perguntas prontas e análises salvas no seu perfil"
            />
            <div className="analytics-two-columns">
              <Card
                title="Perguntas prontas"
                actions={
                  <Button onClick={() => newAnalysis("sources", "Nova análise")}>
                    <Plus size={14} />
                    Criar análise do zero
                  </Button>
                }
              >
                <p>Clique para ver a resposta. Salve para acompanhar ou ajuste no construtor.</p>
                <div className="analytics-questions">
                  <Button
                    onClick={() => newAnalysis("sources", "Qual fonte traz os melhores leads?")}
                  >
                    Qual fonte traz os melhores leads?
                  </Button>
                  <Button
                    onClick={() => newAnalysis("hours", "Qual horário concentra meus leads?")}
                  >
                    Qual horário concentra meus leads?
                  </Button>
                  <Button onClick={() => newAnalysis("funnel", "Onde perco mais leads no funil?")}>
                    Onde perco mais leads no funil?
                  </Button>
                </div>
              </Card>
              <Card title="Análises salvas">
                <p>Disponíveis no seu perfil, respeitando o recorte e as permissões atuais</p>
                {saved.length ? (
                  saved.map((item) => (
                    <div className="analytics-saved" key={item.id}>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.metric === "closed" ? "Negócios fechados" : "Leads recebidos"} ·
                          período selecionado
                        </small>
                      </span>
                      <Button onClick={() => setBuilder(item)}>Abrir</Button>
                    </div>
                  ))
                ) : (
                  <Empty>Nenhuma análise salva.</Empty>
                )}
              </Card>
            </div>
          </section>
        </>
      )}
      {drill && <LeadDrilldown {...drill} onClose={() => setDrill(null)} />}
      {builder && (
        <Modal title="Construtor de análise" onClose={() => setBuilder(null)}>
          <div className="analytics-builder">
            <label className="field">
              Nome da análise
              <input
                value={builder.title}
                maxLength={120}
                onChange={(event) => setBuilder({ ...builder, title: event.target.value })}
              />
            </label>
            <label className="field">
              Agrupar por
              <select
                value={builder.dimension}
                onChange={(event) =>
                  setBuilder({ ...builder, dimension: event.target.value as Analysis["dimension"] })
                }
              >
                <option value="sources">Fonte</option>
                <option value="hours">Horário</option>
                <option value="funnel">Etapa atual</option>
                <option value="team">Responsável</option>
              </select>
            </label>
            <label className="field">
              Indicador
              <select
                value={builder.metric}
                onChange={(event) =>
                  setBuilder({ ...builder, metric: event.target.value as Analysis["metric"] })
                }
              >
                <option value="received">Leads recebidos</option>
                <option value="closed">Negócios fechados</option>
              </select>
            </label>
            <GroupBars groups={sampleAnalysis} />
            {failure && <p role="alert">{failure}</p>}
            <Button
              primary
              disabled={saving || !builder.title.trim() || profiles.loading || !!profiles.error}
              onClick={async () => {
                setSaving(true);
                try {
                  const { id: _id, version, ...current } = profile || {};
                  await api("/resources/profile/" + (auth.user?.id || "local-preview"), "PUT", {
                    ...current,
                    version,
                    dashboard_analyses: [
                      ...saved.filter((item) => item.id !== builder.id),
                      { ...builder, title: builder.title.trim() },
                    ].slice(-50),
                  });
                  await profiles.refresh();
                  setFailure("");
                  setBuilder(null);
                } catch (error) {
                  setFailure((error as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Salvar análise <CheckCircle2 size={15} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function topReasons(groups: { name: string; count: number }[]) {
  return groups.length <= 4
    ? groups
    : [
        ...groups.slice(0, 4),
        {
          name: "Demais motivos",
          count: groups.slice(4).reduce((sum, item) => sum + item.count, 0),
        },
      ];
}
function analysisGroups(data: AnalyticsData, analysis: Analysis) {
  const records = data.records.filter(
    (lead) => analysis.metric === "received" || (lead.stage === 5 && !lead.archived),
  );

  const key = (lead: AnalyticsRecord) =>
    analysis.dimension === "hours"
      ? lead.hour
      : analysis.dimension === "sources"
        ? sourceLabel(lead.source)
        : analysis.dimension === "team"
          ? lead.owner
          : stages[lead.stage] || "Etapa não informada";
  return [...new Set(records.map(key))]
    .map((name) => ({ name, count: records.filter((lead) => key(lead) === name).length }))
    .sort((a, b) => b.count - a.count);
}
