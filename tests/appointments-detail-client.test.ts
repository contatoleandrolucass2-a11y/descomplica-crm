import { describe, expect, it, vi } from "vitest";
import { createAppointmentDetailController } from "@/lib/crm/stages/appointments-detail-client";
import {
  appointmentDetailQueryKey,
  type AppointmentDetailPage,
  type AppointmentDetailResult,
  type AppointmentDetailQuery,
  type AppointmentDetailRequest,
} from "@/lib/crm/stages/appointments-detail-contract";

const query: AppointmentDetailQuery = {
  view: "all",
  month: "2026-10",
  year: "2026",
  calendarDate: "2026-10-31",
  filters: {},
};
const snapshot = "a".repeat(64);
const page = (offset = 0): AppointmentDetailPage => ({
  status: "ready",
  snapshot,
  total: 150,
  offset,
  rows: [],
  nextCursor: offset < 100 ? `page-${offset + 50}` : null,
  previousCursor: offset > 0 ? `page-${offset - 50}` : null,
});
const source = {
  snapshot,
  view: "all" as const,
  initialQueryKey: appointmentDetailQueryKey(query),
  initialPage: page(),
};

describe("per-dashboard operational page controller", () => {
  it("shares in-flight and completed filtered pages across remounts without global data", async () => {
    let resolve!: (result: AppointmentDetailResult) => void;
    const loadDetails = vi.fn(
      () =>
        new Promise<AppointmentDetailResult>((done) => {
          resolve = done;
        }),
    );
    const exportDetails = vi.fn(async () => ({
      status: "ready" as const,
      csv: "synthetic",
      total: 150,
    }));
    const controller = createAppointmentDetailController({ loadDetails, exportDetails }, source);
    const filtered = { ...query, filters: { owner: "Corretor A" } };
    const request = { query: filtered, snapshot, cursor: null };
    const first = controller.loadDetails(request);
    const copy = controller.loadDetails(request);
    await Promise.resolve();
    expect(loadDetails).toHaveBeenCalledTimes(1);
    resolve(page(50));
    await Promise.all([first, copy]);
    expect(controller.peek(appointmentDetailQueryKey(filtered))).toEqual(page(50));
    await controller.loadDetails(request);
    expect(loadDetails).toHaveBeenCalledTimes(1);
    await controller.exportDetails(request);
    await controller.exportDetails(request);
    expect(exportDetails).toHaveBeenCalledTimes(2);
    expect(
      createAppointmentDetailController({ loadDetails, exportDetails }, source).peek(
        appointmentDetailQueryKey(filtered),
      ),
    ).toBeNull();
  });
  it("retains the latest pagination intent when older requests complete later", async () => {
    const done = new Map<string, (result: AppointmentDetailResult) => void>();
    const loadDetails = vi.fn(
      (input: AppointmentDetailRequest) =>
        new Promise<AppointmentDetailResult>((resolve) => {
          done.set(input.cursor!, resolve);
        }),
    );
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    const old = controller.loadDetails({ query, snapshot, cursor: "old" });
    const latest = controller.loadDetails({ query, snapshot, cursor: "latest" });
    await Promise.resolve();
    done.get("latest")!(page(100));
    await latest;
    done.get("old")!(page(50));
    await old;
    expect(controller.peek(source.initialQueryKey)).toEqual(page(100));
  });
  it("bounds cached pages and invalidates all copies on a changed snapshot", async () => {
    const loadDetails = vi.fn(async () => page(50) as AppointmentDetailResult);
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    for (let index = 0; index < 10; index++)
      await controller.loadDetails({
        query: { ...query, filters: { owner: `Owner ${index}` } },
        snapshot,
      });
    const calls = loadDetails.mock.calls.length;
    await controller.loadDetails({ query: { ...query, filters: { owner: "Owner 0" } }, snapshot });
    expect(loadDetails).toHaveBeenCalledTimes(calls + 1);
    loadDetails.mockResolvedValueOnce({ status: "snapshot_changed" });
    await controller.loadDetails({ query, snapshot, cursor: "fresh" });
    expect(controller.peek(source.initialQueryKey)).toEqual({ status: "snapshot_changed" });
    expect(await controller.loadDetails({ query, snapshot })).toEqual({
      status: "snapshot_changed",
    });
  });
});
