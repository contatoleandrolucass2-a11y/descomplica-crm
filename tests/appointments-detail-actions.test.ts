import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  views: vi.fn(),
  load: vi.fn(),
  forbidden: vi.fn(() => {
    throw new Error("forbidden");
  }),
}));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePageAccess: mocks.authorize }));
vi.mock("@/lib/authorization/dashboard-views", () => ({
  getAuthorizedDashboardViews: mocks.views,
}));
vi.mock("@/lib/crm/stages/data", () => ({ loadAppointmentsReadModel: mocks.load }));
vi.mock("next/navigation", () => ({ forbidden: mocks.forbidden }));
import {
  readAppointmentDetailsAction,
  exportAppointmentDetailsAction,
} from "@/app/(protected)/app/etapas/_components/appointments-actions";
import { appointmentSnapshotIdentity } from "@/lib/crm/stages/appointments-detail-server";
import { appointmentModel } from "./fixtures/appointments-summary";
const query = {
  view: "all",
  month: "2026-10",
  year: "2026",
  calendarDate: "2026-10-31",
  filters: {},
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ permissions: ["synthetic"] });
  mocks.views.mockReturnValue(["all"]);
  mocks.load.mockResolvedValue(appointmentModel());
  mocks.forbidden.mockImplementation(() => {
    throw new Error("forbidden");
  });
});
describe("authorized appointment detail server functions", () => {
  it("returns every authorized row in one full read without changing default pagination", async () => {
    const model = appointmentModel();
    const input = { query, snapshot: appointmentSnapshotIdentity(model) };
    const partial = await readAppointmentDetailsAction(input);
    expect(partial.status === "ready" && partial.rows?.length).toBe(50);
    const all = await readAppointmentDetailsAction({ ...input, all: true, cursor: null });
    expect(all).toMatchObject({
      status: "ready",
      total: 123,
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    });
    if (all.status !== "ready") throw new Error("Expected complete read");
    expect(all.rows).toHaveLength(123);
    expect(new Set(all.rows!.map((row) => row.accountName)).size).toBe(123);
    expect(all.rows!.some((row) => row.accountName === "Conta sintética 00122")).toBe(true);
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
    expect(mocks.views).toHaveBeenCalledTimes(2);
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("applies owner filters and field masking before a complete read", async () => {
    const model = appointmentModel();
    model.analysis.appointments = model.analysis.appointments.map((row) => ({
      ...row,
      accountName: "",
      accountRanking: "",
    }));
    mocks.load.mockResolvedValue(model);
    const all = await readAppointmentDetailsAction({
      query: { ...query, filters: { owner: "Corretor A" } },
      snapshot: appointmentSnapshotIdentity(model),
      all: true,
    });
    expect(all).toMatchObject({
      status: "ready",
      total: 62,
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    });
    expect(
      all.status === "ready" &&
        all.rows!.every(
          (row) =>
            row.owner === "Corretor A" && row.accountName === "" && row.accountRanking === "",
        ),
    ).toBe(true);
  });
  it("returns all overdue rows after filtering the entire snapshot, with civil-date boundaries", async () => {
    const model: import("@/lib/crm/stages/data").AppointmentsReadModel = appointmentModel(127);
    const analysis = model.analysis!;
    analysis.appointments = analysis.appointments!.map((row, index) => ({
      ...row,
      visitPerformed: index === 123,
      attendedAt: null,
      scheduledAt:
        index === 124
          ? null
          : index === 125
            ? "2026-10-31T03:00:00Z"
            : index === 126
              ? "2026-11-01T03:00:00Z"
              : "2026-10-31T02:59:59Z",
    }));
    mocks.load.mockResolvedValue(model);
    const all = await readAppointmentDetailsAction({
      query: { ...query, subset: "overdue" },
      snapshot: appointmentSnapshotIdentity(model),
      all: true,
    });
    expect(all).toMatchObject({
      status: "ready",
      total: 123,
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    });
    if (all.status !== "ready") throw new Error("Expected complete overdue read");
    expect(all.rows).toHaveLength(123);
    expect(
      all.rows!.every(
        (row) =>
          !row.visitPerformed &&
          row.attendedAt === null &&
          row.scheduledAt === "2026-10-31T02:59:59Z",
      ),
    ).toBe(true);
  });
  it("returns every unconfirmed visit before pagination regardless of the planned attendance date", async () => {
    const fixture = appointmentModel(127);
    const model = {
      ...fixture,
      analysis: {
        ...fixture.analysis,
        appointments: fixture.analysis.appointments.map((row, index) => ({
          ...row,
          visitPerformed: index === 0,
          scheduledAt:
            index === 1 ? null : index === 2 ? "2026-11-15T15:00:00Z" : "2026-10-20T15:00:00Z",
          attendedAt: index === 3 ? "2026-10-20T15:10:00Z" : null,
        })),
      },
    };
    mocks.load.mockResolvedValue(model);
    const input = {
      query: { ...query, subset: "without_visit" },
      snapshot: appointmentSnapshotIdentity(model),
    };
    const first = await readAppointmentDetailsAction(input);
    expect(first).toMatchObject({ status: "ready", total: 126 });
    expect(first.status === "ready" && first.rows).toHaveLength(50);
    const all = await readAppointmentDetailsAction({ ...input, all: true });
    expect(all).toMatchObject({
      status: "ready",
      total: 126,
      offset: 0,
      nextCursor: null,
      previousCursor: null,
    });
    if (all.status !== "ready") throw new Error("Expected every unconfirmed visit");
    expect(all.rows).toHaveLength(126);
    expect(all.rows!.every((row) => row.visitPerformed !== true)).toBe(true);
    expect(all.rows!.some((row) => row.scheduledAt === null)).toBe(true);
    expect(all.rows!.some((row) => row.scheduledAt === "2026-11-15T15:00:00Z")).toBe(true);
    expect(all.rows!.some((row) => row.attendedAt !== null)).toBe(true);
    expect(all.rows!.some((row) => row.accountName === "Conta sintética 00126")).toBe(true);
    const exported = await exportAppointmentDetailsAction(input);
    expect(exported).toMatchObject({ status: "ready", total: 126 });
    expect(exported.status === "ready" && exported.csv.split("\r\n")).toHaveLength(127);
  });
  it("keeps the unconfirmed subset within the authorized period and team filters", async () => {
    const fixture = appointmentModel(127);
    const model = {
      ...fixture,
      analysis: {
        ...fixture.analysis,
        appointments: fixture.analysis.appointments.map((row, index) => ({
          ...row,
          visitPerformed: index === 0,
          scheduledAt: null,
          createdAt: index === 126 ? "2026-09-30T15:00:00Z" : row.createdAt,
        })),
      },
    };
    mocks.load.mockResolvedValue(model);
    const all = await readAppointmentDetailsAction({
      query: {
        ...query,
        subset: "without_visit",
        filters: { owner: "Corretor A", manager: "Gerente A", channel: 0 },
      },
      snapshot: appointmentSnapshotIdentity(model),
      all: true,
    });
    expect(all).toMatchObject({ status: "ready", total: 62 });
    expect(
      all.status === "ready" &&
        all.rows!.every(
          (row) =>
            row.owner === "Corretor A" &&
            row.salesManager === "Gerente A" &&
            row.visitPerformed === false &&
            row.createdAt === "2026-10-19T15:00:00Z",
        ),
    ).toBe(true);
    const otherSubsetCursor = await readAppointmentDetailsAction({
      query,
      snapshot: appointmentSnapshotIdentity(model),
    });
    if (otherSubsetCursor.status !== "ready") throw new Error("Expected initial authorized page");
    expect(
      await readAppointmentDetailsAction({
        query: { ...query, subset: "without_visit" },
        snapshot: appointmentSnapshotIdentity(model),
        cursor: otherSubsetCursor.nextCursor,
      }),
    ).toEqual({ status: "invalid_request" });
  });
  it("rejects malformed complete modes and any combined cursor before reading a model", async () => {
    const input = { query, snapshot: appointmentSnapshotIdentity(appointmentModel()) };
    for (const malformed of [
      { ...input, all: false },
      { ...input, all: "true" },
      { ...input, all: true, cursor: "foreign" },
      { ...input, all: true, cursor: "" },
      { ...input, query: { ...query, all: true } },
    ])
      expect(await readAppointmentDetailsAction(malformed)).toEqual({ status: "invalid_request" });
    expect(mocks.load).not.toHaveBeenCalled();
    await expect(
      readAppointmentDetailsAction({
        ...input,
        all: true,
        query: { ...query, view: "with_canal_imob" },
      }),
    ).rejects.toThrow("forbidden");
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("keeps full reads bound to the authorized snapshot and source availability", async () => {
    const input = { query, snapshot: appointmentSnapshotIdentity(appointmentModel()), all: true };
    mocks.load.mockResolvedValueOnce({
      ...appointmentModel(),
      generatedAt: "2026-11-01T12:00:00Z",
    });
    expect(await readAppointmentDetailsAction(input)).toEqual({ status: "snapshot_changed" });
    expect(
      await readAppointmentDetailsAction({ ...input, query: { ...query, month: "2026-11" } }),
    ).toEqual({ status: "unavailable" });
    mocks.authorize.mockRejectedValueOnce(new Error("revoked"));
    await expect(readAppointmentDetailsAction(input)).rejects.toThrow("revoked");
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("returns unavailable instead of an empty CSV for a month outside snapshot coverage", async () => {
    const input = {
      query: { ...query, month: "2026-11", calendarDate: "2026-11-02" },
      snapshot: appointmentSnapshotIdentity(appointmentModel()),
    };
    expect(await exportAppointmentDetailsAction(input)).toEqual({ status: "unavailable" });
    expect(await readAppointmentDetailsAction(input)).toEqual({ status: "unavailable" });
  });
  it("revalidates page and view before every operational read and full export", async () => {
    const model = appointmentModel();
    const input = { query, snapshot: appointmentSnapshotIdentity(model) };
    const page = await readAppointmentDetailsAction(input);
    expect(page).toMatchObject({ status: "ready", total: 123, offset: 0 });
    expect(mocks.authorize).toHaveBeenCalledWith("/app/etapas/agendamentos");
    expect(mocks.load).toHaveBeenCalledWith("all");
    expect(await exportAppointmentDetailsAction(input)).toMatchObject({
      status: "ready",
      total: 123,
    });
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
    mocks.authorize.mockRejectedValueOnce(new Error("revoked"));
    await expect(readAppointmentDetailsAction(input)).rejects.toThrow("revoked");
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("rejects unauthorized views and bounded malformed filters without reading the model", async () => {
    await expect(
      readAppointmentDetailsAction({
        query: { ...query, view: "with_canal_imob" },
        snapshot: "a".repeat(64),
      }),
    ).rejects.toThrow("forbidden");
    expect(
      await readAppointmentDetailsAction({
        query: { ...query, filters: { owner: "x".repeat(201) } },
        snapshot: "a".repeat(64),
      }),
    ).toEqual({ status: "invalid_request" });
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("does not mix snapshot generations or export a visible-page cursor", async () => {
    const model = appointmentModel();
    const input = { query, snapshot: appointmentSnapshotIdentity(model) };
    mocks.load.mockResolvedValue({ ...model, generatedAt: "2026-11-01T12:00:00Z" });
    expect(await readAppointmentDetailsAction(input)).toEqual({ status: "snapshot_changed" });
    expect(await exportAppointmentDetailsAction(input)).toEqual({ status: "snapshot_changed" });
    expect(await exportAppointmentDetailsAction({ ...input, cursor: "foreign-page" })).toEqual({
      status: "invalid_request",
    });
  });
  it("rejects a cursor bound to another filter without returning operational rows", async () => {
    const input = { query, snapshot: appointmentSnapshotIdentity(appointmentModel()) };
    const page = await readAppointmentDetailsAction(input);
    expect(page.status).toBe("ready");
    if (page.status !== "ready") throw new Error("Expected authorized page");
    expect(
      await readAppointmentDetailsAction({
        ...input,
        query: { ...query, filters: { owner: "Corretor B" } },
        cursor: page.nextCursor,
      }),
    ).toEqual({ status: "invalid_request" });
  });
  it("returns only the canonical masked detail fields for a caller without ranking", async () => {
    const model = appointmentModel();
    model.analysis!.appointments = model.analysis!.appointments!.map((row) => ({
      ...row,
      accountName: "",
      accountRanking: "",
    }));
    mocks.load.mockResolvedValue(model);
    const input = { query, snapshot: appointmentSnapshotIdentity(model) };
    const page = await readAppointmentDetailsAction(input);
    expect(
      page.status === "ready" &&
        page.rows!.every((row) => row.accountName === "" && row.accountRanking === ""),
    ).toBe(true);
    const csv = await exportAppointmentDetailsAction(input);
    expect(csv.status === "ready" && csv.csv).not.toContain("Conta sintética");
  });
});
