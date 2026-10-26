export const DASHBOARD_CANVAS_SCHEMA_VERSION = 2 as const;

export const DASHBOARD_CARD_TYPES = [
  "kpi",
  "bars",
  "horizontal-bars",
  "line",
  "area",
  "donut",
  "radar",
  "scatter",
  "funnel",
  "table",
] as const;

export const DASHBOARD_PERIODS = ["global", "today", "week", "month", "custom"] as const;
export const DASHBOARD_GROUPS = ["entity", "day", "hour"] as const;

export type DashboardCardType = (typeof DASHBOARD_CARD_TYPES)[number];
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export type DashboardGroupBy = (typeof DASHBOARD_GROUPS)[number];

export interface DashboardCardLayout {
  order: number;
  columnSpan: number;
  height: number;
}

export interface DashboardCardOptions {
  showLegend?: boolean;
  showGoal?: boolean;
  showCeiling?: boolean;
  sharedScale?: boolean;
}

export interface DashboardCard {
  id: string;
  type: DashboardCardType;
  metric: string;
  title?: string;
  period: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  groupBy: DashboardGroupBy;
  entityIds: string[] | null;
  layout: DashboardCardLayout;
  options?: DashboardCardOptions;
}

export interface DashboardCanvasSnapshot {
  schemaVersion: typeof DASHBOARD_CANVAS_SCHEMA_VERSION;
  cards: DashboardCard[];
}

export interface DashboardProfile {
  id: string;
  userId: string;
  pageKey: string;
  scopeKey?: string;
  name: string;
  isDefault: boolean;
  version: number;
  schemaVersion: typeof DASHBOARD_CANVAS_SCHEMA_VERSION;
  cards: DashboardCard[];
  createdAt: string;
  updatedAt: string;
}

export type DashboardCardPatch = Partial<Omit<DashboardCard, "id" | "layout" | "options">> & {
  layout?: Partial<DashboardCardLayout>;
  options?: DashboardCardOptions;
};

export type CanvasCommitReason = "drag" | "resize";

export interface DashboardCardSize {
  width: number;
  height: number;
}
