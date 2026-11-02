import { describe, expect, it, vi } from "vitest";
import { createAppointmentDetailController } from "@/lib/crm/stages/appointments-detail-client";
import {
  appointmentDetailQueryKey,
  isCompleteAppointmentDetailPage,
  type AppointmentDetailPage,
  type AppointmentDetailResult,
  type AppointmentDetailQuery,
  type AppointmentDetailRequest,
} from "@/lib/crm/stages/appointments-detail-contract";
import { appointmentModel } from "./fixtures/appointments-summary";

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
const complete = (count = 150): AppointmentDetailPage => ({
  ...page(),
  total: count,
  rows: appointmentModel(count).analysis.appointments.map((row) => ({
    ...row,
    daysSinceAppointment: 12,
  })),
  nextCursor: null,
  previousCursor: null,
});

describe("per-dashboard operational page controller", () => {
  it("distinguishes complete reads from partial bootstrap pages and shares all rows across copies", async () => {
    let resolve!: (result: AppointmentDetailResult) => void;
    const loadDetails = vi.fn(
      () =>
        new Promise<AppointmentDetailResult>((done) => {
          resolve = done;
        }),
    );
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    const input = { query, snapshot };
    const first = controller.loadAllDetails(input);
    const copy = controller.loadAllDetails(input);
    await Promise.resolve();
    expect(loadDetails).toHaveBeenCalledExactlyOnceWith({ ...input, cursor: null, all: true });
    const all = complete();
    resolve(all);
    expect(await first).toEqual(all);
    expect(await copy).toEqual(all);
    expect(controller.peek(source.initialQueryKey)).toEqual(all);
    expect(isCompleteAppointmentDetailPage(controller.peek(source.initialQueryKey))).toBe(true);
    expect(await controller.loadDetails(input)).toEqual(source.initialPage);
    expect(isCompleteAppointmentDetailPage(controller.peek(source.initialQueryKey))).toBe(false);
    expect(await controller.loadAllDetails(input)).toEqual(all);
    expect(loadDetails).toHaveBeenCalledTimes(1);
  });
  it("reuses only a complete bootstrap for a full read", async () => {
    const all = complete(17);
    const loadDetails = vi.fn();
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      { ...source, initialPage: all },
    );
    expect(await controller.loadAllDetails({ query, snapshot })).toEqual(all);
    expect(loadDetails).not.toHaveBeenCalled();
    expect(isCompleteAppointmentDetailPage({ ...all, rows: null })).toBe(false);
    expect(isCompleteAppointmentDetailPage({ ...all, offset: 1 })).toBe(false);
    expect(isCompleteAppointmentDetailPage({ ...all, total: 18 })).toBe(false);
  });
  it("keeps the full-read intent when an earlier paginated request resolves later", async () => {
    const done = new Map<string, (result: AppointmentDetailResult) => void>();
    const loadDetails = vi.fn(
      (input: AppointmentDetailRequest) =>
        new Promise<AppointmentDetailResult>((resolve) => {
          done.set(input.all ? "all" : "page", resolve);
        }),
    );
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    const old = controller.loadDetails({ query, snapshot, cursor: "older-page" });
    const latest = controller.loadAllDetails({ query, snapshot });
    await Promise.resolve();
    done.get("all")!(complete());
    await latest;
    done.get("page")!(page(50));
    await old;
    expect(controller.peek(source.initialQueryKey)).toEqual(complete());
  });
  it("discards an in-flight complete result after another read invalidates the snapshot", async () => {
    let resolve!: (result: AppointmentDetailResult) => void;
    const loadDetails = vi.fn((input: AppointmentDetailRequest) =>
      input.query.filters.owner
        ? Promise.resolve({ status: "snapshot_changed" } as const)
        : new Promise<AppointmentDetailResult>((done) => {
            resolve = done;
          }),
    );
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    const old = controller.loadAllDetails({ query, snapshot });
    await Promise.resolve();
    await controller.loadAllDetails({ query: { ...query, filters: { owner: "Other" } }, snapshot });
    resolve(complete());
    expect(await old).toEqual({ status: "snapshot_changed" });
    expect(controller.peek(source.initialQueryKey)).toEqual({ status: "snapshot_changed" });
    expect(await controller.loadAllDetails({ query, snapshot })).toEqual({
      status: "snapshot_changed",
    });
    expect(loadDetails).toHaveBeenCalledTimes(2);
  });
  it("does not cache a partial response as complete, and retries transient failures", async () => {
    const loadDetails = vi
      .fn()
      .mockResolvedValueOnce(page())
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(complete());
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    expect(await controller.loadAllDetails({ query, snapshot })).toEqual({ status: "unavailable" });
    expect(await controller.loadAllDetails({ query, snapshot })).toEqual({ status: "unavailable" });
    expect(await controller.loadAllDetails({ query, snapshot })).toEqual(complete());
    expect(loadDetails).toHaveBeenCalledTimes(3);
  });
  it("bounds complete-query caches independently of bootstrap mode", async () => {
    const loadDetails = vi.fn(async () => complete());
    const controller = createAppointmentDetailController(
      { loadDetails, exportDetails: vi.fn() },
      source,
    );
    for (let index = 0; index < 10; index++)
      await controller.loadAllDetails({
        query: { ...query, filters: { owner: `Owner ${index}` } },
        snapshot,
      });
    await controller.loadAllDetails({
      query: { ...query, filters: { owner: "Owner 0" } },
      snapshot,
    });
    expect(loadDetails).toHaveBeenCalledTimes(11);
  });
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
