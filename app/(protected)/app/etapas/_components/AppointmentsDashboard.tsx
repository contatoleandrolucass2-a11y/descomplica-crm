"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ArrowLeftRight, CalendarDays, X } from "lucide-react";

import { ConfigurableDashboardCanvas } from "@/lib/dashboard-canvas/ui/configurable";
import { APPOINTMENTS_CARD_LAYOUT_POLICY } from "@/lib/dashboard-canvas/layout/limits";
import type { DashboardContentByMetricAndType } from "@/lib/dashboard-canvas/ui/configurable/types";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import type {
  AppointmentConversionGoals,
  AppointmentConversionGoalsByMonth,
} from "@/lib/crm/stages/data";
import { resolveAppointmentConversionPeriod } from "@/lib/crm/stages/appointment-conversion-goals";
import {
  analyzeAppointments,
  appointmentYears,
  saoPauloDate,
  type AppointmentBrokerRosterEntry,
  type AppointmentBucket,
  type AppointmentConversionBucket,
  type AppointmentFilters,
  type AppointmentGoalsByMonth,
} from "@/lib/crm/stages/appointments";

import styles from "./AppointmentsDashboard.module.css";
import {
  APPOINTMENTS_CANVAS_CATALOG,
  APPOINTMENTS_CANVAS_COMPATIBILITY,
  APPOINTMENTS_CANVAS_DEFAULT_CARDS,
  APPOINTMENTS_CANVAS_PAGE_KEY,
} from "./appointments-canvas-config";
import { useDashboardSidebar } from "../../../_components/DashboardShell";

const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
// Keep full identities as filter keys; compact only the visible label.
function shortName(value: string) {
  if (/não informad|sem responsável|sem gerente/i.test(value)) return value;
  const parts = value.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : value;
}
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
type GoalStatus = "positive" | "negative" | "neutral";
type FunnelGoalStatuses = Partial<Record<keyof FunnelValues, GoalStatus>>;
type FunnelValues = {
  opportunities: number;
  appointments: number;
  visits: number;
  folders: number;
  approvedFolders: number;
  sales: number;
};

function atLeastStatus(value: number | null, goal: number | null): GoalStatus {
  if (value === null || goal === null || goal <= 0) return "neutral";
  return value >= goal ? "positive" : "negative";
}

function atMostStatus(value: number | null, goal: number | null): GoalStatus {
  if (value === null || goal === null || goal <= 0) return "neutral";
  const roundingTolerance = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(goal)) * 4;
  return value <= goal + roundingTolerance ? "positive" : "negative";
}

function Chart({
  title,
  children,
  controls,
}: {
  title: string;
  children: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <section className={styles.canvasChart} aria-label={title}>
      <h2 className="sr-only">{title}</h2>
      {controls ? <div className={styles.canvasChartControls}>{controls}</div> : null}
      <div
        className={styles.cardBody}
        tabIndex={0}
        role="region"
        aria-label={`Conteúdo de ${title}`}
      >
        {children}
      </div>
    </section>
  );
}

function Empty({ children = "Nenhum agendamento no período coberto." }: { children?: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function TiltCard({
  className,
  children,
  goalStatus = "neutral",
  statusLabel,
}: {
  className: string | undefined;
  children: ReactNode;
  goalStatus?: GoalStatus;
  statusLabel?: string | undefined;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--card-tilt-x", `${vertical * -45}deg`);
    event.currentTarget.style.setProperty("--card-tilt-y", `${horizontal * 45}deg`);
  };
  const reset = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--card-tilt-x", "0deg");
    event.currentTarget.style.setProperty("--card-tilt-y", "0deg");
  };
  return (
    <article
      className={[styles.card, styles.tiltCard, className].filter(Boolean).join(" ")}
      data-goal-status={goalStatus}
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {statusLabel ? <span className="sr-only">{statusLabel}</span> : null}
      {children}
      <button
        ref={trigger}
        type="button"
        className={styles.cardPopupTrigger}
        aria-label="Abrir detalhes deste indicador"
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          requestAnimationFrame(() => close.current?.focus());
        }}
      />
      <dialog
        ref={dialog}
        className={styles.cardDialog}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <div className={styles.cardDialogPanel}>
          <header>
            <h2 id={titleId}>Detalhes do indicador</h2>
            <button
              ref={close}
              type="button"
              aria-label="Fechar detalhes do indicador"
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </header>
          <div className={styles.cardDialogContent}>{children}</div>
          {statusLabel ? <p className={styles.cardDialogStatus}>{statusLabel}</p> : null}
        </div>
      </dialog>
    </article>
  );
}

