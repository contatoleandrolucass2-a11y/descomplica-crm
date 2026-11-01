"use client";

import { createContext, useContext } from "react";
import type { DashboardCardType } from "../../types";

export interface DashboardBarHeightControl {
  title?: string | undefined;
  type?: DashboardCardType | undefined;
  onTypeChange?: ((type: DashboardCardType) => void) | undefined;
  value: number | undefined;
  editable: boolean;
  onCommit: (height: number | undefined) => void;
}

export const DashboardBarHeightControlContext = createContext<DashboardBarHeightControl | null>(
  null,
);

export function useDashboardBarHeightControl() {
  return useContext(DashboardBarHeightControlContext);
}
