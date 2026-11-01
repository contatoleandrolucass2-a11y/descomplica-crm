import { useState } from "react";
import { ArrowDownCircle, Trophy, ArrowRight, ChartColumn, Send, ThumbsUp } from "lucide-react";
import { Button, Modal } from "./ui";
import {
  Empty,
  LeadDrilldown,
  period,
  timeLabel,
  useAnalytics,
  type AnalyticsRecord,
  type AnalyticsPerson,
} from "./analytics";

export default function Management({ navigate }: { navigate: (route: string) => void }) {
  const result = useAnalytics(31, "/management");
  const [draft, setDraft] = useState(result.filters),
    [days, setDays] = useState("31");
  const [drill, setDrill] = useState<{ title: string; records: AnalyticsRecord[] } | null>(null);
  const [message, setMessage] = useState<{ name: string; text: string } | null>(null),
    [copied, setCopied] = useState(false);
  const data = result.data;
  const unanswered = [...(data?.team || [])]
    .filter((person) => person.unanswered > 0)
    .sort((a, b) => b.unanswered - a.unanswered);
  const fastest = [...(data?.team || [])]
    .filter((person) => person.firstResponse !== null)
    .sort((a, b) => a.firstResponse! - b.firstResponse!);
  const show = (title: string, records: AnalyticsRecord[]) => setDrill({ title, records });
  const forPerson = (person: AnalyticsPerson) =>
    data?.records.filter((lead) => lead.owner_id === person.id) || [];
  const contact = (person: AnalyticsPerson, celebrate: boolean) => {
    setCopied(false);
    setMessage({
      name: person.name,
      text: celebrate
        ? "Parabéns, " +
          person.name +
          "! Seu tempo de primeira resposta está entre os melhores do período: " +
          timeLabel(person.firstResponse) +
          "."
        : person.name +
          ", você possui " +
          person.unanswered +
          " leads sem resposta neste período. Confira os atendimentos pendentes no DESCOMPLICA LEAD.",
    });
  };
  return (
    <div className="system-screen analytics-screen management-overview">
      <header className="management-heading">
        <h1>Pronto para melhorar sua gestão?</h1>
        <strong>Nós podemos te ajudar!</strong>
      </header>
      <form
        className="management-filters"
        onSubmit={(event) => {
          event.preventDefault();
          result.setFilters(draft);
        }}
      >
        <select
          aria-label="Tipo de negociação da gestão"
          value={draft.negotiation}
          onChange={(event) => setDraft({ ...draft, negotiation: event.target.value })}
        >
          <option value="">Tipo de negociação…</option>
          {["Compra", "Locação", "Indefinido"].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <div className="management-period">
          <select
            aria-label="Período da gestão"
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
              if (event.target.value !== "custom")
                setDraft({ ...draft, ...period(Number(event.target.value)) });
            }}
          >
            {[7, 15, 31, 90, 180].map((value) => (
              <option key={value} value={String(value)}>
                Últimos {value} dias
              </option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
          <input
            aria-label="Data inicial da gestão"
            type="date"
            value={draft.from}
            max={draft.to}
            onChange={(event) => {
              setDays("custom");
              setDraft({ ...draft, from: event.target.value });
            }}
          />
          <input
            aria-label="Data final da gestão"
            type="date"
            value={draft.to}
            min={draft.from}
            onChange={(event) => {
              setDays("custom");
              setDraft({ ...draft, to: event.target.value });
            }}
          />
        </div>
        <Button primary type="submit">
          Filtrar
        </Button>
      </form>
      {result.error && (
        <p className="api-error" role="alert">
          {result.error} <Button onClick={() => void result.refresh()}>Tentar novamente</Button>
        </p>
      )}
      {result.loading && !data && <p role="status">Carregando gestão…</p>}
      {data && (
        <div className="management-cards">
          <article className="management-card">
            <h2>
              <ArrowDownCircle className="danger" size={20} />
              Usuários com mais leads sem respostas
            </h2>
            <div className="management-ranking">
              {unanswered.slice(0, 3).map((person, index) => (
                <div key={person.id}>
                  <span>{index + 1}</span>
                  <button
                    className="management-name"
                    title={person.name}
                    onClick={() => show(person.name, forPerson(person))}
                  >
                    {person.name}
                  </button>
                  <button
                    className="management-count"
                    onClick={() =>
                      show(
                        "Leads sem resposta · " + person.name,
                        forPerson(person).filter((lead) => lead.unanswered && !lead.archived),
                      )
                    }
                  >
                    {person.unanswered} leads
                  </button>
                  <button
                    className="management-small-action alert"
                    onClick={() => contact(person, false)}
                  >
                    <Send size={12} />
                    Alertar!
                  </button>
                </div>
              ))}
              {!unanswered.length && (
                <Empty>Nenhum usuário com leads sem resposta neste período.</Empty>
              )}
            </div>
            <footer>
              <button
                onClick={() =>
                  show(
                    "Leads sem resposta",
                    data.records.filter((lead) => lead.unanswered && !lead.archived),
                  )
                }
              >
                Ver todos
              </button>
            </footer>
          </article>
          <article className="management-card">
            <h2>
              <Trophy className="success" size={20} />
              Usuários com resposta mais rápida
            </h2>
            <div className="management-ranking fastest">
              {fastest.slice(0, 3).map((person, index) => (
                <div key={person.id}>
                  <span>{["🥇", "🥈", "🥉"][index]}</span>
                  <button
                    className="management-name"
                    title={person.name}
                    onClick={() => show(person.name, forPerson(person))}
                  >
                    {person.name}
                  </button>
                  <button
                    className="management-count"
                    onClick={() => show(person.name, forPerson(person))}
                  >
                    {person.received} leads
                  </button>
                  <span title="Mediana de primeira resposta">
                    {timeLabel(person.firstResponse)}
                  </span>
                  <button className="management-small-action" onClick={() => contact(person, true)}>
                    <ThumbsUp size={12} />
                    Parabenizar
                  </button>
                </div>
              ))}
              {!fastest.length && <Empty>Ainda não há respostas registradas neste período.</Empty>}
            </div>
            <footer>
              <button
                onClick={() =>
                  show(
                    "Leads com resposta registrada",
                    data.records.filter((lead) => !lead.unanswered),
                  )
                }
              >
                Ver todos
              </button>
            </footer>
          </article>
          <article className="management-card">
            <h2>Acompanhamento</h2>
            <div className="management-funnel">
              {[
                ["Recebidos", data.metrics.received],
                ["Em atendimento", data.currentStages[1]?.count || 0],
                ["Visita agendada", data.currentStages[2]?.count || 0],
                ["Visita realizada", data.currentStages[3]?.count || 0],
                ["Proposta criada", data.currentStages[4]?.count || 0],
              ].map(([label, count], index) => (
                <div key={label}>
                  <span
                    className="management-funnel-shape"
                    style={{
                      clipPath:
                        "polygon(" +
                        index * 6 +
                        "% 0," +
                        (100 - index * 6) +
                        "% 0," +
                        (100 - (index + 1) * 6) +
                        "% 100%," +
                        (index + 1) * 6 +
                        "% 100%)",
                      background: ["#f7a6ab", "#f5ba8c", "#f8e579", "#e9f46f", "#a9ed9d"][index],
                    }}
                  >
                    {count} (
                    {data.metrics.received
                      ? Math.round((Number(count) / data.metrics.received) * 100)
                      : 0}
                    %)
                  </span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
            <footer>
              <button onClick={() => navigate("Funil")}>Ver funil completo</button>
            </footer>
          </article>
          <article className="management-card management-general">
            <h2>Informações gerais</h2>
            <div>
              <strong>{timeLabel(data.metrics.meanResponse)}</strong>
              <p>Tempo médio de resposta</p>
              {data.metrics.meanResponse === null && (
                <small>Aguardando a primeira interação registrada.</small>
              )}
            </div>
          </article>
          <article className="management-card management-custom">
            <h2>
              Dashboards personalizados <span>Novo</span>
            </h2>
            <div>
              <ChartColumn size={36} />
              <p>
                Crie análises que façam sentido para <strong>SUA</strong> operação
              </p>
              <Button
                primary
                onClick={() => {
                  sessionStorage.setItem("lead-dashboard-section", "analyses");
                  navigate("Dashboards");
                }}
              >
                Começar agora <ArrowRight size={18} />
              </Button>
            </div>
          </article>
        </div>
      )}
      {drill && <LeadDrilldown {...drill} onClose={() => setDrill(null)} />}
      {message && (
        <Modal title={"Mensagem para " + message.name} onClose={() => setMessage(null)}>
          <p>Revise e copie a mensagem para enviar pelo seu canal de atendimento.</p>
          <textarea
            className="management-message"
            rows={5}
            value={message.text}
            onChange={(event) => {
              setCopied(false);
              setMessage({ ...message, text: event.target.value });
            }}
          />
          <Button
            primary
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(message.text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Mensagem copiada" : "Copiar mensagem"}
          </Button>
        </Modal>
      )}
    </div>
  );
}
