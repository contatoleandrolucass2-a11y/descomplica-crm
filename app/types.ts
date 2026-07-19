export type PeriodKey = "month" | "week" | "today";

export type MetricSnapshot = {
  current: Record<PeriodKey, number>;
  goal: Record<PeriodKey, number>;
  previousMonth?: number;
  last7Days?: number;
  last14Days?: number;
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
  ultimos14Dias: number;
  ultimos7Dias: number;
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
  timezone: string;
  source: string;
  realizedFunnel?: RealizedFunnel;
  views: Record<DashboardViewKey, DashboardView>;
};
