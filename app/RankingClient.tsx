"use client";
import { useEffect, useMemo, useState } from "react";
import type { DashboardFilterRecord, DashboardPayload } from "./types";

export type RankingWeights = {
  roulette: number;
  schedule: number;
  visit: number;
  approvedFolder: number;
  sale: number;
};

type RankingPeriod = "month" | "lastWeek" | "week" | "today";
type ScoreLine = {
  name: string;
  manager: string;
  roulette: number;
  schedule: number;
  visit: number;
  approvedFolder: number;
  sale: number;
  baseScore: number;
  bonus: number;
  total: number;
  conversion: number;
};

const periodLabels: Record<RankingPeriod, string> = { month: "Mês atual", lastWeek: "Semana passada", week: "Esta semana", today: "Hoje" };
const presentationPeriods = Object.keys(periodLabels) as RankingPeriod[];
const TARGET_AGENCY = "DIRECIONAL VENDAS SPC";
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function localDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(value: Date) {
  const result = new Date(value);
  const day = value.getDay();
  result.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  result.setHours(0, 0, 0, 0);
  return result;
}

function isInPeriod(record: DashboardFilterRecord, period: RankingPeriod, referenceDate: string) {
  if (!record.date) return false;
  const date = localDate(record.date);
  const reference = localDate(referenceDate);
  if (period === "today") return date.getTime() === reference.getTime();
  if (period === "week") return date >= startOfWeek(reference) && date <= reference;
  if (period === "lastWeek") {
    const currentWeekStart = startOfWeek(reference);
    const previousWeekStart = new Date(currentWeekStart);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    return date >= previousWeekStart && date <= previousWeekEnd;
  }
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date <= reference;
}

function ownerName(record: DashboardFilterRecord) {
  return formatPersonName(record.owner);
}

