import type { AppointmentDetailRow, AppointmentFilters } from "./appointments";
import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

export const APPOINTMENT_DETAIL_PAGE_SIZE = 50;
export interface AppointmentDetailQuery {
  view: DashboardViewKey;
  month: string;
  year: string;
  calendarDate: string;
  filters: AppointmentFilters;
  /** Comparecimento explicitamente informado, anterior ao dia civil, sem visita. */
  subset?: "overdue" | undefined;
}
export interface AppointmentDetailPage {
  status: "ready";
  snapshot: string;
  total: number;
  offset: number;
  rows: AppointmentDetailRow[] | null;
  nextCursor: string | null;
  previousCursor: string | null;
}
export type AppointmentDetailResult =
  | AppointmentDetailPage
  | {
      status: "snapshot_changed" | "unavailable" | "invalid_request";
    };
export interface AppointmentDetailSource {
  snapshot: string;
  view: DashboardViewKey;
  initialQueryKey: string;
  initialPage: AppointmentDetailResult;
}
export type AppointmentExportResult =
  | { status: "ready"; csv: string; total: number }
  | {
      status: "invalid_request" | "unavailable" | "snapshot_changed";
    };
export interface AppointmentDetailRequest {
  query: AppointmentDetailQuery;
  snapshot: string;
  cursor?: string | null | undefined;
  /** Read the complete authorized query; cannot be combined with a cursor. */
  all?: true | undefined;
}
export interface AppointmentDetailActions {
  loadDetails: (input: AppointmentDetailRequest) => Promise<AppointmentDetailResult>;
  exportDetails: (input: AppointmentDetailRequest) => Promise<AppointmentExportResult>;
}

/** Partial bootstrap pages must never be presented as the complete table. */
export function isCompleteAppointmentDetailPage(
  result: AppointmentDetailResult | null,
): result is AppointmentDetailPage {
  return (
    result?.status === "ready" &&
    result.rows !== null &&
    result.offset === 0 &&
    result.previousCursor === null &&
    result.nextCursor === null &&
    result.rows.length === result.total
  );
}

/** A stable query identity shared by initial render, pagination and export. */
export function appointmentDetailQueryKey(query: AppointmentDetailQuery): string {
  return JSON.stringify([
    query.view,
    query.month,
    query.year,
    query.calendarDate,
    ...Object.entries(query.filters)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ...(query.subset ? [["subset", query.subset]] : []),
  ]);
}
