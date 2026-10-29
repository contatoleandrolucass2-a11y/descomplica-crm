import type { ReactNode } from "react";

import type {
  DashboardCard,
  DashboardCardOptions,
  DashboardCardSize,
  DashboardCardType,
  DashboardGroupBy,
  DashboardPeriod,
} from "../../types";
import type { DashboardCardLayoutPolicy } from "../../layout/limits";

export type DashboardCardOptionKey = keyof DashboardCardOptions;

export interface DashboardCatalogMetric {
  key: string;
  label: string;
  description?: string | undefined;
  defaultType?: DashboardCardType | undefined;
}

export interface DashboardCatalogEntity {
  id: string;
  label: string;
}

export interface DashboardCatalogChoice<Value extends string> {
  value: Value;
  label: string;
}

export interface DashboardCatalogOption {
  key: DashboardCardOptionKey;
  label: string;
}

export interface ConfigurableDashboardCatalog {
  metrics: readonly DashboardCatalogMetric[];
  entities?: readonly DashboardCatalogEntity[] | undefined;
  types?: readonly DashboardCatalogChoice<DashboardCardType>[] | undefined;
  periods?: readonly DashboardCatalogChoice<DashboardPeriod>[] | undefined;
  groups?: readonly DashboardCatalogChoice<DashboardGroupBy>[] | undefined;
  options?: readonly DashboardCatalogOption[] | undefined;
}

export interface ConfigurableDashboardCompatibility {
  typesByMetric?: Readonly<Record<string, readonly DashboardCardType[]>> | undefined;
  groupsByMetric?: Readonly<Record<string, readonly DashboardGroupBy[]>> | undefined;
  periodsByMetric?: Readonly<Record<string, readonly DashboardPeriod[]>> | undefined;
  optionsByMetric?: Readonly<Record<string, readonly DashboardCardOptionKey[]>> | undefined;
}

export type DashboardContentByMetricAndType = Readonly<
  Record<string, Partial<Record<DashboardCardType, ReactNode>>>
>;

export interface DashboardExportContext {
  title: string;
  context?: string | undefined;
  filters?: string | undefined;
  source?: string | undefined;
  generatedAt?: string | undefined;
}

export type ConfigurableDashboardRenderer = (
  card: DashboardCard,
  size: DashboardCardSize,
) => ReactNode;

export interface ConfigurableDashboardCanvasProps {
  initialCards: readonly DashboardCard[];
  catalog: ConfigurableDashboardCatalog;
  compatibility?: ConfigurableDashboardCompatibility | undefined;
  contentByMetricAndType?: DashboardContentByMetricAndType | undefined;
  renderCard?: ConfigurableDashboardRenderer | undefined;
  pageKey: string;
  scopeKey?: string | undefined;
  exportContext: DashboardExportContext;
  onCardsChange?: ((cards: DashboardCard[]) => void) | undefined;
  ariaLabel?: string | undefined;
  className?: string | undefined;
  editable?: boolean | undefined;
  profileControls?: boolean | undefined;
  automaticProfileName?: string | undefined;
  hideCardActionsByDefault?: boolean | undefined;
  layoutPolicy?: DashboardCardLayoutPolicy | undefined;
  hideCardOverflow?: boolean | undefined;
  addButtonLabel?: string | undefined;
  preserveExpandedPresentation?: boolean | undefined;
}
