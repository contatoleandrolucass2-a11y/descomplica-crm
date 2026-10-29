import type { DashboardCardLayout, DashboardCardType } from "../types";

export const CANVAS_COLUMN_COUNT = 12;
export const CANVAS_HEIGHT_STEP = 24;
export const CANVAS_MIN_CARD_HEIGHT = 168;
export const MAX_CARDS_PER_CANVAS = 50;

export interface DashboardCardLayoutLimits {
  minColumnSpan: number;
  defaultColumnSpan: number;
  minHeight: number;
  defaultHeight: number;
  maxHeight: number;
}

export interface DashboardCardLayoutPolicy {
  maxHeight?: number | null;
  heightStep?: number;
}

export const FREE_HEIGHT_CARD_LAYOUT_POLICY: DashboardCardLayoutPolicy = {
  maxHeight: null,
};

export const APPOINTMENTS_CARD_LAYOUT_POLICY: DashboardCardLayoutPolicy = {
  maxHeight: 16_384,
  heightStep: 1,
};

export const DASHBOARD_CARD_LAYOUT_LIMITS: Record<DashboardCardType, DashboardCardLayoutLimits> = {
  kpi: {
    minColumnSpan: 2,
    defaultColumnSpan: 2,
    minHeight: CANVAS_MIN_CARD_HEIGHT,
    defaultHeight: 192,
    maxHeight: 480,
  },
  bars: chartLimits(),
  "horizontal-bars": chartLimits(264),
  line: chartLimits(),
  area: chartLimits(),
  donut: chartLimits(),
  radar: chartLimits(),
  scatter: chartLimits(),
  funnel: {
    minColumnSpan: 2,
    defaultColumnSpan: 4,
    minHeight: 312,
    defaultHeight: 384,
    maxHeight: 888,
  },
  table: {
    minColumnSpan: 6,
    defaultColumnSpan: 12,
    minHeight: 360,
    defaultHeight: 456,
    maxHeight: 1_080,
  },
};

function chartLimits(minHeight = 240): DashboardCardLayoutLimits {
  return {
    minColumnSpan: 3,
    defaultColumnSpan: 6,
    minHeight,
    defaultHeight: 336,
    maxHeight: 816,
  };
}

function finiteInteger(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function constrainCardLayout(
  type: DashboardCardType,
  layout: Partial<DashboardCardLayout>,
  policy?: DashboardCardLayoutPolicy,
): DashboardCardLayout {
  const limits = DASHBOARD_CARD_LAYOUT_LIMITS[type];
  const columnSpan = clamp(
    finiteInteger(layout.columnSpan ?? limits.defaultColumnSpan, limits.defaultColumnSpan),
    limits.minColumnSpan,
    CANVAS_COLUMN_COUNT,
  );
  const maximumHeight =
    policy?.maxHeight === null ? Number.MAX_SAFE_INTEGER : (policy?.maxHeight ?? limits.maxHeight);
  const unsnappedHeight = clamp(
    finiteInteger(layout.height ?? limits.defaultHeight, limits.defaultHeight),
    limits.minHeight,
    maximumHeight,
  );
  const heightStep = Math.max(
    1,
    finiteInteger(policy?.heightStep ?? CANVAS_HEIGHT_STEP, CANVAS_HEIGHT_STEP),
  );
  const height = clamp(
    Math.round(unsnappedHeight / heightStep) * heightStep,
    limits.minHeight,
    maximumHeight,
  );

  return {
    order: Math.max(0, finiteInteger(layout.order ?? 0, 0)),
    columnSpan,
    height,
  };
}

export function columnWidth(containerWidth: number, gap: number) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1;
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  return Math.max(1, (containerWidth - safeGap * (CANVAS_COLUMN_COUNT - 1)) / CANVAS_COLUMN_COUNT);
}

export function resizeCardLayout({
  type,
  initial,
  deltaX,
  deltaY,
  containerWidth,
  gap = 16,
  policy,
}: {
  type: DashboardCardType;
  initial: DashboardCardLayout;
  deltaX: number;
  deltaY: number;
  containerWidth: number;
  gap?: number;
  policy?: DashboardCardLayoutPolicy | undefined;
}) {
  const widthPerColumn = columnWidth(containerWidth, gap) + Math.max(0, gap);
  const heightStep = Math.max(
    1,
    finiteInteger(policy?.heightStep ?? CANVAS_HEIGHT_STEP, CANVAS_HEIGHT_STEP),
  );
  return constrainCardLayout(
    type,
    {
      ...initial,
      columnSpan: initial.columnSpan + Math.round(deltaX / widthPerColumn),
      height: initial.height + Math.round(deltaY / heightStep) * heightStep,
    },
    policy,
  );
}