function Columns({
  buckets,
  label,
  daily = false,
  selected,
  isSelected,
  onSelect,
  monthly = false,
  verticalLabels = false,
}: {
  buckets: (AppointmentBucket & { goal?: number | null })[];
  label: string;
  daily?: boolean;
  selected?: string | undefined;
  isSelected?: ((bucket: AppointmentBucket) => boolean) | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
  monthly?: boolean;
  verticalLabels?: boolean;
}) {
  if (!buckets.length) return <Empty />;
  // The editor allows 150% height. Reserve that headroom for both bars and goals
  // so changing presentation never changes their relative quantitative scale.
  const max = Math.max(1, ...buckets.flatMap((item) => [item.total, item.goal ?? 0])) * 1.5;
  return (
    <>
      <p className={styles.axis}>Quantidade de agendamentos</p>
      <ol
        aria-label={label}
        className={`${styles.columns} ${daily ? styles.daily : ""} ${monthly ? styles.monthly : ""} ${verticalLabels ? styles.verticalLabels : ""}`}
        style={{ "--column-count": buckets.length } as CSSProperties}
      >
        {buckets.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={isSelected ? isSelected(item) : selected === item.key}
              aria-label={`${daily ? displayDate(item.key) : item.label}: ${number.format(item.total)} agendamentos${item.goal == null ? "" : `; meta ${number.format(item.goal)}; ${item.total >= item.goal ? "meta atingida" : "abaixo da meta"}`}`}
              className={styles.chartButton}
              onClick={() => onSelect?.(item)}
            >
              <div
                className={styles.columnTrack}
                style={{ "--bar-height": `${(item.total / max) * 100}%` } as CSSProperties}
              >
                {item.goal != null && (
                  <span
                    className={styles.goalLine}
                    style={{
                      bottom: `calc(${(item.goal / max) * 100}% * var(--dashboard-bar-scale, 1))`,
                    }}
                    title={`Meta: ${number.format(item.goal)}`}
                  />
                )}
                <div
                  className={styles.column}
                  data-goal-status={
                    item.goal == null
                      ? "goal" in item
                        ? "unavailable"
                        : "neutral"
                      : item.total >= item.goal
                        ? "positive"
                        : "negative"
                  }
                  style={{
                    height: "calc(var(--bar-height) * var(--dashboard-bar-scale, 1))",
                  }}
                />
                <span className={styles.columnValue}>{number.format(item.total)}</span>
              </div>
              <span className={styles.columnLabel}>{item.label}</span>
            </button>
          </li>
        ))}
      </ol>
      {buckets.some((item) => item.goal != null) && (
        <p className={styles.axis}>
          Vermelho: abaixo da meta · Azul: meta atingida · Traço: meta do período
        </p>
      )}
      {buckets.some((item) => "goal" in item) && buckets.every((item) => item.goal == null) && (
        <p className={styles.axis}>
          Meta não definida para este recorte · Sem classificação de produtividade
        </p>
      )}
    </>
  );
}

