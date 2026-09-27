import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInvestorInventory } from "@/lib/archive-investor/load-inventory";

const snapshot = { count: 1, items: [{ id: "snapshot" }] };
const live = { count: 1, items: [{ id: "live" }] };
const snapshotUrl = "/api/inventory/snapshot";
const liveUrl = "/api/inventory";
let requests: Map<string, (response: Response) => void>;
let controller: AbortController;
const onInventory = vi.fn();

beforeEach(() => {
  onInventory.mockReset();
  requests = new Map();
  controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => new Promise<Response>((resolve) => requests.set(url, resolve))),
  );
});
afterEach(() => vi.unstubAllGlobals());

function start(snapshotOnly = false, canReplace = () => true) {
  return loadInvestorInventory({
    snapshotOnly,
    signal: controller.signal,
    canReplace,
    onInventory,
  });
}
function respond(url: string, payload: unknown, status = 200) {
  requests.get(url)!(Response.json(payload, { status }));
}

describe("parallel inventory loading", () => {
  it("starts both sources together and preserves reference enrichment when live finishes first", async () => {
    const loading = start();
    expect([...requests.keys()]).toEqual([snapshotUrl, liveUrl]);
    respond(liveUrl, live);
    await Promise.resolve();
    expect(onInventory).not.toHaveBeenCalled();
    respond(snapshotUrl, snapshot);
    await loading;
    expect(onInventory).toHaveBeenLastCalledWith(live, snapshot.items);
    expect(onInventory).toHaveBeenCalledTimes(2);
  });

  it("shows live stock when the snapshot is unavailable", async () => {
    const loading = start();
    respond(snapshotUrl, null, 503);
    respond(liveUrl, live);
    await loading;
    expect(onInventory).toHaveBeenCalledWith(live, []);
    expect(onInventory).toHaveBeenCalledTimes(1);
  });

  it("shows snapshot immediately, then enriches live stock from the reference", async () => {
    const loading = start();
    respond(snapshotUrl, snapshot);
    await vi.waitFor(() => expect(onInventory).toHaveBeenCalledWith(snapshot, snapshot.items));
    respond(liveUrl, live);
    await loading;
    expect(onInventory).toHaveBeenLastCalledWith(live, snapshot.items);
  });

  it("keeps the stock used by an in-progress proposal", async () => {
    let interacted = false;
    const loading = start(false, () => !interacted);
    respond(snapshotUrl, snapshot);
    await vi.waitFor(() => expect(onInventory).toHaveBeenCalledTimes(1));
    interacted = true;
    respond(liveUrl, live);
    await loading;
    expect(onInventory).toHaveBeenCalledTimes(1);
    expect(onInventory).toHaveBeenLastCalledWith(snapshot, snapshot.items);
  });

  it("uses only the official snapshot for the direct table and fails closed", async () => {
    const loading = start(true);
    expect([...requests.keys()]).toEqual([snapshotUrl]);
    respond(snapshotUrl, { error: "unavailable" }, 503);
    await expect(loading).rejects.toThrow("inventory_unavailable");
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("retains the available source when the other fails", async () => {
    const loading = start();
    respond(snapshotUrl, snapshot);
    respond(liveUrl, null, 502);
    await loading;
    expect(onInventory).toHaveBeenCalledOnce();
    expect(onInventory).toHaveBeenCalledWith(snapshot, snapshot.items);
  });

  it("rejects malformed payloads from both sources", async () => {
    const loading = start();
    respond(snapshotUrl, null);
    respond(liveUrl, { count: 2, items: [] });
    await expect(loading).rejects.toThrow("inventory_unavailable");
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("ignores late results after navigation and passes cancellation to fetch", async () => {
    const loading = start();
    const requestSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
    controller.abort();
    expect(requestSignal?.aborted).toBe(true);
    respond(snapshotUrl, snapshot);
    respond(liveUrl, live);
    await loading;
    expect(onInventory).not.toHaveBeenCalled();
  });
});
