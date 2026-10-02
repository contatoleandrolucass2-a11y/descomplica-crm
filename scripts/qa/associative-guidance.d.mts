import type { Page } from "@playwright/test";

export const associativeGuidanceWidths: number[];
export function isGuidanceGold(color: number[]): boolean;
export function isGuidanceGoldText(paint: {
  textFill: number[];
  backgroundClip: string;
  background: number[];
  gradient: number[][];
  foreground?: number[];
}): boolean;
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
}): void;
export function checkAssociativeMoneySpacing(page: Page): Promise<{ gap: number; fits: boolean }[]>;
export function checkAssociativeGuidance(
  page: Page,
  options?: {
    onState?: (state: "profile" | "financing" | "complete") => Promise<void>;
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
