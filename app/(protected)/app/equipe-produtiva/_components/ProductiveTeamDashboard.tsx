"use client";

import { useMemo, useState } from "react";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import {
  appointmentYears,
  type AppointmentBrokerRosterEntry,
  type AppointmentFilters,
} from "@/lib/crm/stages/appointments";
import {
  analyzeProductiveTeam,
  PRODUCTIVE_TEAM_STAGES,
  type ProductiveTeamStage,
  type ProductiveTeamUnavailableReason,
} from "@/lib/crm/stages/productive-team";
import {
  DashboardFilters,
  ProductiveTeamCard,
} from "../../etapas/_components/AppointmentsDashboard";
import shared from "../../etapas/_components/AppointmentsDashboard.module.css";
import styles from "./ProductiveTeamDashboard.module.css";
import { ProductiveTeamDetails } from "./ProductiveTeamDetails";

const labels = {
  appointments: ["Agendamentos", "agendamentos"],
  visits: ["Visitas", "visitas"],
  folders: ["Pastas", "pastas"],
  sales: ["Vendas", "vendas"],
} as const;
const unavailable: Record<ProductiveTeamUnavailableReason, string> = {
  "stage-unavailable": "Relatório indisponível para esta etapa.",
  "unsupported-version": "Aguardando relatório compatível com a equipe produtiva.",
  "unsupported-dimensions": "Cadastro de corretores indisponível para este canal ou empresa.",
  "unknown-regional-link": "Vínculo regional indisponível para o período selecionado.",
  "missing-roster": "Cadastro de corretores indisponível.",
  "unavailable-period": "Período fora da cobertura dos relatórios.",
  "ambiguous-broker": "Identificação de corretores ambígua no relatório.",
  "inconsistent-roster": "Cadastro de corretores não conciliado com o relatório.",
};

