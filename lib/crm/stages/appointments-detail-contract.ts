import type { AppointmentDetailRow, AppointmentFilters } from "./appointments";
import type { DashboardViewKey } from "@/lib/crm/dashboard/catalog";

export const APPOINTMENT_DETAIL_PAGE_SIZE = 50;
export interface AppointmentDetailQuery {
  view: DashboardViewKey;
  month: string;
  year: string;
  calendarDate: string;
  filters: AppointmentFilters;
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
}
export interface AppointmentDetailActions {
  loadDetails: (input: AppointmentDetailRequest) => Promise<AppointmentDetailResult>;
  exportDetails: (input: AppointmentDetailRequest) => Promise<AppointmentExportResult>;
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
  ]);
}
