"use client";

import { createContext, useContext } from "react";

export interface DashboardBarHeightControl {
  title?: string | undefined;
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
