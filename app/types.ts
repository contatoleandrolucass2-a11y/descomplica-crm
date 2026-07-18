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
  views: Record<DashboardViewKey, DashboardView>;
};
