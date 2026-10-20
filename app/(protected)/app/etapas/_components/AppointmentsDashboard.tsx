"use client";

import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentYears,
  type AppointmentBucket,
} from "@/lib/crm/stages/appointments";

import styles from "./AppointmentsDashboard.module.css";

const number = new Intl.NumberFormat("pt-BR");
const displayDate = (date: string) => date.split("-").reverse().join("/");

function Chart({
  title,
  children,
  controls,
}: {
  title: string;
  children: ReactNode;
  controls?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${styles.card} ${styles.chartCard}`}>
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
  const max = Math.max(...buckets.map((item) => item.total));
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

function Ranking({ buckets }: { buckets: AppointmentBucket[] | null }) {
  if (buckets === null)
    return (
      <Empty>
        Nome do empreendimento indisponível nesta atualização. Aguardando exportação com a coluna
        vigente.
      </Empty>
    );
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
  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Agendamentos</h1>
      <div className={styles.toolbar}>
        <div>
          <label htmlFor={monthId}>Período dos gráficos e rankings</label>
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
      <div className={styles.grid}>
        <Chart title="Agendamentos por dia">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Columns buckets={result.daily} label="Agendamentos por dia do mês selecionado" daily />
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
            Filtro de ano exclusivo deste gráfico. Somente meses com agendamentos na cobertura
            disponível.
          </p>
        </Chart>
      </div>
      <div className={`${styles.grid} ${styles.rankingsGrid}`}>
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
        <Chart title="Agendamentos por loja">
          {!canViewDevelopmentRankings ? (
            <Empty>Ranking por loja indisponível para seu perfil de acesso.</Empty>
          ) : monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking buckets={result.stores} />
          )}
        </Chart>
        <Chart title="Ranking por empreendimento">
          {!canViewDevelopmentRankings ? (
            <Empty>Ranking por empreendimento indisponível para seu perfil de acesso.</Empty>
          ) : monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking buckets={result.developments} />
          )}
        </Chart>
      </div>
    </div>
  );
}