function formatPersonName(value: string | undefined) {
  const connectors = new Set(["da", "das", "de", "do", "dos", "e"]);
  return (value ?? "").trim().toLocaleLowerCase("pt-BR").split(/\s+/).filter(Boolean).map((word, index) => {
    if (index > 0 && connectors.has(word)) return word;
    return word.replace(/(^|[-'])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase("pt-BR")}`);
  }).join(" ");
}

function normalized(value: string | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR").trim();
}

function isTargetAgency(record: DashboardFilterRecord) {
  const target = normalized(TARGET_AGENCY);
  const raw = record as DashboardFilterRecord & Record<string, unknown>;
  return [record.realEstateAgency, record.salesChannel, record.company, raw["Imobiliária"], raw.Imobiliaria]
    .some((value) => normalized(typeof value === "string" ? value : undefined).includes(target));
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function formatRate(numerator: number, denominator: number) {
  return `${percent.format(rate(numerator, denominator) * 100)}%`;
}

function buildRanking(dashboard: DashboardPayload, weights: RankingWeights, period: RankingPeriod) {
  const data = dashboard.filterData?.records;
  if (!data) return [];
  const lines = new Map<string, ScoreLine>();
  const ensure = (record: DashboardFilterRecord) => {
    const name = ownerName(record);
    if (!name) return null;
    const key = name.toLocaleLowerCase("pt-BR");
    const manager = formatPersonName(record.manager) || "Sem gerente";
    if (!lines.has(key)) {
      lines.set(key, { name, manager, roulette: 0, schedule: 0, visit: 0, approvedFolder: 0, sale: 0, baseScore: 0, bonus: 0, total: 0, conversion: 0 });
    }
    const line = lines.get(key)!;
    if (line.manager === "Sem gerente" && manager !== "Sem gerente") line.manager = manager;
    return line;
  };
  const add = (records: DashboardFilterRecord[], key: "roulette" | "schedule" | "visit" | "approvedFolder" | "sale") => {
    records.filter((record) => isTargetAgency(record) && isInPeriod(record, period, dashboard.referenceDate)).forEach((record) => {
      const line = ensure(record);
      if (line) line[key] += 1;
    });
  };
  add(data.appointments, "schedule");
  add(data.visits, "visit");
  add(data.folders, "approvedFolder");
  add(data.sales, "sale");

  return [...lines.values()].map((line) => {
    const baseScore = line.roulette * weights.roulette + line.schedule * weights.schedule + line.visit * weights.visit + line.approvedFolder * weights.approvedFolder + line.sale * weights.sale;
    const conversion = rate(line.visit, line.schedule);
    const bonus = Math.floor(baseScore * conversion);
    return { ...line, baseScore, conversion, bonus, total: baseScore + bonus };
  }).sort((a, b) =>
    b.total - a.total ||
    b.visit - a.visit ||
    rate(b.visit, b.schedule) - rate(a.visit, a.schedule) ||
    b.approvedFolder - a.approvedFolder ||
    rate(b.approvedFolder, b.visit) - rate(a.approvedFolder, a.visit) ||
    b.sale - a.sale ||
    rate(b.sale, b.approvedFolder) - rate(a.sale, a.approvedFolder) ||
    a.name.localeCompare(b.name, "pt-BR")
  );
}

export function RankingBoard({ dashboard, dataStatus, weights, conversionData }: { dashboard: DashboardPayload | null; dataStatus: "live" | "demo" | "waiting"; weights: RankingWeights; conversionData?: { rate: number; appointments: number; visits: number; updatedAt: string | null } }) {
  const [period, setPeriod] = useState<RankingPeriod>("month");
  const [isPresentationActive, setIsPresentationActive] = useState(true);
  const [manager, setManager] = useState("all");
  const [collaborator, setCollaborator] = useState("all");
  useEffect(() => {
    if (!isPresentationActive) return;
    const timer = window.setInterval(() => {
      setPeriod((current) => presentationPeriods[(presentationPeriods.indexOf(current) + 1) % presentationPeriods.length]);
      setCollaborator("all");
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [isPresentationActive]);
  const ranking = useMemo(() => dashboard ? buildRanking(dashboard, weights, period) : [], [dashboard, weights, period]);
  const managers = useMemo(() => [...new Set(ranking.map((item) => item.manager))].sort((a, b) => a.localeCompare(b, "pt-BR")), [ranking]);
  const collaborators = useMemo(() => ranking.filter((item) => manager === "all" || item.manager === manager).map((item) => item.name).sort((a, b) => a.localeCompare(b, "pt-BR")), [ranking, manager]);
  const visible = ranking.filter((item) => (manager === "all" || item.manager === manager) && (collaborator === "all" || item.name === collaborator));
  const average = visible.length ? visible.reduce((total, item) => total + item.total, 0) / visible.length : 0;
  const averageConversion = visible.length ? visible.reduce((total, item) => total + item.conversion, 0) / visible.length : 0;
  const configuredBase = Object.values(weights).reduce((total, value) => total + value, 0);
  const currentConversion = conversionData?.rate ?? averageConversion;
  const configuredBonus = Math.floor(configuredBase * currentConversion);
  const configuredTotal = configuredBase + configuredBonus;
  const summary = visible.reduce((total, item) => ({
    roulette: total.roulette + item.roulette,
    schedule: total.schedule + item.schedule,
    visit: total.visit + item.visit,
    approvedFolder: total.approvedFolder + item.approvedFolder,
    sale: total.sale + item.sale,
    baseScore: total.baseScore + item.baseScore,
    bonus: total.bonus + item.bonus,
    points: total.points + item.total,
  }), { roulette: 0, schedule: 0, visit: 0, approvedFolder: 0, sale: 0, baseScore: 0, bonus: 0, points: 0 });

  return (
    <section className="points-ranking-board">
      <header className="points-ranking-heading">
        <div><p className="goal-kicker">Performance comercial</p><h2>Ranking da equipe</h2></div>
        <div className="ranking-source"><i aria-hidden="true" /><span><small>{dataStatus === "live" ? "Dados sincronizados" : dataStatus === "demo" ? "Dados de demonstração" : "Aguardando dados"}</small><strong>{dashboard ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(dashboard.generatedAt)) : "—"}</strong></span></div>
      </header>

      <section className="ranking-toolbar" aria-label="Filtros do ranking">
        <div className="ranking-periods">{presentationPeriods.map((key) => <button className={period === key ? "active" : ""} type="button" onClick={() => { setIsPresentationActive(false); setPeriod(key); setCollaborator("all"); }} key={key}>{periodLabels[key]}</button>)}</div>
        <label className="ranking-search"><span>Colaborador</span><select value={collaborator} onChange={(event) => setCollaborator(event.target.value)}><option value="all">Todos os colaboradores</option>{collaborators.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
        <label className="ranking-manager"><span>Gerente</span><select value={manager} onChange={(event) => { setManager(event.target.value); setCollaborator("all"); }}><option value="all">Todos os gerentes</option>{managers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
      </section>

      {visible.length ? (
        <>
          <section className="ranking-podium" aria-label="Pódio do ranking">
            {[1, 0, 2].map((index) => {
              const item = visible[index];
              if (!item) return null;
              const target = index > 0 ? visible[index - 1] : null;
              const gap = target ? Math.max(target.total - item.total, 0) : 0;
              const progress = target ? Math.min((item.total / Math.max(target.total, 1)) * 100, 100) : 100;
              const chaseTitle = gap === 0
                ? "Empate em pontos"
                : index === 1
                  ? `${number.format(gap)} ${gap === 1 ? "ponto" : "pontos"} para assumir a liderança`
                  : `${number.format(gap)} ${gap === 1 ? "ponto" : "pontos"} para conquistar o 2º lugar`;
              return <article className={`place-${index + 1}`} style={{ "--podium-progress": `${progress}%` } as React.CSSProperties} key={item.name}>
                <span className="ranking-medal">{index === 0 ? "Ouro" : index === 1 ? "Prata" : "Bronze"}</span>
                <i className="ranking-crest" aria-label={`${index + 1}º lugar`}><b>{index + 1}</b><small>º</small></i>
                <span className="ranking-place-label">{index === 0 ? "Líder do ranking" : index === 1 ? "Vice-líder" : "Top 3"}</span>
                <h2>{item.name}</h2>
                <p>{item.manager}</p>
                <div className="ranking-podium-score"><strong>{number.format(item.total)}</strong><small>pontos</small></div>
                <div className="ranking-podium-chase"><i aria-hidden="true"><span /></i>{index === 0 ? <p><strong>Na liderança</strong><span>Defenda o topo</span></p> : <p><strong>{chaseTitle}</strong><span>{gap === 0 ? "Vença no próximo critério de desempate" : `Próximo alvo: ${target?.name}`}</span></p>}</div>
              </article>;
            })}
          </section>

          <section className="ranking-list-card">
            <header><div><p className="goal-kicker">Placar completo</p><h2>Desempenho por colaborador</h2></div><p className="ranking-list-insights"><span>{periodLabels[period]}</span><b>·</b><span><strong>{number.format(visible.length)}</strong> participantes</span><b>·</b><span>Média <strong>{number.format(average)}</strong> pontos</span><b>·</b><span>Conversão média de agendamentos para visitas: <strong>{percent.format(averageConversion * 100)}%</strong></span></p></header>
            <div className="ranking-list" role="list">
              {visible.map((item, index) => <article className={index < 3 ? `ranking-row top-${index + 1}` : "ranking-row"} role="listitem" key={item.name}>
                <div className="ranking-row-rank"><strong>{index + 1}</strong><small>º</small></div>
                <div className="ranking-person"><span><strong>{item.name}</strong><small>{item.manager}</small></span></div>
                <div className="ranking-production">
                  <div className="ranking-activity">
                    <span className="no-conversion"><small>Roleta</small><b>{number.format(item.roulette)}</b><em>{number.format(item.roulette * weights.roulette)} pts</em></span>
                    <span className="no-conversion"><small>Agendamentos</small><b>{number.format(item.schedule)}</b><em>{number.format(item.schedule * weights.schedule)} pts</em></span>
                    <span><small>Visitas</small><b>{number.format(item.visit)}</b><em>{number.format(item.visit * weights.visit)} pts</em><mark>Agendamentos → Visitas {formatRate(item.visit, item.schedule)}</mark></span>
                    <span><small>Pastas aprov.</small><b>{number.format(item.approvedFolder)}</b><em>{number.format(item.approvedFolder * weights.approvedFolder)} pts</em><mark>Visitas → Pastas {formatRate(item.approvedFolder, item.visit)}</mark></span>
                    <span><small>Vendas</small><b>{number.format(item.sale)}</b><em>{number.format(item.sale * weights.sale)} pts</em><mark>Pastas → Vendas {formatRate(item.sale, item.approvedFolder)}</mark></span>
                  </div>
                </div>
                <div className="ranking-row-result">
                  <small>Total</small>
                  <strong>{number.format(item.total)}<span> pts</span></strong>
                  <p><span>{number.format(item.baseScore)} pts produção</span><span>+{number.format(item.bonus)} pts bônus</span><span>{percent.format(item.conversion * 100)}% conversão</span></p>
                </div>
              </article>)}
            </div>
          </section>

          <section className="ranking-summary">
            <header><div><p className="goal-kicker">Resumo do ranking</p><h2>Resultado consolidado</h2></div><span>{periodLabels[period]} · {visible.length} participantes</span></header>
            <div className="ranking-summary-grid">
              <article className="no-conversion"><small>Roleta</small><strong>{number.format(summary.roulette)}</strong><em>{number.format(summary.roulette * weights.roulette)} pts</em></article>
              <article className="no-conversion"><small>Agendamentos</small><strong>{number.format(summary.schedule)}</strong><em>{number.format(summary.schedule * weights.schedule)} pts</em></article>
              <article><small>Visitas</small><strong>{number.format(summary.visit)}</strong><em>{number.format(summary.visit * weights.visit)} pts</em><span>Agendamentos → Visitas {formatRate(summary.visit, summary.schedule)}</span></article>
              <article><small>Pastas aprovadas</small><strong>{number.format(summary.approvedFolder)}</strong><em>{number.format(summary.approvedFolder * weights.approvedFolder)} pts</em><span>Visitas → Pastas {formatRate(summary.approvedFolder, summary.visit)}</span></article>
              <article><small>Vendas</small><strong>{number.format(summary.sale)}</strong><em>{number.format(summary.sale * weights.sale)} pts</em><span>Pastas → Vendas {formatRate(summary.sale, summary.approvedFolder)}</span></article>
              <article className="ranking-summary-total"><small>Pontuação total</small><strong>{number.format(summary.points)}</strong><em>pontos</em><span>{number.format(summary.baseScore)} produção + {number.format(summary.bonus)} bônus</span></article>
            </div>
          </section>

          <section className="ranking-explainer">
            <header><div><p className="goal-kicker">Entenda seu resultado</p><h2>Como seu lugar no ranking é calculado</h2></div><a href="#point-settings-form">Ver valores dos pontos ↑</a></header>
            <div className="ranking-explainer-grid">
              <article>
                <span className="ranking-explainer-number">1</span>
                <div><h3>Primeiro, somamos seus pontos</h3><p>Cada resultado registrado no Salesforce vale uma quantidade de pontos. Quanto mais você produz, mais pontos ganha.</p></div>
                <ul className="ranking-weight-list">
                  <li><strong>Roleta</strong><span>{number.format(weights.roulette)} ponto{weights.roulette === 1 ? "" : "s"}</span></li>
                  <li><strong>Agendamento</strong><span>{number.format(weights.schedule)} ponto{weights.schedule === 1 ? "" : "s"}</span></li>
                  <li><strong>Visita</strong><span>{number.format(weights.visit)} pontos</span></li>
                  <li><strong>Pasta aprovada</strong><span>{number.format(weights.approvedFolder)} pontos</span></li>
                  <li><strong>Venda</strong><span>{number.format(weights.sale)} pontos</span></li>
                </ul>
              </article>
              <article>
                <span className="ranking-explainer-number">2</span>
                <div><h3>Depois, sua conversão gera um bônus</h3><p>Usamos números reais do Salesforce para descobrir quantos agendamentos viraram visitas. Quanto maior essa conversão, maior seu bônus.</p></div>
                <div className="ranking-bonus-story">
                  <div className="ranking-bonus-source"><span>Conversão atual</span><strong>{percent.format(currentConversion * 100)}%</strong><small>{number.format(conversionData?.appointments ?? summary.schedule)} agendamentos → {number.format(conversionData?.visits ?? summary.visit)} visitas</small></div>
                  <ol>
                    <li><b>1. Calcule a conversão</b><span>{number.format(conversionData?.visits ?? summary.visit)} visitas ÷ {number.format(conversionData?.appointments ?? summary.schedule)} agendamentos = {percent.format(currentConversion * 100)}%</span></li>
                    <li><b>2. Calcule o bônus</b><span>{number.format(configuredBase)} pontos × {percent.format(currentConversion * 100)}% = {number.format(configuredBonus)} pontos</span></li>
                    <li><b>3. Some tudo</b><span>{number.format(configuredBase)} pontos + {number.format(configuredBonus)} de bônus = {number.format(configuredTotal)} pontos</span></li>
                  </ol>
                  <mark>{number.format(configuredTotal)} pontos no resultado final</mark>
                  <span>Bônus sempre arredondado para baixo{conversionData?.updatedAt ? ` · Salesforce atualizado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(conversionData.updatedAt))}` : ""}.</span>
                </div>
              </article>
              <article className="ranking-tiebreak-card">
                <span className="ranking-explainer-number">3</span>
                <div><h3>Se duas pessoas tiverem os mesmos pontos</h3><p>Comparamos um item de cada vez. Assim que alguém tiver um resultado maior, o empate termina.</p></div>
                <ol>
                  <li><b>Mais visitas</b><span>Quem fez mais visitas fica na frente.</span></li>
                  <li><b>Melhor conversão de agendamento em visita</b><span>Quem transformou mais agendamentos em visitas fica na frente.</span></li>
                  <li><b>Mais pastas aprovadas</b><span>Quem teve mais pastas aprovadas fica na frente.</span></li>
                  <li><b>Melhor conversão de visita em pasta</b><span>Quem transformou mais visitas em pastas fica na frente.</span></li>
                  <li><b>Mais vendas</b><span>Quem vendeu mais fica na frente.</span></li>
                  <li><b>Melhor conversão de pasta aprovada em venda</b><span>Quem transformou mais pastas aprovadas em vendas fica na frente.</span></li>
                </ol>
              </article>
            </div>
          </section>
        </>
      ) : <section className="ranking-empty"><span>R</span><h2>Nenhum resultado neste período</h2><p>Nenhum registro da imobiliária {TARGET_AGENCY} encontrado. Altere período ou aguarde próxima sincronização do Salesforce.</p></section>}
      <footer className="ranking-help-footer">Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</footer>
    </section>
  );
}
