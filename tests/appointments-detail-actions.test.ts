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