function Ranking({
  buckets,
  total,
  unavailable = "Dados indisponíveis nesta atualização.",
  selected,
  onSelect,
}: {
  buckets: AppointmentBucket[] | null;
  total: number;
  unavailable?: string;
  selected?: string | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
}) {
  if (buckets === null) return <Empty>{unavailable}</Empty>;
  if (!buckets.length) return <Empty />;
  const max = buckets[0]!.total;
  return (
    <>
      <div className={styles.rankingLabels} aria-hidden="true">
        <span>Nome</span>
        <span>Qtd.</span>
        <span>% do total</span>
      </div>
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
                  <span className={styles.rank}>{index + 1}.</span>{" "}
                  <span title={item.label}>{shortName(item.label)}</span>
                </span>
                <strong>{number.format(item.total)}</strong>
                <strong
                  title="Participação no total filtrado"
                  aria-label={`Participação no total: ${total > 0 ? decimal.format((item.total / total) * 100) : "0"}%`}
                >
                  {total > 0 ? decimal.format((item.total / total) * 100) : "0"}%
                </strong>
              </div>
              <div aria-hidden="true" className={styles.rankTrack}>
                <div
                  className={styles.rankBar}
                  style={{ "--rank-size": `${(item.total / max) * 100}%` } as CSSProperties}
                />
              </div>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function ConversionRanking({
  buckets,
  total,
  available,
}: {
  buckets: AppointmentConversionBucket[];
  total: number;
  available: boolean;
}) {
  if (!available) return <Empty>Conversão indisponível para este recorte.</Empty>;
  if (!buckets.length) return <Empty>Nenhuma conversão maior que zero no período.</Empty>;
  const max = Math.max(...buckets.map((item) => item.percent));
  return (
    <>
      <div className={styles.rankingLabels} aria-hidden="true">
        <span>Nome</span>
        <span>Conversão</span>
        <span>% do total</span>
      </div>
      <ol className={styles.conversionRanking}>
        {buckets.map((item, index) => (
          <li key={item.key}>
            <div className={styles.conversionRankingHeading}>
              <span>
                <span className={styles.rank}>{index + 1}.</span>{" "}
                <span title={item.label}>{shortName(item.label)}</span>
              </span>
              <strong>{decimal.format(item.percent)}%</strong>
              <strong
                title="Participação dos agendamentos no total filtrado"
                aria-label={`Participação no total: ${total > 0 ? decimal.format((item.appointments / total) * 100) : "0"}%`}
              >
                {total > 0 ? decimal.format((item.appointments / total) * 100) : "0"}%
              </strong>
            </div>
            <p>
              {number.format(item.appointments)} agendamentos → {number.format(item.visits)} visitas
              · {decimal.format(item.ratio)} para 1
            </p>
            <div aria-hidden="true" className={styles.rankTrack}>
              <div
                className={styles.rankBar}
                style={{ "--rank-size": `${(item.percent / max) * 100}%` } as CSSProperties}
              />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

const funnelStages: Array<{ key: keyof FunnelValues; label: string }> = [
  { key: "opportunities", label: "Oportunidades" },
  { key: "appointments", label: "Agendamentos" },
  { key: "visits", label: "Visitas" },
  { key: "folders", label: "Pastas" },
  { key: "approvedFolders", label: "Pastas aprovadas" },
  { key: "sales", label: "Vendas" },
];

function FunnelGraphic({
  values,
  label,
  statuses,
}: {
  values: FunnelValues | null;
  label: string;
  statuses?: FunnelGoalStatuses;
}) {
  if (!values) return <Empty>Meta do funil indisponível para este recorte.</Empty>;
  return (
    <ol className={styles.funnel} aria-label={label}>
      {funnelStages.map((stage, index) => (
        <li
          key={stage.key}
          data-goal-status={statuses?.[stage.key] ?? "positive"}
          style={{ "--funnel-level": index } as CSSProperties}
        >
          <span>{stage.label}</span>
          <strong>{number.format(Math.round(values[stage.key]))}</strong>
        </li>
      ))}
    </ol>
  );
}

function FunnelConversions({ values }: { values: FunnelValues | null }) {
  if (!values) return <Empty>Conversões indisponíveis para este recorte.</Empty>;
  const rows: Array<[string, number, number, string, string]> = [
    [
      "Oportunidade x agendamento",
      values.opportunities,
      values.appointments,
      "oportunidades",
      "agendamento",
    ],
    ["Agendamento x visita", values.appointments, values.visits, "agendamentos", "visita"],
    ["Agendamento x Pasta", values.appointments, values.folders, "agendamentos", "Pasta"],
    [
      "Agendamento x Pasta Aprovada",
      values.appointments,
      values.approvedFolders,
      "agendamentos",
      "Pasta Aprovada",
    ],
    ["Agendamento x Venda", values.appointments, values.sales, "agendamentos", "Venda"],
  ];
  return (
    <ol className={styles.funnelConversions}>
      {rows.map(([label, source, target, sourceUnit, targetUnit]) => {
        const percent = source > 0 ? (target / source) * 100 : null;
        const ratio = target > 0 ? source / target : null;
        return (
          <li key={label}>
            <span>{label}</span>
            <strong>{percent === null ? "—" : `${decimal.format(percent)}%`}</strong>
            <small>
              {ratio === null
                ? "Sem conversão no período"
                : `${decimal.format(ratio)} ${sourceUnit} para 1 ${targetUnit}`}
            </small>
          </li>
        );
      })}
    </ol>
  );
}

function FunnelComparison({
  expected,
  realized,
  realizedStatuses,
}: {
  expected: FunnelValues | null;
  realized: FunnelValues | null;
  realizedStatuses: FunnelGoalStatuses;
}) {
  const [swapped, setSwapped] = useState(false);
  const swapControl = (side: "left" | "right") => (
    <button
      type="button"
      className={styles.swapFunnels}
      onClick={() => setSwapped((current) => !current)}
      aria-label={`Trocar os conjuntos de funil a partir do lado ${side === "left" ? "esquerdo" : "direito"}`}
      title="Trocar posição dos conjuntos"
    >
      <ArrowLeftRight size={16} aria-hidden="true" /> Trocar posição
    </button>
  );
  const expectedPanel = (
    <article key="expected">
      <header className={styles.funnelHeading}>
        <div>
          <h2>Funil esperado no período</h2>
          <p>Projeção proporcional da meta para os dias e filtros selecionados.</p>
        </div>
        {swapControl(swapped ? "left" : "right")}
      </header>
      <div className={styles.funnelPanel}>
        <FunnelConversions values={expected} />
        <FunnelGraphic values={expected} label="Funil esperado no período" />
      </div>
    </article>
  );
  const realizedPanel = (
    <article key="realized">
      <header className={styles.funnelHeading}>
        <div>
          <h2>Realizado até o momento</h2>
          <p>Resultados consolidados no período e filtros selecionados.</p>
        </div>
        {swapControl(swapped ? "right" : "left")}
      </header>
      <div className={`${styles.funnelPanel} ${styles.funnelPanelReversed}`}>
        <FunnelGraphic
          values={realized}
          label="Funil realizado no período"
          statuses={realizedStatuses}
        />
        <FunnelConversions values={realized} />
      </div>
    </article>
  );
  return (
    <section
      className={`${styles.card} ${styles.funnelComparison}`}
      aria-label="Funis esperado e realizado"
    >
      {swapped ? expectedPanel : realizedPanel}
      <div className={styles.funnelDivider} aria-hidden="true" />
      {swapped ? realizedPanel : expectedPanel}
    </section>
  );
}

function Kpi({
  label,
  value,
  detail,
  goalStatus = "neutral",
  statusLabel,
}: {
  label: string;
  value: string | null;
  detail: string;
  goalStatus?: GoalStatus;
  statusLabel?: string | undefined;
}) {
  return (
    <TiltCard className={styles.kpiCard} goalStatus={goalStatus} statusLabel={statusLabel}>
      <h2>{label}</h2>
      <strong className={styles.metricValue}>{value ?? "Indisponível"}</strong>
      <p>{detail}</p>
    </TiltCard>
  );
}

function ProductiveTeamCard({
  productive,
  brokers,
  percent,
  unavailableDetail,
}: {
  productive: number | null;
  brokers: number | null;
  percent: number | null;
  unavailableDetail: string;
}) {
  const progress = Math.min(Math.max(percent ?? 0, 0), 100);
  const goalStatus = atLeastStatus(percent, 100);
  return (
    <TiltCard
      className={`${styles.kpiCard} ${styles.productiveCard}`}
      goalStatus={goalStatus}
      statusLabel={
        percent === null
          ? "Meta de equipe produtiva indisponível"
          : `${goalStatus === "positive" ? "Meta atingida" : "Abaixo da meta"}: ${decimal.format(percent)}% de 100%`
      }
    >
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
        <strong className={styles.metricValue}>
          {percent === null ? "—" : `${decimal.format(percent)}%`}
        </strong>
      </div>
      <p>
        {productive === null || brokers === null
          ? unavailableDetail
          : `${number.format(productive)} de ${number.format(brokers)} corretores com agendamento`}
      </p>
    </TiltCard>
  );
}

function ConversionKpi({
  title,
  source,
  target,
  sourceUnit,
  targetUnit,
  goal,
  goalContext,
}: {
  title: string;
  source: number | null;
  target: number | null;
  sourceUnit: string;
  targetUnit: string;
  goal: number | null;
  goalContext: string;
}) {
  const percent = source !== null && target !== null && source > 0 ? (target / source) * 100 : null;
  const ratio = source !== null && target !== null && target > 0 ? source / target : null;
  const goalStatus = atMostStatus(ratio, goal);
  const statusLabel =
    ratio === null
      ? "Conversão indisponível no período selecionado"
      : goal === null
        ? `Meta de conversão não configurada para ${goalContext}`
        : `${goalStatus === "positive" ? "Dentro da meta" : "Acima da meta"}: ${decimal.format(ratio)} para 1; limite ${decimal.format(goal)} para 1`;
  return (
    <TiltCard className={styles.conversionCard} goalStatus={goalStatus} statusLabel={statusLabel}>
      <h2>{title}</h2>
      {source === null || target === null ? (
        <strong className={styles.metricValue}>Indisponível</strong>
      ) : (
        <strong
          className={`${styles.conversionPercent} ${styles.metricValue}`}
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
    </TiltCard>
  );
}

function addCalendarDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function CalendarFilter({
  month,
  years,
  coverageStart,
  referenceDate,
  selectedDates,
  periodLabel,
  onMonthChange,
  onToggleDate,
  onSelectWholeMonth,
  onSelectRange,
}: {
  month: string;
  years: string[];
  coverageStart: string;
  referenceDate: string;
  selectedDates: string[];
  periodLabel?: string | undefined;
  onMonthChange: (month: string) => void;
  onToggleDate: (date: string) => void;
  onSelectWholeMonth: () => void;
  onSelectRange: (start: string, end: string, label: string) => void;
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
    periodLabel ??
    (selectedDates.length === 0
      ? `${monthNames[monthNumber - 1]} de ${year}`
      : selectedDates.length === 1
        ? displayDate(selectedDates[0]!)
        : `${selectedDates.length} dias selecionados`);
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
  const referenceMonth = referenceDate.slice(0, 7);
  const referenceYear = Number(referenceDate.slice(0, 4));
  const referenceWeekday = new Date(`${referenceDate}T12:00:00Z`).getUTCDay();
  const mondayOffset = referenceWeekday === 0 ? -6 : 1 - referenceWeekday;
  const thisWeekStart = addCalendarDays(referenceDate, mondayOffset);
  const thisWeekEnd = addCalendarDays(thisWeekStart, 6);
  const lastWeekStart = addCalendarDays(thisWeekStart, -7);
  const lastWeekEnd = addCalendarDays(thisWeekStart, -1);
  const withinCurrentMonth = (start: string, end: string) => ({
    start: start < `${referenceMonth}-01` ? `${referenceMonth}-01` : start,
    end: end > referenceDate ? referenceDate : end,
  });
  const presets = [
    { label: "Hoje", start: referenceDate, end: referenceDate },
    {
      label: "Ontem",
      start: addCalendarDays(referenceDate, -1),
      end: addCalendarDays(referenceDate, -1),
      currentMonthOnly: true,
    },
    {
      label: "Esta semana",
      ...withinCurrentMonth(thisWeekStart, thisWeekEnd),
    },
    {
      label: "Semana passada",
      ...withinCurrentMonth(lastWeekStart, lastWeekEnd),
    },
    {
      label: "Este ano",
      start: `${referenceYear}-01-01`,
      end: referenceDate,
    },
    ...([1, 2, 3, 4] as const).map((quarter) => {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      const quarterEnd = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
      return {
        label: `${quarter}º Trimestre`,
        start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
        end: quarterEnd > referenceDate ? referenceDate : quarterEnd,
      };
    }),
  ];
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
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
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
            Use um atalho, escolha o mês inteiro ou selecione um ou vários dias.
          </p>
          <div className={styles.calendarPresets} aria-label="Atalhos de período">
            {presets.map((preset) => {
              const unavailable =
                preset.start > preset.end ||
                preset.end < coverageStart ||
                preset.start > referenceDate ||
                ("currentMonthOnly" in preset &&
                  preset.currentMonthOnly &&
                  preset.start.slice(0, 7) !== referenceMonth);
              const start = preset.start < coverageStart ? coverageStart : preset.start;
              const end = preset.end > referenceDate ? referenceDate : preset.end;
              return (
                <button
                  key={`${preset.label}-${year}`}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    onSelectRange(start, end, preset.label);
                    dialog.current?.close();
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
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
            <button
              type="button"
              onClick={() => {
                onSelectWholeMonth();
                dialog.current?.close();
              }}
            >
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
  periodLabel,
  onMonthChange,
  onToggleDate,
  onSelectWholeMonth,
  onSelectRange,
}: {
  filters: AppointmentFilters;
  options: {
    channels: { key: 0 | 1; label: string }[];
    regionalManagers: string[];
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
  periodLabel?: string | undefined;
  onMonthChange: (month: string) => void;
  onToggleDate: (date: string) => void;
  onSelectWholeMonth: () => void;
  onSelectRange: (start: string, end: string, label: string) => void;
}) {
  const selects = [
    {
      key: "regionalManager" as const,
      label: "Gerente Regional",
      empty: "Todos os gerentes regionais",
      values: options.regionalManagers,
    },
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
                onClick={() => onChange("channel", option.key)}
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
                  {filter.key === "company" ? value : shortName(value)}
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
        periodLabel={periodLabel}
        onMonthChange={onMonthChange}
        onToggleDate={onToggleDate}
        onSelectWholeMonth={onSelectWholeMonth}
        onSelectRange={onSelectRange}
      />
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
  const tone =
    items.length === 0
      ? "blue"
      : title.includes("15 dias")
        ? "red"
        : title.includes("8 a 14")
          ? "yellow"
          : "blue";
  return (
    <section className={styles.recencyPanel} data-tone={tone} aria-label={title}>
      <h2 className="sr-only">{title}</h2>
      <span className={styles.recencyCount}>{number.format(items.length)} corretores</span>
      {items.length === 0 ? (
        <Empty>Nenhum corretor nesta faixa.</Empty>
      ) : (
        <ol className={styles.recencyList} tabIndex={0} aria-label={title}>
          {items.map((item) => (
            <li key={item.owner}>
              <strong title={item.owner}>{shortName(item.owner)}</strong>
              <span className={styles.recencyManager} title={item.manager}>
                <span>{item.manager ? shortName(item.manager) : "Gerente não informado"}</span>
                <small>Último: {displayDate(item.lastAppointmentDate)}</small>
              </span>
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
      <strong className={styles.metricValue}>
        {goal === null
          ? "Meta indisponível"
          : `${number.format(current)} de ${number.format(goal)}`}
      </strong>
      <p>
        {goal === 0
          ? "Meta cadastrada: 0 · meta atingida"
          : percent === null
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
        <div
          className={styles.tableViewport}
          tabIndex={0}
          role="region"
          aria-label="Detalhamento dos agendamentos"
        >
          <table>
            <thead>
              <tr>
                <th>Data de criação</th>
                <th>Qnt. de dias</th>
                <th>Horário</th>
                <th>Data de comparecimento</th>
                <th>Visita Realizada</th>
                <th>Gerente Regional</th>
                <th>Gerente de Vendas</th>
                <th>Corretor</th>
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
                    <td data-label="Data de criação">{date.format(new Date(row.createdAt))}</td>
                    <td data-label="Qnt. de dias">{number.format(row.daysSinceAppointment)}</td>
                    <td data-label="Horário">
                      {row.scheduledAt ? time.format(new Date(row.scheduledAt)) : "Não informado"}
                    </td>
                    <td data-label="Data de comparecimento">
                      {row.attendedAt ? date.format(new Date(row.attendedAt)) : "Não informado"}
                    </td>
                    <td data-label="Visita realizada">{row.visitPerformed ? "Sim" : "Não"}</td>
                    <td data-label="Gerente Regional" title={row.regionalManager}>
                      {value(shortName(row.regionalManager))}
                    </td>
                    <td data-label="Gerente de Vendas" title={row.salesManager}>
                      {value(shortName(row.salesManager))}
                    </td>
                    <td data-label="Corretor" title={row.owner}>
                      {value(shortName(row.owner))}
                    </td>
                    <td data-label="Conta">{value(row.accountName)}</td>
                    <td data-label="Ranking">{value(row.accountRanking)}</td>
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
  brokerRoster = null,
  generatedAt,
  individualGoal = null,
  goalsByMonth,
  conversionGoals = null,
  conversionGoalsByMonth,
  timezone = "America/Sao_Paulo",
  canViewDevelopmentRankings = true,
  canEditDashboard = false,
}: {
  analysis: DashboardAnalysisSlice | null;
  brokerRoster?: AppointmentBrokerRosterEntry[] | null | undefined;
  generatedAt?: string | undefined;
  individualGoal?: number | null | undefined;
  goalsByMonth?: AppointmentGoalsByMonth | undefined;
  conversionGoals?: AppointmentConversionGoals | null | undefined;
  conversionGoalsByMonth?: AppointmentConversionGoalsByMonth | undefined;
  timezone?: string | undefined;
  canViewDevelopmentRankings?: boolean | undefined;
  canEditDashboard?: boolean | undefined;
}) {
  const dashboardSidebar = useDashboardSidebar();
  const [monthChoice, setSelectedMonth] = useState("");
  const [yearChoice, setSelectedYear] = useState("");
  const [filters, setFilters] = useState<AppointmentFilters>({ channel: 1 });
  const [periodLabel, setPeriodLabel] = useState<string>();
  const [selectedRow, setSelectedRow] = useState("");
  const [rowBaseFilters, setRowBaseFilters] = useState<AppointmentFilters | null>(null);
  const generatedAtLabel = useMemo(
    () =>
      generatedAt
        ? new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timezone,
          }).format(new Date(generatedAt))
        : "",
    [generatedAt, timezone],
  );

  useEffect(() => {
    dashboardSidebar?.setUpdatedAt(generatedAtLabel);
    return () => dashboardSidebar?.setUpdatedAt("");
  }, [dashboardSidebar, generatedAtLabel]);

  const selectedMonth = monthChoice || analysis?.referenceDate.slice(0, 7) || "";
  const selectedYear = yearChoice || analysis?.referenceDate.slice(0, 4) || "";
  const resolvedGoals = useMemo(
    () =>
      goalsByMonth ?? (analysis ? { [analysis.referenceDate.slice(0, 7)]: individualGoal } : {}),
    [goalsByMonth, analysis, individualGoal],
  );
  const result = useMemo(
    () =>
      analysis
        ? analyzeAppointments(analysis, {
            month: selectedMonth,
            year: selectedYear,
            filters,
            brokerRoster,
            goalsByMonth: resolvedGoals,
          })
        : null,
    [analysis, brokerRoster, filters, selectedMonth, selectedYear, resolvedGoals],
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
  const monthlyGoal = result.monthlyGoal;
  const selectedChannel = filters.channel;
  const goalProfile = selectedChannel === 1 ? "dv" : selectedChannel === 0 ? "partnerships" : null;
  const periodConversionGoals = resolveAppointmentConversionPeriod({
    month: selectedMonth,
    coverageStart: analysis.coverageStart,
    referenceDate: analysis.referenceDate,
    filters,
    goalsByMonth:
      conversionGoalsByMonth ?? (conversionGoals ? { [referenceMonth]: conversionGoals } : {}),
    profile: goalProfile,
  });
  const activeConversionGoals = periodConversionGoals?.conversionGoals ?? null;
  const rosterUnavailableDetail =
    result.rosterUnavailableReason === "unsupported-dimensions"
      ? "Base cadastral indisponível para este recorte"
      : result.rosterUnavailableReason === "unknown-regional-link"
        ? "Vínculo regional do cadastro indisponível no período"
        : "Aguardando o elenco vigente de corretores";
  const goalContext =
    selectedChannel === 1
      ? "House"
      : selectedChannel === 0
        ? "Imob / Parcerias"
        : "o recorte misto";
  const rangeActive = Boolean(filters.periodStart || filters.periodEnd);
  const calendarActive =
    selectedMonth !== referenceMonth || selectedDates.length > 0 || rangeActive;
  const activeFilterCount =
    Object.entries(filters).filter(
      ([key, value]) =>
        key !== "createdDates" &&
        key !== "periodStart" &&
        key !== "periodEnd" &&
        value !== undefined &&
        value !== "" &&
        value !== null,
    ).length + (calendarActive ? 1 : 0);
  const goalCohort =
    selectedChannel === 1
      ? result.brokerCount
      : selectedChannel === 0
        ? result.registeredManagerCount
        : null;
  const expectedFunnel: FunnelValues | null = (() => {
    const period = periodConversionGoals?.funnelPerParticipant;
    if (!period || goalCohort === null) return null;
    return {
      opportunities: period.opportunities * goalCohort,
      appointments: period.appointments * goalCohort,
      visits: period.visits * goalCohort,
      folders: period.folders * goalCohort,
      approvedFolders: period.approvedFolders * goalCohort,
      sales: period.sales * goalCohort,
    };
  })();
  const realizedStatuses: FunnelGoalStatuses = (() => {
    const ratio = (source: number, target: number) => (target > 0 ? source / target : null);
    const realized = result.funnel;
    return {
      opportunities: "positive",
      appointments: realized
        ? atMostStatus(
            ratio(realized.opportunities, realized.appointments),
            activeConversionGoals?.opportunityAppointment ?? null,
          )
        : "neutral",
      visits: realized
        ? atMostStatus(
            ratio(realized.appointments, realized.visits),
            activeConversionGoals?.appointmentVisit ?? null,
          )
        : "neutral",
      folders: realized
        ? atMostStatus(
            ratio(realized.appointments, realized.folders),
            activeConversionGoals?.appointmentFolder ?? null,
          )
        : "neutral",
      approvedFolders: realized
        ? atMostStatus(
            ratio(realized.appointments, realized.approvedFolders),
            activeConversionGoals?.appointmentApprovedFolder ?? null,
          )
        : "neutral",
      sales: realized
        ? atMostStatus(
            ratio(realized.appointments, realized.sales),
            activeConversionGoals?.appointmentSale ?? null,
          )
        : "neutral",
    };
  })();
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
    setPeriodLabel(undefined);
    setFilters((current) => {
      const next = { ...current };
      delete next.createdDate;
      delete next.createdDates;
      delete next.week;
      delete next.periodStart;
      delete next.periodEnd;
      return next;
    });
  };
  const toggleCalendarDate = (date: string) => {
    setSelectedRow("");
    setRowBaseFilters(null);
    setPeriodLabel(undefined);
    setFilters((current) => {
      const currentDates = current.createdDates ?? [];
      const nextDates = currentDates.includes(date)
        ? currentDates.filter((item) => item !== date)
        : [...currentDates, date].sort();
      const next = { ...current };
      delete next.createdDate;
      delete next.week;
      delete next.periodStart;
      delete next.periodEnd;
      if (nextDates.length === 0) delete next.createdDates;
      else next.createdDates = nextDates;
      return next;
    });
  };
  const selectWholeMonth = () => {
    setSelectedRow("");
    setRowBaseFilters(null);
    setPeriodLabel(undefined);
    setFilters((current) => {
      const next = { ...current };
      delete next.createdDate;
      delete next.createdDates;
      delete next.week;
      delete next.periodStart;
      delete next.periodEnd;
      return next;
    });
  };
  const selectRange = (start: string, end: string, label: string) => {
    setSelectedMonth(start.slice(0, 7));
    setSelectedYear(start.slice(0, 4));
    setPeriodLabel(label);
    setSelectedRow("");
    setRowBaseFilters(null);
    setFilters((current) => {
      const next = { ...current, periodStart: start, periodEnd: end };
      delete next.createdDate;
      delete next.createdDates;
      delete next.week;
      return next;
    });
  };
  const clearAllFilters = () => {
    setSelectedMonth("");
    setSelectedYear("");
    setFilters({ channel: 1 });
    setPeriodLabel(undefined);
    setSelectedRow("");
    setRowBaseFilters(null);
  };
  const paired =
    result.performedToday === null
      ? []
      : [
          ...(result.plannedToday === null
            ? []
            : [
                {
                  key: "planned",
                  label: "Previstos hoje",
                  total: result.plannedToday,
                  goal: result.todayGoal,
                },
              ]),
          {
            key: "performed",
            label: "Realizados",
            total: result.performedToday,
            goal: result.todayGoal,
          },
        ];
  const productiveStatus = atLeastStatus(result.productivePercent, 100);
  const contentByMetricAndType: DashboardContentByMetricAndType = {
    "appointments.goal": {
      kpi: (
        <TiltCard
          className={styles.gaugeCard}
          goalStatus={atLeastStatus(result.total, monthlyGoal)}
          statusLabel={
            monthlyGoal === null
              ? "Meta mensal indisponível"
              : `${result.total >= monthlyGoal ? "Meta mensal atingida" : "Abaixo da meta mensal"}: ${number.format(result.total)} de ${number.format(monthlyGoal)}`
          }
        >
          <h2>Meta do mês</h2>
          <GoalGauge current={result.total} goal={monthlyGoal} />
          <span className={styles.goalFormula}>
            {monthlyGoal === null ||
            resolvedGoals[selectedMonth] == null ||
            result.goalBrokerCount === null
              ? "Meta individual ou corretores indisponíveis"
              : `${number.format(resolvedGoals[selectedMonth]!)} por corretor × ${number.format(result.goalBrokerCount)} corretores`}
          </span>
        </TiltCard>
      ),
    },
    "team.productive": {
      donut: (
        <ProductiveTeamCard
          productive={result.productiveBrokers}
          brokers={result.brokerCount}
          percent={result.productivePercent}
          unavailableDetail={rosterUnavailableDetail}
        />
      ),
      kpi: (
        <Kpi
          label="Equipe produtiva"
          value={
            result.productivePercent === null
              ? null
              : `${decimal.format(result.productivePercent)}%`
          }
          detail={
            result.productiveBrokers === null || result.brokerCount === null
              ? rosterUnavailableDetail
              : `${number.format(result.productiveBrokers)} de ${number.format(result.brokerCount)} corretores com agendamento`
          }
          goalStatus={productiveStatus}
          statusLabel={
            result.productivePercent === null
              ? "Meta de equipe produtiva indisponível"
              : `${productiveStatus === "positive" ? "Meta atingida" : "Abaixo da meta"}: ${decimal.format(result.productivePercent)}% de 100%`
          }
        />
      ),
    },
    "brokers.total": {
      kpi: (
        <Kpi
          label="Corretores cadastrados"
          value={result.brokerCount === null ? null : number.format(result.brokerCount)}
          detail={
            result.brokerCount === null
              ? rosterUnavailableDetail
              : "Total vigente do relatório de corretores"
          }
        />
      ),
    },
    "managers.total": {
      kpi: (
        <Kpi
          label="Gerentes cadastrados"
          value={
            result.registeredManagerCount === null
              ? null
              : number.format(result.registeredManagerCount)
          }
          detail={
            result.registeredManagerCount === null
              ? rosterUnavailableDetail
              : "Gerentes de Vendas vinculados aos corretores"
          }
        />
      ),
    },
    "visits.total": {
      kpi: (
        <Kpi
          label="Visitas realizadas"
          value={result.visitsPerformed === null ? null : number.format(result.visitsPerformed)}
          detail="Período selecionado"
        />
      ),
    },
    "sales.total": {
      kpi: (
        <Kpi
          label="Vendas no período"
          value={result.sales === null ? null : number.format(result.sales)}
          detail="Período selecionado"
        />
      ),
    },
    "conversion.opportunity-appointment": {
      kpi: (
        <ConversionKpi
          title="Oportunidade x Agendamento"
          source={result.funnel?.opportunities ?? null}
          target={result.funnel?.appointments ?? null}
          sourceUnit="oportunidades"
          targetUnit="agendamento"
          goal={activeConversionGoals?.opportunityAppointment ?? null}
          goalContext={goalContext}
        />
      ),
    },
    "conversion.appointment-visit": {
      kpi: (
        <ConversionKpi
          title="Agendamento x Visita"
          source={result.funnel?.appointments ?? null}
          target={result.funnel?.visits ?? null}
          sourceUnit="agendamentos"
          targetUnit="visita"
          goal={activeConversionGoals?.appointmentVisit ?? null}
          goalContext={goalContext}
        />
      ),
    },
    "conversion.appointment-sale": {
      kpi: (
        <ConversionKpi
          title="Agendamento x Venda"
          source={result.funnel?.appointments ?? null}
          target={result.funnel?.sales ?? null}
          sourceUnit="agendamentos"
          targetUnit="venda"
          goal={activeConversionGoals?.appointmentSale ?? null}
          goalContext={goalContext}
        />
      ),
    },
    "appointments.rate": {
      kpi: (
        <Kpi
          label="Média de agendamentos"
          value={result.dailyAverage === null ? null : decimal.format(result.dailyAverage)}
          detail="Média diária no período selecionado"
          goalStatus={atLeastStatus(result.dailyAverage, result.dailyAverageGoal)}
          statusLabel={
            result.dailyAverage === null || result.dailyAverageGoal === null
              ? "Comparação com a meta indisponível"
              : `${result.dailyAverage >= result.dailyAverageGoal ? "Meta atingida" : "Abaixo da meta"}: média ${decimal.format(result.dailyAverage)} para meta diária média ${decimal.format(result.dailyAverageGoal)}`
          }
        />
      ),
    },
    "appointments.yesterday": {
      kpi: (
        <Kpi
          label="Agendamentos ontem"
          value={number.format(result.yesterday)}
          detail="Pela data de criação"
          goalStatus={atLeastStatus(result.yesterday, result.yesterdayGoal)}
          statusLabel={
            result.yesterdayGoal === null
              ? "Comparação com a meta indisponível"
              : `${result.yesterday >= result.yesterdayGoal ? "Meta atingida" : "Abaixo da meta"}: ${number.format(result.yesterday)} para meta ${number.format(result.yesterdayGoal)}`
          }
        />
      ),
    },
    "appointments.today": {
      kpi: (
        <Kpi
          label="Agendamentos hoje"
          value={number.format(result.today)}
          detail="Pela data de criação"
          goalStatus={atLeastStatus(result.today, result.todayGoal)}
          statusLabel={
            result.todayGoal === null
              ? "Comparação com a meta indisponível"
              : `${result.today >= result.todayGoal ? "Meta atingida" : "Abaixo da meta"}: ${number.format(result.today)} para meta ${number.format(result.todayGoal)}`
          }
        />
      ),
    },
    "appointments.funnel-comparison": {
      funnel: (
        <FunnelComparison
          expected={expectedFunnel}
          realized={result.funnel}
          realizedStatuses={realizedStatuses}
        />
      ),
    },
    "appointments.daily": {
      bars: (
        <Chart title="Evolução de agendamentos por dia">
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
      ),
    },
    "appointments.today-comparison": {
      bars: (
        <Chart title="Previstos e realizados hoje">
          {result.performedToday === null ? (
            <Empty>Dados operacionais indisponíveis nesta atualização.</Empty>
          ) : (
            <Columns
              buckets={paired}
              label="Agendamentos previstos e realizados hoje"
              isSelected={() => selectedDates.includes(analysis.referenceDate)}
              onSelect={() => {
                selectMonth(referenceMonth);
                setFilters((current) => ({
                  ...current,
                  createdDates: [analysis.referenceDate],
                }));
              }}
            />
          )}
        </Chart>
      ),
    },
    "appointments.weekly": {
      bars: (
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
      ),
    },
    "ranking.score": {
      bars: (
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
              verticalLabels
            />
          )}
        </Chart>
      ),
    },
    "ranking.owner": {
      "horizontal-bars": (
        <Chart title="Ranking por responsável">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking
              buckets={result.owners}
              total={result.total}
              selected={filters.owner}
              onSelect={(bucket) => toggleFilter("owner", bucket.key)}
            />
          )}
        </Chart>
      ),
    },
    "ranking.manager": {
      "horizontal-bars": (
        <Chart title="Ranking por gerente">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking
              buckets={result.managers}
              total={result.total}
              selected={filters.manager}
              onSelect={(bucket) => toggleFilter("manager", bucket.key)}
            />
          )}
        </Chart>
      ),
    },
    "ranking.regional-manager": {
      "horizontal-bars": (
        <Chart title="Ranking por gerente regional">
          {monthUnavailable ? (
            <Empty>Período sem cobertura disponível.</Empty>
          ) : (
            <Ranking
              buckets={result.regionalManagers}
              total={result.total}
              selected={filters.regionalManager}
              onSelect={(bucket) => toggleFilter("regionalManager", bucket.key)}
            />
          )}
        </Chart>
      ),
    },
    "conversion-ranking.owner": {
      "horizontal-bars": (
        <Chart title="Melhor responsável: Agendamento x Visita">
          <ConversionRanking
            buckets={result.conversionRankings.owners}
            total={result.total}
            available={result.conversionAvailable}
          />
        </Chart>
      ),
    },
    "conversion-ranking.manager": {
      "horizontal-bars": (
        <Chart title="Melhor gerente: Agendamento x Visita">
          <ConversionRanking
            buckets={result.conversionRankings.managers}
            total={result.total}
            available={result.conversionAvailable}
          />
        </Chart>
      ),
    },
    "conversion-ranking.regional-manager": {
      "horizontal-bars": (
        <Chart title="Melhor gerente regional: Agendamento x Visita">
          <ConversionRanking
            buckets={result.conversionRankings.regionalManagers}
            total={result.total}
            available={result.conversionAvailable && result.regionalFactsAvailable}
          />
        </Chart>
      ),
    },
    "recency.up-to-7-days": {
      table: (
        <RecencyPanel
          title="Último agendamento: até 7 dias"
          items={result.brokerRecency.upTo7Days}
        />
      ),
    },
    "recency.8-to-14-days": {
      table: (
        <RecencyPanel
          title="Último agendamento: de 8 a 14 dias"
          items={result.brokerRecency.from8To14Days}
        />
      ),
    },
    "recency.15-plus-days": {
      table: (
        <RecencyPanel
          title="Último agendamento: 15 dias ou mais"
          items={result.brokerRecency.from15Days}
        />
      ),
    },
    "appointments.monthly": {
      bars: (
        <Chart
          title="Agendamentos por mês"
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
            onSelect={(bucket) => selectMonth(`${selectedYear}-${bucket.key}`)}
          />
        </Chart>
      ),
    },
    "appointments.details": {
      table:
        result.details === null ? (
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
                setFilters(rowBaseFilters ?? { channel: 1 });
                setRowBaseFilters(null);
              } else {
                const baseFilters = rowBaseFilters ?? filters;
                setRowBaseFilters(baseFilters);
                setSelectedRow(key);
                setFilters({ ...baseFilters, ...rowFilters });
              }
            }}
          />
        ),
    },
  };
  const canvasScopeKey = selectedChannel === 0 ? "channel.partnerships" : "channel.house";
  const filterSummary = [
    `Canal: ${selectedChannel === 0 ? "Imob / Parcerias" : "House"}`,
    periodLabel || `Mês: ${selectedMonth}`,
    filters.regionalManager ? `Regional: ${shortName(filters.regionalManager)}` : "",
    filters.manager ? `Gerente: ${shortName(filters.manager)}` : "",
    filters.owner ? `Responsável: ${shortName(filters.owner)}` : "",
    filters.company ? `Empresa: ${filters.company}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Agendamentos</h1>
        <button
          type="button"
          className={styles.clearFilters}
          disabled={activeFilterCount === 0}
          onClick={clearAllFilters}
        >
          {activeFilterCount === 0
            ? "Limpar filtros"
            : `Limpar ${activeFilterCount} ${activeFilterCount === 1 ? "filtro" : "filtros"}`}
        </button>
      </div>
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
        periodLabel={periodLabel}
        onMonthChange={selectMonth}
        onToggleDate={toggleCalendarDate}
        onSelectWholeMonth={selectWholeMonth}
        onSelectRange={selectRange}
      />

      <ConfigurableDashboardCanvas
        key={canvasScopeKey}
        initialCards={APPOINTMENTS_CANVAS_DEFAULT_CARDS}
        catalog={APPOINTMENTS_CANVAS_CATALOG}
        compatibility={APPOINTMENTS_CANVAS_COMPATIBILITY}
        contentByMetricAndType={contentByMetricAndType}
        pageKey={APPOINTMENTS_CANVAS_PAGE_KEY}
        scopeKey={canvasScopeKey}
        exportContext={{
          title: "Dashboard de agendamentos",
          context: goalContext,
          filters: filterSummary,
          source: "Análise agregada do CRM",
          ...(generatedAtLabel ? { generatedAt: generatedAtLabel } : {}),
        }}
        ariaLabel={`Dashboard de agendamentos — ${goalContext}`}
        className={styles.configurableCanvas!}
        editable={canEditDashboard}
        profileControls={false}
        automaticProfileName="Layout de Agendamentos"
        hideCardActionsByDefault
        layoutPolicy={APPOINTMENTS_CARD_LAYOUT_POLICY}
        compactCardControls
        hideCardOverflow
        preserveExpandedPresentation
        addButtonLabel="Adicionar card"
      />
      <footer className={styles.pageFooter}>
        <p>Se tiver alguma dúvida, procure o seu gerente ou o Regional Leandro Lucas.</p>
        <strong>Desenvolvido e gerenciado por Leandro Lucas</strong>
      </footer>
    </div>
  );
}
