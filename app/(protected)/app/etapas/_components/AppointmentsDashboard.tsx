"use client";

import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentMonthlyGoal,
  appointmentYears,
  appointmentWeekOfMonth,
  saoPauloDate,
  type AppointmentBucket,
  type AppointmentFilters,
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
  selected,
  isSelected,
  onSelect,
}: {
  buckets: AppointmentBucket[];
  label: string;
  daily?: boolean;
  selected?: string | undefined;
  isSelected?: ((bucket: AppointmentBucket) => boolean) | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
}) {
  if (!buckets.length) return <Empty />;
  const max = Math.max(1, ...buckets.map((item) => item.total));
  return (
    <>
      <p className={styles.axis}>Quantidade de agendamentos</p>
      <ol
        aria-label={label}
        className={`${styles.columns} ${daily ? styles.daily : ""}`}
        style={{ "--column-count": buckets.length } as CSSProperties}
      >
        {buckets.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={isSelected ? isSelected(item) : selected === item.key}
              aria-label={`${daily ? displayDate(item.key) : item.label}: ${number.format(item.total)} agendamentos`}
              className={styles.chartButton}
              onClick={() => onSelect?.(item)}
            >
              <div
                className={styles.columnTrack}
                style={{ "--bar-height": `${(item.total / max) * 100}%` } as CSSProperties}
              >
                <div className={styles.column} style={{ height: "var(--bar-height)" }} />
                <span className={styles.columnValue}>{number.format(item.total)}</span>
              </div>
              <span className={styles.columnLabel}>{item.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function Ranking({
  buckets,
  unavailable = "Dados indisponíveis nesta atualização.",
  selected,
  onSelect,
}: {
  buckets: AppointmentBucket[] | null;
  unavailable?: string;
  selected?: string | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
}) {
  if (buckets === null) return <Empty>{unavailable}</Empty>;
  if (!buckets.length) return <Empty />;
  const max = buckets[0]!.total;
  return (
    <ol className={styles.ranking}>
      {buckets.map((item, index) => (
        <li key={item.key}>
          <button
            type="button"
            aria-pressed={selected === item.key}
            className={styles.rankingButton}
            onClick={() => onSelect?.(item)}
          >
            <div className={styles.rankingHeading}>
              <span>
                <span className={styles.rank}>{index + 1}.</span> {item.label}
              </span>
              <strong>{number.format(item.total)}</strong>
            </div>
            <div aria-hidden="true" className={styles.rankTrack}>
              <div className={styles.rankBar} style={{ width: `${(item.total / max) * 100}%` }} />
            </div>
          </button>
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

function GoalGauge({ current, goal }: { current: number; goal: number | null }) {
  const ratio = goal && goal > 0 ? current / goal : null;
  const percent = ratio === null ? null : ratio * 100;
  const angle = -90 + Math.min(Math.max(ratio ?? 0, 0), 1) * 180;
  return (
    <div className={styles.goalGauge}>
      <svg viewBox="0 0 240 130" role="img" aria-label="Velocímetro da meta mensal">
        <path className={styles.gaugeTrack} d="M 28 112 A 92 92 0 0 1 212 112" />
        <path
          className={styles.gaugeProgress}
          pathLength="100"
          strokeDasharray={`${Math.min((ratio ?? 0) * 100, 100)} 100`}
          d="M 28 112 A 92 92 0 0 1 212 112"
        />
        {Array.from({ length: 9 }, (_, index) => {
          const tickAngle = (-180 + index * 22.5) * (Math.PI / 180);
          const x1 = 120 + Math.cos(tickAngle) * 78;
          const y1 = 112 + Math.sin(tickAngle) * 78;
          const x2 = 120 + Math.cos(tickAngle) * 87;
          const y2 = 112 + Math.sin(tickAngle) * 87;
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.gaugeTick} />;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "120px 112px" }}>
          <path className={styles.gaugeNeedle} d="M 120 106 L 120 32 L 126 108 Z" />
        </g>
        <circle className={styles.gaugeHub} cx="120" cy="112" r="10" />
      </svg>
      <strong>
        {goal === null
          ? "Meta indisponível"
          : `${number.format(current)} de ${number.format(goal)}`}
      </strong>
      <p>
        {percent === null
          ? "Aguardando a meta individual vigente"
          : `${decimal.format(percent)}% da meta · ${current >= goal! ? "meta atingida" : `faltam ${number.format(goal! - current)}`}`}
      </p>
    </div>
  );
}

function AppointmentTable({
  rows,
  timezone,
  selectedKey,
  onSelect,
}: {
  rows: NonNullable<ReturnType<typeof analyzeAppointments>["details"]>;
  timezone: string;
  selectedKey?: string;
  onSelect: (filters: AppointmentFilters, key: string) => void;
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
              {rows.map((row, index) => {
                const selectionKey = `${row.createdAt}-${row.owner}-${row.accountName}-${row.accountRanking}-${row.salesManager}`;
                const key = `${selectionKey}-${index}`;
                const select = () =>
                  onSelect(
                    {
                      createdDate: saoPauloDate(row.createdAt),
                      week: appointmentWeekOfMonth(saoPauloDate(row.createdAt)),
                      regionalManager: row.regionalManager,
                      manager: row.salesManager,
                      owner: row.owner,
                      accountRanking: row.accountRanking,
                    },
                    selectionKey,
                  );
                return (
                  <tr
                    key={key}
                    tabIndex={0}
                    aria-selected={selectedKey === selectionKey}
                    onClick={select}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        select();
                      }
                    }}
                  >
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
                );
              })}
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
  individualGoal = null,
  timezone = "America/Sao_Paulo",
  canViewDevelopmentRankings = true,
}: {
  analysis: DashboardAnalysisSlice | null;
  generatedAt?: string | undefined;
  individualGoal?: number | null | undefined;
  timezone?: string | undefined;
  canViewDevelopmentRankings?: boolean | undefined;
}) {
  const [monthChoice, setSelectedMonth] = useState("");
  const [yearChoice, setSelectedYear] = useState("");
  const [filters, setFilters] = useState<AppointmentFilters>({});
  const [selectedRow, setSelectedRow] = useState("");
  const selectedMonth = monthChoice || analysis?.referenceDate.slice(0, 7) || "";
  const selectedYear = yearChoice || analysis?.referenceDate.slice(0, 4) || "";
  const result = useMemo(
    () =>
      analysis
        ? analyzeAppointments(analysis, { month: selectedMonth, year: selectedYear, filters })
        : null,
    [analysis, filters, selectedMonth, selectedYear],
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
  const monthlyGoal = appointmentMonthlyGoal(individualGoal, result.brokerCount);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const toggleFilter = <K extends keyof AppointmentFilters>(
    key: K,
    value: AppointmentFilters[K],
  ) => {
    setSelectedRow("");
    setFilters((current) => {
      const next = { ...current };
      if (current[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  };
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
        {activeFilterCount > 0 && (
          <button
            type="button"
            className={styles.clearFilters}
            onClick={() => {
              setFilters({});
              setSelectedRow("");
            }}
          >
            Limpar {activeFilterCount} {activeFilterCount === 1 ? "filtro" : "filtros"}
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {activeFilterCount > 0
          ? `${activeFilterCount} filtros ativos. ${result.total} registros encontrados.`
          : "Nenhum filtro de gráfico ativo."}
      </p>
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
          <GoalGauge current={result.total} goal={monthlyGoal} />
          <span className={styles.goalFormula}>
            {individualGoal === null || result.brokerCount === null
              ? "Meta individual ou corretores indisponíveis"
              : `${number.format(individualGoal)} por corretor × ${number.format(result.brokerCount)} corretores`}
          </span>
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
            <Columns
              buckets={result.daily}
              label="Agendamentos por dia do mês selecionado"
              daily
              selected={filters.createdDate}
              onSelect={(bucket) => toggleFilter("createdDate", bucket.key)}
            />
          )}
        </Chart>
      </div>

      <div className={styles.grid}>
        <Chart title="Previstos e realizados hoje">
          {result.plannedToday === null ? (
            <Empty>Dados operacionais indisponíveis nesta atualização.</Empty>
          ) : (
            <Columns
              buckets={paired}
              label="Agendamentos previstos e realizados hoje"
              isSelected={() => filters.createdDate === analysis.referenceDate}
              onSelect={() => toggleFilter("createdDate", analysis.referenceDate)}
            />
          )}
        </Chart>
        <Chart title="Agendamentos por semana">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <>
              <Columns
                buckets={result.weekly}
                label="Agendamentos por semana do mês selecionado"
                selected={filters.week ? String(filters.week) : undefined}
                onSelect={(bucket) => toggleFilter("week", Number(bucket.key))}
              />
              <p className={styles.note}>
                Semanas do mês: segunda a domingo. A primeira pode ser parcial.
              </p>
            </>
          )}
        </Chart>
        <Chart title="Ranking Score">
          {!canViewDevelopmentRankings ? (
            <Empty>Ranking Score indisponível para seu perfil de acesso.</Empty>
          ) : monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Columns
              buckets={result.accountRankings ?? []}
              label="Ranking Score"
              selected={filters.accountRanking}
              onSelect={(bucket) => toggleFilter("accountRanking", bucket.key)}
            />
          )}
        </Chart>
      </div>

      <div className={`${styles.grid} ${styles.rankingGrid}`}>
        <Chart title="Ranking por gerente regional">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking
              buckets={result.regionalManagers}
              selected={filters.regionalManager}
              onSelect={(bucket) => toggleFilter("regionalManager", bucket.key)}
            />
          )}
        </Chart>
        <Chart title="Ranking por gerente">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking
              buckets={result.managers}
              selected={filters.manager}
              onSelect={(bucket) => toggleFilter("manager", bucket.key)}
            />
          )}
        </Chart>
        <Chart title="Ranking por responsável">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking
              buckets={result.owners}
              selected={filters.owner}
              onSelect={(bucket) => toggleFilter("owner", bucket.key)}
            />
          )}
        </Chart>
      </div>

      <div className={styles.fullRow}>
        <Chart
          title="Agendamentos por mês"
          wide
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
          <Columns
            buckets={result.monthly}
            label={`Agendamentos por mês de ${selectedYear}`}
            onSelect={(bucket) => {
              const nextMonth = `${selectedYear}-${bucket.key}`;
              setSelectedMonth(nextMonth);
              setFilters((current) => {
                const next = { ...current };
                delete next.createdDate;
                delete next.week;
                return next;
              });
            }}
          />
          <p className={styles.note}>Somente meses com agendamentos são exibidos.</p>
        </Chart>
      </div>

      {result.details === null ? (
        <section className={`${styles.card} ${styles.tableCard}`}>
          <h2>Detalhamento dos agendamentos</h2>
          <Empty>Detalhamento indisponível nesta atualização.</Empty>
        </section>
      ) : (
        <AppointmentTable
          rows={result.details}
          timezone={timezone}
          selectedKey={selectedRow}
          onSelect={(rowFilters, key) => {
            if (selectedRow === key) {
              setSelectedRow("");
              setFilters({});
            } else {
              setSelectedRow(key);
              setFilters(rowFilters);
            }
          }}
        />
      )}
    </div>
  );
}
