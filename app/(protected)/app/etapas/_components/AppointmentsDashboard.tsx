"use client";

import { useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, X } from "lucide-react";

import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentMonthlyGoal,
  appointmentYears,
  saoPauloDate,
  type AppointmentBucket,
  type AppointmentFilters,
} from "@/lib/crm/stages/appointments";

import styles from "./AppointmentsDashboard.module.css";

const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const displayDate = (date: string) => date.split("-").reverse().join("/");
const calendarDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "UTC",
});
const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;
const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;

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
  monthly = false,
}: {
  buckets: AppointmentBucket[];
  label: string;
  daily?: boolean;
  selected?: string | undefined;
  isSelected?: ((bucket: AppointmentBucket) => boolean) | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
  monthly?: boolean;
}) {
  if (!buckets.length) return <Empty />;
  const max = Math.max(1, ...buckets.map((item) => item.total));
  return (
    <>
      <p className={styles.axis}>Quantidade de agendamentos</p>
      <ol
        aria-label={label}
        className={`${styles.columns} ${daily ? styles.daily : ""} ${monthly ? styles.monthly : ""}`}
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

function ProductiveTeamCard({
  productive,
  brokers,
  percent,
}: {
  productive: number | null;
  brokers: number | null;
  percent: number | null;
}) {
  const progress = Math.min(Math.max(percent ?? 0, 0), 100);
  return (
    <article className={`${styles.card} ${styles.kpiCard} ${styles.productiveCard}`}>
      <h2>Equipe Produtiva</h2>
      <div
        className={styles.donut}
        style={{ "--donut-progress": `${progress * 3.6}deg` } as CSSProperties}
        role="img"
        aria-label={
          productive === null || brokers === null || percent === null
            ? "Equipe produtiva indisponível"
            : `${number.format(productive)} de ${number.format(brokers)} corretores, ${decimal.format(percent)} por cento da equipe`
        }
      >
        <strong>{percent === null ? "—" : `${decimal.format(percent)}%`}</strong>
      </div>
      <p>
        {productive === null || brokers === null
          ? "Aguardando o elenco vigente de corretores"
          : `${number.format(productive)} de ${number.format(brokers)} corretores com agendamento`}
      </p>
    </article>
  );
}

function ConversionKpi({
  title,
  source,
  target,
  sourceUnit,
  targetUnit,
}: {
  title: string;
  source: number | null;
  target: number | null;
  sourceUnit: string;
  targetUnit: string;
}) {
  const percent = source !== null && target !== null && source > 0 ? (target / source) * 100 : null;
  const ratio = source !== null && target !== null && target > 0 ? source / target : null;
  return (
    <article className={`${styles.card} ${styles.conversionCard}`}>
      <h2>{title}</h2>
      {source === null || target === null ? (
        <strong>Indisponível</strong>
      ) : (
        <strong
          className={styles.conversionPercent}
          aria-label={
            percent === null
              ? "Aproveitamento indisponível no período selecionado"
              : `${decimal.format(percent)} por cento de aproveitamento`
          }
        >
          {percent === null ? "—" : `${decimal.format(percent)}%`}
        </strong>
      )}
      <p>
        {ratio === null
          ? "Sem conversão no período selecionado"
          : `${decimal.format(ratio)} ${sourceUnit} para 1 ${targetUnit}`}
      </p>
    </article>
  );
}

function CalendarFilter({
  month,
  years,
  coverageStart,
  referenceDate,
  selectedDates,
  onMonthChange,
  onToggleDate,
  onSelectWholeMonth,
}: {
  month: string;
  years: string[];
  coverageStart: string;
  referenceDate: string;
  selectedDates: string[];
  onMonthChange: (month: string) => void;
  onToggleDate: (date: string) => void;
  onSelectWholeMonth: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leadingDays = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const cells = Array.from({ length: Math.ceil((leadingDays + dayCount) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= dayCount ? day : null;
  });
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const selected = new Set(selectedDates);
  const summary =
    selectedDates.length === 0
      ? `${monthNames[monthNumber - 1]} de ${year}`
      : selectedDates.length === 1
        ? displayDate(selectedDates[0]!)
        : `${selectedDates.length} dias selecionados`;
  const setMonthPart = (nextYear: number, nextMonth: number) =>
    onMonthChange(`${nextYear}-${String(nextMonth).padStart(2, "0")}`);
  const setCalendarYear = (nextYear: number) => {
    const candidate = `${nextYear}-${String(monthNumber).padStart(2, "0")}`;
    const firstMonth = coverageStart.slice(0, 7);
    const lastMonth = referenceDate.slice(0, 7);
    onMonthChange(
      candidate < firstMonth ? firstMonth : candidate > lastMonth ? lastMonth : candidate,
    );
  };
  const open = () => {
    if (!dialog.current?.open) {
      dialog.current?.showModal();
      requestAnimationFrame(() => close.current?.focus());
    }
  };
  return (
    <div className={styles.calendarField}>
      <span>Período</span>
      <button
        ref={trigger}
        type="button"
        className={styles.calendarTrigger}
        aria-haspopup="dialog"
        onClick={open}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span>{summary}</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.calendarDialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => trigger.current?.focus()}
      >
        <div className={styles.calendarPanel}>
          <header className={styles.calendarHeader}>
            <div>
              <span>CALENDÁRIO</span>
              <h2 id={titleId}>Selecione o período</h2>
            </div>
            <button
              ref={close}
              type="button"
              className={styles.calendarClose}
              aria-label="Fechar calendário"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <p id={descriptionId} className={styles.calendarDescription}>
            Escolha o mês inteiro ou selecione um ou vários dias.
          </p>
          <div className={styles.calendarControls}>
            <label>
              <span>Mês</span>
              <select
                aria-label="Mês do calendário"
                value={monthNumber}
                onChange={(event) => setMonthPart(year, Number(event.target.value))}
              >
                {monthNames.map((name, index) => {
                  const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                  const unavailable =
                    value < coverageStart.slice(0, 7) || value > referenceDate.slice(0, 7);
                  return (
                    <option key={name} value={index + 1} disabled={unavailable}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              <span>Ano</span>
              <select
                aria-label="Ano do calendário"
                value={year}
                onChange={(event) => setCalendarYear(Number(event.target.value))}
              >
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.calendarGrid} role="grid" aria-label="Dias do mês">
            <div className={styles.calendarGridRow} role="row">
              {weekDays.map((day) => (
                <span key={day} role="columnheader" className={styles.calendarWeekday}>
                  {day}
                </span>
              ))}
            </div>
            {weeks.map((week, weekIndex) => (
              <div className={styles.calendarGridRow} role="row" key={`week-${weekIndex}`}>
                {week.map((day, dayIndex) => {
                  if (day === null)
                    return <span key={`empty-${weekIndex}-${dayIndex}`} aria-hidden="true" />;
                  const key = `${month}-${String(day).padStart(2, "0")}`;
                  const unavailable = key < coverageStart || key > referenceDate;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-label={calendarDate.format(new Date(`${key}T12:00:00Z`))}
                      aria-current={key === referenceDate ? "date" : undefined}
                      aria-selected={selected.has(key)}
                      disabled={unavailable}
                      className={styles.calendarDay}
                      onClick={() => onToggleDate(key)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <footer className={styles.calendarFooter}>
            <span aria-live="polite">{summary}</span>
            <button type="button" onClick={onSelectWholeMonth}>
              Selecionar mês inteiro
            </button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}

function DashboardFilters({
  filters,
  options,
  onChange,
  month,
  years,
  coverageStart,
  referenceDate,
  selectedDates,
  onMonthChange,
  onToggleDate,
  onSelectWholeMonth,
  activeFilterCount,
  onClear,
}: {
  filters: AppointmentFilters;
  options: {
    channels: { key: 0 | 1; label: string }[];
    managers: string[];
    owners: string[];
    companies: string[];
  };
  onChange: <K extends keyof AppointmentFilters>(
    key: K,
    value: AppointmentFilters[K] | undefined,
  ) => void;
  month: string;
  years: string[];
  coverageStart: string;
  referenceDate: string;
  selectedDates: string[];
  onMonthChange: (month: string) => void;
  onToggleDate: (date: string) => void;
  onSelectWholeMonth: () => void;
  activeFilterCount: number;
  onClear: () => void;
}) {
  const selects = [
    {
      key: "manager" as const,
      label: "Gerente de Vendas",
      empty: "Todos os gerentes",
      values: options.managers,
    },
    {
      key: "owner" as const,
      label: "Responsável da conta",
      empty: "Todos os responsáveis",
      values: options.owners,
    },
    {
      key: "company" as const,
      label: "Empresa",
      empty: "Todas as empresas",
      values: options.companies,
    },
  ];
  const channelOptions = [
    { key: 1 as const, label: "House" },
    { key: 0 as const, label: "Imob" },
  ];
  return (
    <section className={styles.filters} aria-label="Filtros do painel de agendamentos">
      <fieldset className={styles.channelField}>
        <legend>Canal de vendas</legend>
        <div className={styles.channelSwitch}>
          {channelOptions.map((option) => {
            const available = options.channels.some((item) => item.key === option.key);
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={filters.channel === option.key}
                disabled={!available}
                title={available ? undefined : "Canal indisponível neste recorte"}
                onClick={() =>
                  onChange("channel", filters.channel === option.key ? undefined : option.key)
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      {selects.map((filter) => {
        const id = `appointment-filter-${filter.key}`;
        return (
          <label key={filter.key} className={styles.filterField} htmlFor={id}>
            <span>{filter.label}</span>
            <select
              id={id}
              value={filters[filter.key] ?? ""}
              onChange={(event) => onChange(filter.key, event.target.value || undefined)}
            >
              <option value="">{filter.empty}</option>
              {filter.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <CalendarFilter
        month={month}
        years={years}
        coverageStart={coverageStart}
        referenceDate={referenceDate}
        selectedDates={selectedDates}
        onMonthChange={onMonthChange}
        onToggleDate={onToggleDate}
        onSelectWholeMonth={onSelectWholeMonth}
      />
      <div className={styles.clearField}>
        <span aria-hidden="true">Filtros</span>
        <button
          type="button"
          className={styles.clearFilters}
          disabled={activeFilterCount === 0}
          onClick={onClear}
        >
          {activeFilterCount === 0
            ? "Limpar filtros"
            : `Limpar ${activeFilterCount} ${activeFilterCount === 1 ? "filtro" : "filtros"}`}
        </button>
      </div>
    </section>
  );
}

type RecencyItem = {
  owner: string;
  manager: string;
  lastAppointmentDate: string;
  daysSinceLastAppointment: number;
};

function RecencyPanel({ title, items }: { title: string; items: RecencyItem[] }) {
  const id = useId();
  return (
    <section className={`${styles.card} ${styles.recencyCard}`} aria-labelledby={id}>
      <header className={styles.recencyHeader}>
        <h2 id={id}>{title}</h2>
        <span>{number.format(items.length)} corretores</span>
      </header>
      {items.length === 0 ? (
        <Empty>Nenhum corretor nesta faixa.</Empty>
      ) : (
        <ol className={styles.recencyList}>
          {items.map((item) => (
            <li key={item.owner}>
              <strong>{item.owner}</strong>
              <span>{item.manager || "Gerente não informado"}</span>
              <b>
                {item.daysSinceLastAppointment === 0
                  ? "Hoje"
                  : `${number.format(item.daysSinceLastAppointment)} ${item.daysSinceLastAppointment === 1 ? "dia" : "dias"}`}
              </b>
            </li>
          ))}
        </ol>
      )}
    </section>
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
                      createdDates: [saoPauloDate(row.createdAt)],
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
  const [rowBaseFilters, setRowBaseFilters] = useState<AppointmentFilters | null>(null);
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
  if (!analysis || !result)
    return (
      <section className={styles.card}>
        <h1 className={styles.title}>Agendamentos</h1>
        <Empty>Dados analíticos indisponíveis. Aguardando uma atualização validada da fonte.</Empty>
      </section>
    );
  const years = appointmentYears(analysis);
  const referenceMonth = analysis.referenceDate.slice(0, 7);
  const selectedDates = filters.createdDates ?? [];
  const monthUnavailable = result.coverage === "unavailable";
  const monthlyGoal = appointmentMonthlyGoal(individualGoal, result.brokerCount);
  const calendarActive = selectedMonth !== referenceMonth || selectedDates.length > 0;
  const activeFilterCount =
    Object.entries(filters).filter(
      ([key, value]) =>
        key !== "createdDates" && value !== undefined && value !== "" && value !== null,
    ).length + (calendarActive ? 1 : 0);
  const toggleFilter = <K extends keyof AppointmentFilters>(
    key: K,
    value: AppointmentFilters[K],
  ) => {
    setSelectedRow("");
    setRowBaseFilters(null);
    setFilters((current) => {
      const next = { ...current };
      if (current[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  };
  const setDimensionFilter = <K extends keyof AppointmentFilters>(
    key: K,
    value: AppointmentFilters[K] | undefined,
  ) => {
    setSelectedRow("");
    setRowBaseFilters(null);
    setFilters((current) => {
      const next = { ...current };
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  };
  const selectMonth = (month: string) => {
    setSelectedMonth(month);
    setSelectedYear(month.slice(0, 4));
    setSelectedRow("");
    setRowBaseFilters(null);
    setFilters((current) => {
      const next = { ...current };
      delete next.createdDate;
      delete next.createdDates;
      delete next.week;
      return next;
    });
  };
  const toggleCalendarDate = (date: string) => {
    setSelectedRow("");
    setRowBaseFilters(null);
    setFilters((current) => {
      const currentDates = current.createdDates ?? [];
      const nextDates = currentDates.includes(date)
        ? currentDates.filter((item) => item !== date)
        : [...currentDates, date].sort();
      const next = { ...current };
      delete next.createdDate;
      delete next.week;
      if (nextDates.length === 0) delete next.createdDates;
      else next.createdDates = nextDates;
      return next;
    });
  };
  const selectWholeMonth = () => {
    setSelectedRow("");
    setRowBaseFilters(null);
    setFilters((current) => {
      const next = { ...current };
      delete next.createdDate;
      delete next.createdDates;
      delete next.week;
      return next;
    });
  };
  const clearAllFilters = () => {
    setSelectedMonth("");
    setSelectedYear("");
    setFilters({});
    setSelectedRow("");
    setRowBaseFilters(null);
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
      <p className="sr-only" aria-live="polite">
        {monthUnavailable
          ? "Período fora da cobertura disponível."
          : `${activeFilterCount} ${activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}. ${result.total} registros encontrados.${
              result.coverage === "partial"
                ? ` Cobertura parcial entre ${displayDate(analysis.coverageStart)} e ${displayDate(analysis.referenceDate)}.`
                : ""
            }`}
      </p>

      <DashboardFilters
        filters={filters}
        options={result.filterOptions}
        onChange={setDimensionFilter}
        month={selectedMonth}
        years={years}
        coverageStart={analysis.coverageStart}
        referenceDate={analysis.referenceDate}
        selectedDates={selectedDates}
        onMonthChange={selectMonth}
        onToggleDate={toggleCalendarDate}
        onSelectWholeMonth={selectWholeMonth}
        activeFilterCount={activeFilterCount}
        onClear={clearAllFilters}
      />

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
        <ProductiveTeamCard
          productive={result.productiveBrokers}
          brokers={result.brokerCount}
          percent={result.productivePercent}
        />
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

      <div className={`${styles.kpiGrid} ${styles.secondaryKpiGrid}`}>
        <ConversionKpi
          title="Oportunidade x Agendamento"
          source={result.funnel?.opportunities ?? null}
          target={result.funnel?.appointments ?? null}
          sourceUnit="oportunidades"
          targetUnit="agendamento"
        />
        <ConversionKpi
          title="Agendamento x Visita"
          source={result.funnel?.appointments ?? null}
          target={result.funnel?.visits ?? null}
          sourceUnit="agendamentos"
          targetUnit="visita"
        />
        <ConversionKpi
          title="Agendamento x Venda"
          source={result.funnel?.appointments ?? null}
          target={result.funnel?.sales ?? null}
          sourceUnit="agendamentos"
          targetUnit="venda"
        />
        <Kpi
          label="Gerentes cadastrados"
          value={
            result.registeredManagerCount === null
              ? null
              : number.format(result.registeredManagerCount)
          }
          detail="Gerentes de Vendas vinculados aos corretores"
        />
        <Kpi
          label="Visitas realizadas"
          value={result.visitsPerformed === null ? null : number.format(result.visitsPerformed)}
          detail="Período selecionado"
        />
        <Kpi
          label="Vendas no período"
          value={result.sales === null ? null : number.format(result.sales)}
          detail="Período selecionado"
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
              isSelected={(bucket) =>
                filters.createdDate === bucket.key || selectedDates.includes(bucket.key)
              }
              onSelect={(bucket) => toggleCalendarDate(bucket.key)}
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
              isSelected={() => selectedDates.includes(analysis.referenceDate)}
              onSelect={() => {
                if (selectedMonth !== referenceMonth) selectMonth(referenceMonth);
                setFilters((current) => ({
                  ...current,
                  createdDates: [analysis.referenceDate],
                }));
              }}
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

      <div className={styles.recencyGrid}>
        <RecencyPanel
          title="Último agendamento: até 7 dias"
          items={result.brokerRecency.upTo7Days}
        />
        <RecencyPanel
          title="Último agendamento: de 8 a 14 dias"
          items={result.brokerRecency.from8To14Days}
        />
        <RecencyPanel
          title="Último agendamento: 15 dias ou mais"
          items={result.brokerRecency.from15Days}
        />
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
                onChange={(event) => {
                  setSelectedYear(event.target.value);
                  setSelectedRow("");
                  setRowBaseFilters(null);
                }}
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
            monthly
            onSelect={(bucket) => {
              const nextMonth = `${selectedYear}-${bucket.key}`;
              selectMonth(nextMonth);
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
              setFilters(rowBaseFilters ?? {});
              setRowBaseFilters(null);
            } else {
              const baseFilters = rowBaseFilters ?? filters;
              setRowBaseFilters(baseFilters);
              setSelectedRow(key);
              setFilters({ ...baseFilters, ...rowFilters });
            }
          }}
        />
      )}
    </div>
  );
}
