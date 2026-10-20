"use client";

import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Gauge } from "@/app/(protected)/app/_components/analytics/Charts";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentYears,
  type AppointmentBucket,
} from "@/lib/crm/stages/appointments";

import styles from "./AppointmentsDashboard.module.css";

const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const displayDate = (date: string) => date.split("-").reverse().join("/");

function Chart({
  title,
  children,
  controls,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  controls?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      data-appointments-chart
      className={`${styles.card} ${styles.chartCard} ${wide ? styles.wideChart : ""}`}
    >
      <header className={styles.cardHeader}>
        <h2 id={id}>{title}</h2>
        {controls}
      </header>
      <div className={styles.cardBody} tabIndex={0}>
        {children}
      </div>
    </section>
  );
}

function Empty({ children = "Nenhum agendamento no período coberto." }: { children?: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function Columns({
  buckets,
  label,
  daily = false,
}: {
  buckets: AppointmentBucket[];
  label: string;
  daily?: boolean;
}) {
  if (!buckets.length) return <Empty />;
  const max = Math.max(1, ...buckets.map((item) => item.total));
  return (
    <>
      <p className={styles.axis}>Quantidade de agendamentos</p>
      <ol aria-label={label} className={`${styles.columns} ${daily ? styles.daily : ""}`}>
        {buckets.map((item) => (
          <li
            key={item.key}
            aria-label={`${daily ? displayDate(item.key) : item.label}: ${number.format(item.total)} agendamentos`}
          >
            <div
              className={styles.columnTrack}
              style={{ "--bar-height": `${(item.total / max) * 100}%` } as CSSProperties}
            >
              <div className={styles.column} style={{ height: "var(--bar-height)" }} />
              <span className={styles.columnValue}>{number.format(item.total)}</span>
            </div>
            <span className={styles.columnLabel}>{item.label}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Ranking({
  buckets,
  unavailable = "Dados indisponíveis nesta atualização.",
}: {
  buckets: AppointmentBucket[] | null;
  unavailable?: string;
}) {
  if (buckets === null) return <Empty>{unavailable}</Empty>;
  if (!buckets.length) return <Empty />;
  const max = buckets[0]!.total;
  return (
    <ol className={styles.ranking}>
      {buckets.map((item, index) => (
        <li key={item.key}>
          <div className={styles.rankingHeading}>
            <span>
              <span className={styles.rank}>{index + 1}.</span> {item.label}
            </span>
            <strong>{number.format(item.total)}</strong>
          </div>
          <div aria-hidden="true" className={styles.rankTrack}>
            <div className={styles.rankBar} style={{ width: `${(item.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string | null; detail: string }) {
  return (
    <article className={`${styles.card} ${styles.kpiCard}`}>
      <h2>{label}</h2>
      <strong>{value ?? "Indisponível"}</strong>
      <p>{detail}</p>
    </article>
  );
}

function AppointmentTable({
  rows,
  timezone,
}: {
  rows: NonNullable<ReturnType<typeof analyzeAppointments>["details"]>;
  timezone: string;
}) {
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: timezone });
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  const value = (text: string) => text || "Não informado";
  return (
    <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="appointments-table">
      <header className={styles.cardHeader}>
        <h2 id="appointments-table">Detalhamento dos agendamentos</h2>
        <span>{number.format(rows.length)} registros no período</span>
      </header>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className={styles.tableViewport} tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Data de criação</th>
                <th>Horário</th>
                <th>Data de comparecimento</th>
                <th>Visita Realizada</th>
                <th>Gerente Regional</th>
                <th>Gerente de Vendas</th>
                <th>Corretor: Nome completo</th>
                <th>Conta: Nome da conta</th>
                <th>Conta: Ranking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.createdAt}-${row.owner}-${index}`}>
                  <td>{date.format(new Date(row.createdAt))}</td>
                  <td>
                    {row.scheduledAt ? time.format(new Date(row.scheduledAt)) : "Não informado"}
                  </td>
                  <td>
                    {row.attendedAt ? date.format(new Date(row.attendedAt)) : "Não informado"}
                  </td>
                  <td>{row.visitPerformed ? "Sim" : "Não"}</td>
                  <td>{value(row.regionalManager)}</td>
                  <td>{value(row.salesManager)}</td>
                  <td>{value(row.owner)}</td>
                  <td>{value(row.accountName)}</td>
                  <td>{value(row.accountRanking)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AppointmentsDashboard({
  analysis,
  generatedAt,
  timezone = "America/Sao_Paulo",
  canViewDevelopmentRankings = true,
}: {
  analysis: DashboardAnalysisSlice | null;
  generatedAt?: string | undefined;
  timezone?: string | undefined;
  canViewDevelopmentRankings?: boolean | undefined;
}) {
  const [monthChoice, setSelectedMonth] = useState("");
  const [yearChoice, setSelectedYear] = useState("");
  const selectedMonth = monthChoice || analysis?.referenceDate.slice(0, 7) || "";
  const selectedYear = yearChoice || analysis?.referenceDate.slice(0, 4) || "";
  const result = useMemo(
    () =>
      analysis ? analyzeAppointments(analysis, { month: selectedMonth, year: selectedYear }) : null,
    [analysis, selectedMonth, selectedYear],
  );
  const yearId = useId();
  const monthId = useId();
  if (!analysis || !result)
    return (
      <section className={styles.card}>
        <h1 className={styles.title}>Agendamentos</h1>
        <Empty>Dados analíticos indisponíveis. Aguardando uma atualização validada da fonte.</Empty>
      </section>
    );
  const years = appointmentYears(analysis);
  const monthUnavailable = result.coverage === "unavailable";
  const gaugeRatio =
    result.brokerCount === null || result.brokerCount === 0
      ? null
      : result.total / result.brokerCount;
  const paired =
    result.plannedToday === null || result.performedToday === null
      ? []
      : [
          { key: "planned", label: "Previstos hoje", total: result.plannedToday },
          { key: "performed", label: "Realizados", total: result.performedToday },
        ];
  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Agendamentos</h1>
      <div className={styles.toolbar}>
        <div>
          <label htmlFor={monthId}>Período dos gráficos, indicadores e tabela</label>
          <input
            id={monthId}
            type="month"
            min={analysis.coverageStart.slice(0, 7)}
            max={analysis.referenceDate.slice(0, 7)}
            value={selectedMonth}
            onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.target.value)) setSelectedMonth(event.target.value);
            }}
          />
        </div>
        <p aria-live="polite">
          {monthUnavailable ? (
            "Período fora da cobertura disponível"
          ) : (
            <>
              <strong>{number.format(result.total)}</strong> agendamentos no período
            </>
          )}
        </p>
      </div>
      <p className={styles.coverage}>
        Cobertura da fonte: {displayDate(analysis.coverageStart)} a{" "}
        {displayDate(analysis.referenceDate)}.
        {result.coverage === "partial" &&
          " Mês selecionado com cobertura parcial; somente dias disponíveis são exibidos."}
        {generatedAt && (
          <>
            {" "}
            Atualização:{" "}
            <time dateTime={generatedAt}>
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: timezone,
              }).format(new Date(generatedAt))}
            </time>
            .
          </>
        )}
      </p>

      <div className={styles.kpiGrid}>
        <article className={`${styles.card} ${styles.gaugeCard}`}>
          <h2>Meta do mês</h2>
          <Gauge
            label="Agendamentos no mês por corretores cadastrados"
            value={
              result.brokerCount === null
                ? "Indisponível"
                : `${number.format(result.total)} de ${number.format(result.brokerCount)}`
            }
            ratio={gaugeRatio}
            accent="cyan"
            variant="compact"
          />
        </article>
        <Kpi
          label="Corretores cadastrados"
          value={result.brokerCount === null ? null : number.format(result.brokerCount)}
          detail="Total vigente do relatório de corretores"
        />
        <Kpi
          label="Média de agendamentos"
          value={result.dailyAverage === null ? null : decimal.format(result.dailyAverage)}
          detail="Média diária no mês selecionado"
        />
        <Kpi
          label="Agendamentos no mês"
          value={number.format(result.total)}
          detail="Período selecionado"
        />
        <Kpi
          label="Agendamentos ontem"
          value={number.format(result.yesterday)}
          detail="Pela data de criação"
        />
        <Kpi
          label="Agendamentos hoje"
          value={number.format(result.today)}
          detail="Pela data de criação"
        />
      </div>

      <div className={styles.fullRow}>
        <Chart title="Evolução de agendamentos por dia" wide>
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Columns buckets={result.daily} label="Agendamentos por dia do mês selecionado" daily />
          )}
        </Chart>
      </div>

      <div className={styles.grid}>
        <Chart title="Previstos e realizados hoje">
          {result.plannedToday === null ? (
            <Empty>Dados operacionais indisponíveis nesta atualização.</Empty>
          ) : (
            <Columns buckets={paired} label="Agendamentos previstos e realizados hoje" />
          )}
        </Chart>
        <Chart title="Agendamentos por semana">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <>
              <Columns buckets={result.weekly} label="Agendamentos por semana do mês selecionado" />
              <p className={styles.note}>
                Semanas do mês: segunda a domingo. A primeira pode ser parcial.
              </p>
            </>
          )}
        </Chart>
        <Chart
          title="Agendamentos por mês"
          controls={
            <div className={styles.yearControl}>
              <label htmlFor={yearId}>Ano</label>
              <select
                id={yearId}
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <Columns buckets={result.monthly} label={`Agendamentos por mês de ${selectedYear}`} />
          <p className={styles.note}>
            Filtro de ano exclusivo deste gráfico. Somente meses com valor maior que zero.
          </p>
        </Chart>
      </div>

      <div className={`${styles.grid} ${styles.rankingGrid}`}>
        <Chart title="Ranking por gerente regional">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking buckets={result.regionalManagers} />
          )}
        </Chart>
        <Chart title="Ranking por gerente">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking buckets={result.managers} />
          )}
        </Chart>
        <Chart title="Ranking por responsável">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking buckets={result.owners} />
          )}
        </Chart>
        <Chart title="Ranking das contas">
          {!canViewDevelopmentRankings ? (
            <Empty>Ranking das contas indisponível para seu perfil de acesso.</Empty>
          ) : monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : result.accountRankings === null ? (
            <Empty>Dados indisponíveis nesta atualização.</Empty>
          ) : (
            <Columns buckets={result.accountRankings} label="Ranking das contas" />
          )}
        </Chart>
      </div>

      {result.details === null ? (
        <section className={`${styles.card} ${styles.tableCard}`}>
          <h2>Detalhamento dos agendamentos</h2>
          <Empty>Detalhamento indisponível nesta atualização.</Empty>
        </section>
      ) : (
        <AppointmentTable rows={result.details} timezone={timezone} />
      )}
    </div>
  );
}