export function ProductiveTeamDashboard({
  analysis,
  brokerRoster,
  generatedAt,
  availableStages,
  calendarDate,
  initialChannel,
}: {
  analysis: DashboardAnalysisSlice | null;
  brokerRoster: AppointmentBrokerRosterEntry[] | null;
  generatedAt?: string | undefined;
  availableStages: readonly ProductiveTeamStage[];
  calendarDate: string;
  initialChannel?: 0 | 1;
}) {
  const defaultChannel = initialChannel ?? (analysis?.viewKey === "with_canal_imob" ? 0 : 1);
  const [filters, setFilters] = useState<AppointmentFilters>({ channel: defaultChannel });
  const initialMonth = (analysis?.referenceDate ?? calendarDate).slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [periodLabel, setPeriodLabel] = useState<string>();
  const result = useMemo(
    () =>
      analysis
        ? analyzeProductiveTeam(analysis, {
            month,
            filters,
            brokerRoster,
            availableStages,
          })
        : null,
    [analysis, month, filters, brokerRoster, availableStages],
  );
  const updatedAt = generatedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(generatedAt))
    : "Coleta não confirmada";
  const emptyOptions = {
    channels: [],
    regionalManagers: [],
    managers: [],
    owners: [],
    companies: [],
  };
  const options = result?.filterOptions ?? emptyOptions;
  const activeFilters = Object.values(filters).filter(
    (value) => value !== undefined && (!Array.isArray(value) || value.length),
  ).length;

  function change<K extends keyof AppointmentFilters>(
    key: K,
    value: AppointmentFilters[K] | undefined,
  ) {
    setFilters((current) => {
      const next = { ...current };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }
  function selectMonth(value: string) {
    setMonth(value);
    setPeriodLabel(undefined);
    setFilters((current) => {
      const next = { ...current };
      delete next.createdDates;
      delete next.createdDate;
      delete next.periodStart;
      delete next.periodEnd;
      return next;
    });
  }
  return (
    <div className={`${shared.dashboard} ${styles.compact}`}>
      <header className={shared.titleRow}>
        <div className={shared.titleGroup}>
          <h1 className={shared.title}>Equipe Produtiva</h1>
          <p className={shared.updatedAt}>Atualizado em {updatedAt}</p>
        </div>
        <button
          type="button"
          className={shared.clearFilters}
          onClick={() => {
            setFilters({ channel: defaultChannel });
            setMonth(initialMonth);
            setPeriodLabel(undefined);
          }}
        >
          Limpar {activeFilters} {activeFilters === 1 ? "filtro" : "filtros"}
        </button>
      </header>
      <DashboardFilters
        label="Filtros de Equipe Produtiva"
        filters={filters}
        options={options}
        onChange={change}
        month={month}
        years={analysis ? appointmentYears(analysis) : [calendarDate.slice(0, 4)]}
        coverageStart={analysis?.coverageStart ?? `${calendarDate.slice(0, 7)}-01`}
        referenceDate={analysis?.referenceDate ?? calendarDate}
        calendarDate={calendarDate}
        selectedDates={filters.createdDates ?? []}
        periodLabel={periodLabel}
        onMonthChange={selectMonth}
        onToggleDate={(date) => {
          setPeriodLabel(undefined);
          setFilters((current) => {
            const selected = current.createdDates ?? [];
            const next = { ...current };
            delete next.periodStart;
            delete next.periodEnd;
            return {
              ...next,
              createdDates: selected.includes(date)
                ? selected.filter((value) => value !== date)
                : [...selected, date].sort(),
            };
          });
        }}
        onSelectWholeMonth={() => selectMonth(month)}
        onSelectRange={(start, end, label) => {
          setPeriodLabel(label);
          setFilters((current) => {
            const next = { ...current, periodStart: start, periodEnd: end };
            delete next.createdDates;
            return next;
          });
        }}
      />
      <section
        className={styles.cards}
        aria-label="Corretores produtivos por etapa"
        aria-live="polite"
        data-appointments-section
        tabIndex={-1}
      >
        {PRODUCTIVE_TEAM_STAGES.map((stage) => {
          const card = result?.cards.find((item) => item.stage === stage);
          return (
            <ProductiveTeamCard
              key={stage}
              title={`Equipe produtiva “${labels[stage][0]}”`}
              activity={labels[stage][1]}
              productive={card?.productiveBrokers ?? null}
              brokers={card?.brokerCount ?? null}
              percent={card?.percent ?? null}
              details={{
                title:
                  stage === "appointments"
                    ? "Equipe com agendamento — Agendamentos"
                    : `Equipe Produtiva — ${labels[stage][0]}`,
                className: styles.detailsDialog,
                content: (
                  <ProductiveTeamDetails
                    appointmentLabels={stage === "appointments"}
                    shortNames={stage === "appointments"}
                    productiveMembers={card?.productiveMembers ?? null}
                    unproductiveMembers={card?.unproductiveMembers ?? null}
                    unavailableDetail={
                      card?.unavailableReason
                        ? unavailable[card.unavailableReason]
                        : "Não foi possível carregar a lista de corretores para este indicador."
                    }
                  />
                ),
              }}
              unavailableDetail={
                card?.unavailableReason
                  ? unavailable[card.unavailableReason]
                  : "Relatórios e cadastro indisponíveis."
              }
            />
          );
        })}
      </section>
      <p className={styles.note}>
        Cada corretor é contado uma única vez por etapa no período selecionado. A base é o cadastro
        vigente de corretores.
      </p>
      {result?.coverage === "partial" && (
        <p role="status" className={styles.note}>
          Cobertura parcial: os indicadores consideram somente as datas disponíveis nos relatórios.
        </p>
      )}
      {!analysis && (
        <p role="status" className={styles.note}>
          Aguardando coleta confirmada dos relatórios comerciais. Nenhum valor demonstrativo é
          exibido.
        </p>
      )}
    </div>
  );
}
