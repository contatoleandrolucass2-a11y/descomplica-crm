import type {
  DashboardCard,
  DashboardCardType,
  DashboardGroupBy,
  DashboardPeriod,
} from "@/lib/dashboard-canvas";
import type {
  ConfigurableDashboardCatalog,
  ConfigurableDashboardCompatibility,
} from "@/lib/dashboard-canvas/ui/configurable/types";

export const APPOINTMENTS_CANVAS_PAGE_KEY = "crm.stage.appointments";

type AppointmentsSeed = {
  id: string;
  metric: string;
  title: string;
  type: DashboardCardType;
  columnSpan: number;
  height: number;
  groupBy?: DashboardGroupBy;
  period?: DashboardPeriod;
  types?: readonly DashboardCardType[];
};

const seeds: readonly AppointmentsSeed[] = [
  {
    id: "appointments-goal",
    metric: "appointments.goal",
    title: "Meta do mês",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "team-productive",
    metric: "team.productive",
    title: "Equipe produtiva",
    type: "donut",
    columnSpan: 2,
    height: 288,
    types: ["donut", "kpi"],
  },
  {
    id: "brokers-total",
    metric: "brokers.total",
    title: "Corretores cadastrados",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "managers-total",
    metric: "managers.total",
    title: "Gerentes cadastrados",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "visits-total",
    metric: "visits.total",
    title: "Visitas realizadas",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "sales-total",
    metric: "sales.total",
    title: "Vendas no período",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "opportunity-appointment",
    metric: "conversion.opportunity-appointment",
    title: "Oportunidade x Agendamento",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "appointment-visit",
    metric: "conversion.appointment-visit",
    title: "Agendamento x Visita",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "appointment-sale",
    metric: "conversion.appointment-sale",
    title: "Agendamento x Venda",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "appointments-rate",
    metric: "appointments.rate",
    title: "Média de agendamentos",
    type: "kpi",
    columnSpan: 2,
    height: 288,
  },
  {
    id: "appointments-yesterday",
    metric: "appointments.yesterday",
    title: "Agendamentos ontem",
    type: "kpi",
    columnSpan: 2,
    height: 288,
    period: "today",
  },
  {
    id: "appointments-today",
    metric: "appointments.today",
    title: "Agendamentos hoje",
    type: "kpi",
    columnSpan: 2,
    height: 288,
    period: "today",
  },
  {
    id: "appointments-funnel",
    metric: "appointments.funnel-comparison",
    title: "Funil esperado e realizado",
    type: "funnel",
    columnSpan: 12,
    height: 720,
  },
  {
    id: "appointments-daily",
    metric: "appointments.daily",
    title: "Evolução de agendamentos por dia",
    type: "bars",
    columnSpan: 12,
    height: 600,
    groupBy: "day",
  },
  {
    id: "appointments-today-comparison",
    metric: "appointments.today-comparison",
    title: "Previstos e realizados hoje",
    type: "bars",
    columnSpan: 4,
    height: 528,
    period: "today",
  },
  {
    id: "appointments-weekly",
    metric: "appointments.weekly",
    title: "Agendamentos por semana",
    type: "bars",
    columnSpan: 4,
    height: 528,
    groupBy: "day",
  },
  {
    id: "ranking-score",
    metric: "ranking.score",
    title: "Ranking Score",
    type: "bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "ranking-owner",
    metric: "ranking.owner",
    title: "Ranking por responsável",
    type: "horizontal-bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "ranking-manager",
    metric: "ranking.manager",
    title: "Ranking por gerente",
    type: "horizontal-bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "ranking-regional",
    metric: "ranking.regional-manager",
    title: "Ranking por gerente regional",
    type: "horizontal-bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "conversion-ranking-owner",
    metric: "conversion-ranking.owner",
    title: "Melhor responsável: Agendamento x Visita",
    type: "horizontal-bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "conversion-ranking-manager",
    metric: "conversion-ranking.manager",
    title: "Melhor gerente: Agendamento x Visita",
    type: "horizontal-bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "conversion-ranking-regional",
    metric: "conversion-ranking.regional-manager",
    title: "Melhor gerente regional: Agendamento x Visita",
    type: "horizontal-bars",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "recency-up-to-7",
    metric: "recency.up-to-7-days",
    title: "Último agendamento: até 7 dias",
    type: "table",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "recency-8-to-14",
    metric: "recency.8-to-14-days",
    title: "Último agendamento: de 8 a 14 dias",
    type: "table",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "recency-15-plus",
    metric: "recency.15-plus-days",
    title: "Último agendamento: 15 dias ou mais",
    type: "table",
    columnSpan: 4,
    height: 528,
  },
  {
    id: "appointments-monthly",
    metric: "appointments.monthly",
    title: "Agendamentos por mês",
    type: "bars",
    columnSpan: 12,
    height: 600,
    groupBy: "day",
  },
  {
    id: "appointments-details",
    metric: "appointments.details",
    title: "Detalhamento dos agendamentos",
    type: "table",
    columnSpan: 12,
    height: 720,
  },
];

export const APPOINTMENTS_CANVAS_DEFAULT_CARDS: DashboardCard[] = seeds.map((seed, order) => ({
  id: seed.id,
  type: seed.type,
  metric: seed.metric,
  title: seed.title,
  period: seed.period ?? "month",
  groupBy: seed.groupBy ?? "entity",
  entityIds: null,
  layout: { order, columnSpan: seed.columnSpan, height: seed.height },
}));

export const APPOINTMENTS_CANVAS_CATALOG: ConfigurableDashboardCatalog = {
  metrics: seeds.map((seed) => ({
    key: seed.metric,
    label: seed.title,
    defaultType: seed.type,
  })),
  types: [
    { value: "kpi", label: "Indicador" },
    { value: "donut", label: "Rosca" },
    { value: "bars", label: "Barras" },
    { value: "horizontal-bars", label: "Barras horizontais" },
    { value: "funnel", label: "Funil" },
    { value: "table", label: "Tabela" },
  ],
  periods: [
    { value: "today", label: "Hoje" },
    { value: "month", label: "Mês" },
  ],
  groups: [
    { value: "entity", label: "Entidade" },
    { value: "day", label: "Dia" },
  ],
  options: [],
};

export const APPOINTMENTS_CANVAS_COMPATIBILITY: ConfigurableDashboardCompatibility = {
  typesByMetric: Object.fromEntries(seeds.map((seed) => [seed.metric, seed.types ?? [seed.type]])),
  groupsByMetric: Object.fromEntries(
    seeds.map((seed) => [seed.metric, [seed.groupBy ?? "entity"]]),
  ),
  periodsByMetric: Object.fromEntries(seeds.map((seed) => [seed.metric, [seed.period ?? "month"]])),
};
