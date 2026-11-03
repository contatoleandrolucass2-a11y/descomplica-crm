import { describe, expect, it } from "vitest";
import type { AppointmentsReadModel } from "@/lib/crm/stages/data";
import {
  appointmentDetailQueryKey,
  type AppointmentDetailQuery,
} from "@/lib/crm/stages/appointments-detail-contract";
import {
  appointmentDetailPage,
  appointmentDetailsCsv,
  appointmentDetailQuerySchema,
  fullAppointmentDetails,
  initialAppointmentDetailPage,
} from "@/lib/crm/stages/appointments-detail-server";
import { appointmentModel } from "./fixtures/appointments-summary";

const query: AppointmentDetailQuery = {
  view: "all",
  month: "2026-10",
  year: "2026",
  calendarDate: "2026-10-31",
  filters: {},
  subset: "overdue",
};

describe("comparecimento vencido sem visita", () => {
  it("uses the planned appointment and São Paulo civil day, excluding today, future, missing and visited", () => {
    const model: AppointmentsReadModel = appointmentModel(7);
    const scenarios = [
      { scheduledAt: "2026-10-30T15:00:00Z", attendedAt: null, visitPerformed: false },
      // UTC is already the 31st, while São Paulo is still the 30th.
      { scheduledAt: "2026-10-31T02:59:59Z", attendedAt: null, visitPerformed: false },
      { scheduledAt: "2026-10-31T03:00:00Z", attendedAt: null, visitPerformed: false },
      { scheduledAt: "2026-11-01T15:00:00Z", attendedAt: null, visitPerformed: false },
      { scheduledAt: null, attendedAt: "2026-10-30T15:00:00Z", visitPerformed: false },
      { scheduledAt: "2026-10-30T15:00:00Z", attendedAt: null, visitPerformed: true },
      { scheduledAt: null, attendedAt: null, visitPerformed: false },
    ];
    const analysis = model.analysis!;
    analysis.appointments = analysis.appointments!.map((row, index) => ({
      ...row,
      ...scenarios[index]!,
    }));
    const rows = fullAppointmentDetails(model, query)!;
    expect(rows.map((row) => row.accountName)).toEqual([
      "Conta sintética 00000",
      "Conta sintética 00001",
    ]);
    expect(fullAppointmentDetails(model, { ...query, subset: undefined })).toHaveLength(7);
  });

  it("expires planned dates against the current calendar day, even when the snapshot is older", () => {
    const model = appointmentModel(4);
    model.analysis.appointments = model.analysis.appointments.map((row, index) => ({
      ...row,
      attendedAt: null,
      visitPerformed: false,
      scheduledAt: [
        "2026-11-01T15:00:00Z",
        "2026-11-03T02:59:59Z",
        "2026-11-03T03:00:00Z",
        "2026-11-04T15:00:00Z",
      ][index]!,
    }));
    expect(fullAppointmentDetails(model, query)).toHaveLength(0);
    const today = { ...query, calendarDate: "2026-11-03" };
    expect(fullAppointmentDetails(model, today)?.map((row) => row.accountName)).toEqual([
      "Conta sintética 00000",
      "Conta sintética 00001",
    ]);
    expect(
      fullAppointmentDetails(model, { ...today, filters: { owner: "Corretor A" } }),
    ).toHaveLength(1);
    expect(appointmentDetailPage(model, today, null, true)).toMatchObject({
      total: 2,
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    });
  });

  it("filters the complete authorized selection before paging and exports every matching row", () => {
    const model = appointmentModel(123);
    const first = appointmentDetailPage(model, query);
    expect(first).toMatchObject({ total: 62, offset: 0 });
    expect(first.rows).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const last = appointmentDetailPage(model, query, first.nextCursor);
    expect(last).toMatchObject({ total: 62, offset: 50, nextCursor: null });
    expect(last.rows).toHaveLength(12);
    const csv = appointmentDetailsCsv(model, query);
    expect(csv.total).toBe(62);
    expect(csv.csv).toContain("Conta sintética 00122");
    expect(csv.csv).not.toContain("Conta sintética 00121");
    expect(() =>
      appointmentDetailPage(model, { ...query, subset: undefined }, first.nextCursor),
    ).toThrow();
    expect(appointmentDetailQueryKey(query)).not.toBe(
      appointmentDetailQueryKey({ ...query, subset: undefined }),
    );
    expect(
      appointmentDetailPage(model, { ...query, filters: { owner: "Corretor B" } }),
    ).toMatchObject({ total: 0, rows: [] });
  });

  it("preserves unavailable coverage and rejects unknown subsets", () => {
    const model = appointmentModel();
    expect(initialAppointmentDetailPage(model, { ...query, month: "2026-11" })).toEqual({
      status: "unavailable",
    });
    expect(() => appointmentDetailsCsv({ ...model, analysis: null }, query)).toThrow("unavailable");
    expect(appointmentDetailQuerySchema.safeParse(query).success).toBe(true);
    expect(
      appointmentDetailQuerySchema.safeParse({ ...query, subset: "all-private-records" }).success,
    ).toBe(false);
  });
});
