export type PeriodKey = "month" | "week" | "today";

export type MetricSnapshot = {
  current: Record<PeriodKey, number>;
  goal: Record<PeriodKey, number>;
  previousMonth?: number;
  previous14Days?: number;
  last7Days?: number;
  last14Days?: number;
  previous7Days?: number;
  previousWeek?: number;
  currentWeek?: number;
  yesterday?: number;
};

export type DashboardViewKey =
  | "with_canal_imob"
  | "without_canal_imob"
  | "all";

export type DashboardView = {
  key: DashboardViewKey;
  label: string;
  description: string;
  metrics: {
    opportunities: MetricSnapshot;
    appointments: MetricSnapshot;
    visits: MetricSnapshot;
    folders: MetricSnapshot;
    sales: MetricSnapshot;
  };
  salesValue: Record<PeriodKey, number>;
  topDevelopments: Array<{ name: string; total: number }>;
};

export type RealizedFunnelMetric = {
  mesAnterior: number;
  mesAtual: number;
  ultimos14DiasAnteriores?: number;
  ultimos14Dias: number;
  ultimos7DiasAnteriores?: number;
  ultimos7Dias: number;
  semanaPassada?: number;
  estaSemana: number;
  ontem: number;
  hoje: number;
  metas: {
    mes: number;
    semana: number;
    dia: number;
  };
  realizado_meta_mes: number;
  realizado_meta_semana: number;
  realizado_meta_dia: number;
};

export type RealizedFunnel = {
  resumo: {
    corretores: number;
    gerentes: number;
  };
  agendamentos: RealizedFunnelMetric;
  visitas: RealizedFunnelMetric;
  pastas: RealizedFunnelMetric;
  vendas: RealizedFunnelMetric;
};

export type DashboardPayload = {
  collaborator: {
    email: string;
    name: string;
    manager: string;
    role: string;
  };
  generatedAt: string;
  referenceDate: string;
  monthComparisonMode?: "same_day_mtd";
  timezone: string;
  source: string;
  realizedFunnel?: RealizedFunnel;
  views: Record<DashboardViewKey, DashboardView>;
};
