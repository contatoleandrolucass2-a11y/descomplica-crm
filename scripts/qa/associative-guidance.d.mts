import type { Page } from "@playwright/test";

export const associativeGuidanceWidths: number[];
export function hasGuidanceGoldBorder(paint: {
  borders: number[][];
  attentionBorder: { color: number[] }[];
}): boolean;
export function hasGuidanceThemeSurface(paint: {
  background: number[];
  gradient: number[][];
  themeSurface: number[];
}): boolean;
export function assertAssociativeTransparentFields(
  fields: {
    label: string;
    background: number[];
    gradient: unknown[];
    ledger: boolean;
    borderWidths: number[];
    outlineWidth: number;
    outlineStyle: string;
    boxShadow: string;
    compositionShadow: string;
  }[],
): void;
export function assertAssociativeLedgerRow(paint: {
  background: number[];
  gradient: number[][];
  themeSurface: number[];
  contained: boolean;
  boxShadow: string;
  fixedBorders: { width: number; style: string; color: number[] }[];
  attentionBorder: { width: number }[];
}): void;
export function assertAssociativeKeyboardFocus(focus: {
  focusVisible: boolean;
  decoration: string;
  weight: number;
  alpha: number;
}): void;
export function isGuidanceGold(color: number[]): boolean;
export function isGuidanceGoldText(paint: {
  textFill: number[];
  backgroundClip: string;
  background: number[];
  gradient: number[][];
  foreground?: number[];
}): boolean;
export function assertAssociativeShimmer(measurement: {
  active: boolean;
  reducedMotion: boolean;
  ledger?: boolean;
  animations: {
    name: string;
    duration: number;
    iterations: string;
    playState: string;
    visibleDuringCycle: boolean;
    fullArea: boolean;
    translucent: boolean;
    behindText: boolean;
    pointerSafe: boolean;
    goldLine: boolean;
    moving: boolean;
    pseudo?: string;
    fullRowExtent?: boolean;
    backgroundCount?: number;
    noRepeat?: boolean;
  }[];
}): void;
export function assertAssociativeRejectionPaint(paint: {
  gradient: number[][];
  foreground: number[];
  textFill: number[];
}): void;
export function assertAssociativeRejectionShimmer(measurement: {
  rejected: boolean;
  reducedMotion: boolean;
  animations: {
    name: string;
    pseudo: string;
    duration: number;
    iterations: string;
    playState: string;
    redLine: boolean;
    moving: boolean;
    visibleDuringCycle: boolean;
  }[];
}): void;
export function assertAssociativeMoneySpacing(
  measurements: { gap: number; fits: boolean; height?: number; minimumHeight?: number }[],
): void;
export function assertAssociativeQuantityGeometry(geometry: {
  quantity: { width: number; height: number; right: number };
  money: { width: number; height: number; right: number }[];
  minimumHeight?: number;
}): void;
export function assertAssociativeSummaryGaps(geometry: {
  separation: number;
  decreasingGaps: number[];
  linearBottomRule: { width: number; style: string; alpha: number };
  decreasingTopRule: { width: number; style: string; alpha: number };
}): void;
export function assertAssociativeWorkspaceGaps(geometry: {
  sideBySide: boolean;
  gap: number;
  paddingLeft: number;
  paddingRight: number;
}): void;
export function assertAssociativeCommissionGeometry(geometry: {
  width: number;
  height: number;
  minimumTarget: number;
  insideSummary: boolean;
  insideTable: boolean;
  insideCell: boolean;
  summarySibling: boolean;
  lastRowIsDecreasing10: boolean;
  layoutDisplay: string;
  columns: number[];
  layoutGap: number;
  summaryGap: number;
  summaryFitsColumn: boolean;
  insideLayout: boolean;
  insideWidth: boolean;
  rightDelta: number;
  summaryEdgesAligned: boolean;
  overlaps: boolean;
  iconOnly: boolean;
  iconSize: number;
  borderless: boolean;
  transparent: boolean;
}): void;
export function checkAssociativeMoneySpacing(page: Page): Promise<{ gap: number; fits: boolean }[]>;
export function checkAssociativeGuidance(
  page: Page,
  options?: {
    onState?: (
      state: "profile" | "modality" | "first-property" | "financing" | "complete",
    ) => Promise<void>;
  },
): Promise<{ contract: string; passed: boolean; [key: string]: unknown }>;
export function inspectAssociativeGuidanceContrast(page: Page): Promise<
  {
    index: number;
    foreground: number[];
    backgrounds: number[][];
    minimumContrast: number | null;
  }[]
>;
export function runAssociativeGuidancePreview(
  url: string,
  options?: {
    viewports?: { width: number; height: number }[];
    themes?: [string, string][];
  },
): Promise<
  {
    width: number;
    theme: string;
    passed: boolean;
    captures: string[];
    error?: string;
  }[]
>;
