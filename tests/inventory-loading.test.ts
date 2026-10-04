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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
  it("offers only late live facts when an Associativo proposal prevents inventory replacement", async () => {
    const onReferenceFacts = vi.fn();
    let started = false;
    const loading = loadInvestorInventory({
      snapshotOnly: false,
      signal: controller.signal,
      canReplace: () => !started,
      onInventory,
      onReferenceFacts,
    });
    respond(snapshotUrl, snapshot);
    await vi.waitFor(() => expect(onInventory).toHaveBeenCalledOnce());
    started = true;
    respond(liveUrl, live);
    await loading;
    expect(onInventory).toHaveBeenCalledOnce();
    expect(onReferenceFacts).toHaveBeenCalledExactlyOnceWith(live.items);
  });

  it.each([true, false])(
    "never delivers facts after abort (snapshot only: %s)",
    async (snapshotOnly) => {
      const onReferenceFacts = vi.fn();
      const loading = loadInvestorInventory({
        snapshotOnly,
        signal: controller.signal,
        canReplace: () => false,
        onInventory,
        onReferenceFacts,
      });
      controller.abort();
      respond(snapshotUrl, snapshot);
      if (!snapshotOnly) respond(liveUrl, live);
      await loading.catch(() => undefined);
      expect(onReferenceFacts).not.toHaveBeenCalled();
    },
  );

  it("never supplements a snapshot-only Tabela Direta proposal", async () => {
    const onReferenceFacts = vi.fn();
    const loading = loadInvestorInventory({
      snapshotOnly: true,
      signal: controller.signal,
      canReplace: () => false,
      onInventory,
      onReferenceFacts,
    });
    respond(snapshotUrl, snapshot);
    await loading;
    expect(onReferenceFacts).not.toHaveBeenCalled();
    expect([...requests.keys()]).toEqual([snapshotUrl]);
  });
  it("preserves missing unit facts when live stock replaces the synthetic reference", async () => {
    const referenceItem = {
      id: "synthetic-snapshot-1",
      businessUnit: "Riva",
      project: "Estilo Lapa",
      identifier: "BL02-0715",
      product: "Apartamento BL02-0715 - Estilo Lapa",
      finalPrice: 230_000,
      appraisal: 350_000,
      progress: 0.42,
      completionDate: "2028-12-30",
    };
    const liveItem = {
      ...referenceItem,
      id: "synthetic-live-1",
      businessUnit: "RIVA",
      project: " ESTILO LAPA ",
      identifier: " bl02-0715 ",
      finalPrice: 240_000,
      appraisal: null,
      progress: null,
      completionDate: null,
    };
    const loading = start();
    respond(snapshotUrl, { sourceKind: "versioned-snapshot", count: 1, items: [referenceItem] });
    respond(liveUrl, { sourceKind: "live", count: 1, items: [liveItem] });
    await loading;
    expect(onInventory).toHaveBeenLastCalledWith(
      {
        sourceKind: "live",
        count: 1,
        items: [{ ...liveItem, appraisal: 350_000, progress: 0.42, completionDate: "2028-12-30" }],
      },
      [referenceItem],
    );
  });

  it("does not replace an existing proposal with the first result of a reload", async () => {
    const loading = start(false, () => false);
    respond(snapshotUrl, snapshot);
    respond(liveUrl, live);
    await loading;
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("rechecks proposal state after live arrives first and the reference is still pending", async () => {
    let interacted = false;
    const loading = start(false, () => !interacted);
    respond(liveUrl, live);
    await Promise.resolve();
    interacted = true;
    respond(snapshotUrl, snapshot);
    await loading;
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("keeps a proposal when the snapshot fails and live is the first available response", async () => {
    const loading = start(false, () => false);
    respond(snapshotUrl, null, 503);
    respond(liveUrl, live);
    await loading;
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("ignores a late snapshot-only response after a proposal was started", async () => {
    let interacted = false;
    const loading = start(true, () => !interacted);
    interacted = true;
    respond(snapshotUrl, snapshot);
    await loading;
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("discards a reference body that finishes after its request timeout", async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(timeout.signal);
    let finishBody!: (payload: unknown) => void;
    const body = new Promise((resolve) => {
      finishBody = resolve;
    });
    const loading = start();
    requests.get(snapshotUrl)!({ ok: true, json: () => body } as Response);
    await Promise.resolve();
    timeout.abort(new DOMException("The operation timed out", "TimeoutError"));
    finishBody(snapshot);
    respond(liveUrl, live);
    await loading;
    expect(onInventory).toHaveBeenCalledOnce();
    expect(onInventory).toHaveBeenCalledWith(live, []);
  });

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
