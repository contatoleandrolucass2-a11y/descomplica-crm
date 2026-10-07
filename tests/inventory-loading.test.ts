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

function start(snapshotOnly = false, canReplace = () => true, liveRequired = false) {
  return loadInvestorInventory({
    snapshotOnly,
    liveRequired,
    signal: controller.signal,
    canReplace,
    onInventory,
  });
}
function respond(url: string, payload: unknown, status = 200) {
  requests.get(url)!(Response.json(payload, { status }));
}

describe("live-required inventory loading", () => {
  it("keeps a completed snapshot out of inventory and late facts while live is pending", async () => {
    const onReferenceFacts = vi.fn();
    const loading = loadInvestorInventory({
      snapshotOnly: false,
      liveRequired: true,
      signal: controller.signal,
      canReplace: () => true,
      onInventory,
      onReferenceFacts,
    });
    expect([...requests.keys()]).toEqual([snapshotUrl, liveUrl]);
    const readSnapshotBody = vi.fn().mockResolvedValue(snapshot);
    requests.get(snapshotUrl)!({ ok: true, json: readSnapshotBody } as unknown as Response);
    await vi.waitFor(() => expect(readSnapshotBody).toHaveResolvedWith(snapshot));
    expect(onInventory).not.toHaveBeenCalled();
    expect(onReferenceFacts).not.toHaveBeenCalled();
    respond(liveUrl, live);
    await loading;
    expect(onInventory).toHaveBeenCalledExactlyOnceWith(live, snapshot.items);
    expect(onReferenceFacts).not.toHaveBeenCalled();
  });

  it.each([{ completionDate: null }, {}])(
    "keeps live completionDate authoritative with missing date %j and commercial fallback",
    async (dateFields) => {
      const referenceItem = {
        id: "snapshot-unit",
        businessUnit: "Riva",
        project: "Estilo Lapa",
        identifier: "BL02-0715",
        finalPrice: 230_000,
        appraisal: 350_000,
        progress: 0.42,
        completionDate: "2028-12-30",
      };
      const liveItem = {
        id: "live-unit",
        businessUnit: "RIVA",
        project: " ESTILO LAPA ",
        identifier: " bl02-0715 ",
        finalPrice: 240_000,
        appraisal: null,
        progress: null,
        ...dateFields,
      };
      const referenceItems = [referenceItem, { ...referenceItem, identifier: "SNAPSHOT-ONLY" }];
      const loading = start(false, () => true, true);
      respond(liveUrl, { sourceKind: "live", count: 1, items: [liveItem] });
      respond(snapshotUrl, { count: 2, items: referenceItems });
      await loading;
      expect(onInventory).toHaveBeenCalledExactlyOnceWith(
        {
          sourceKind: "live",
          count: 1,
          items: [{ ...liveItem, appraisal: 350_000, progress: 0.42 }],
        },
        referenceItems,
      );
      expect(onInventory.mock.calls[0]?.[0].items[0].completionDate).toBe(
        dateFields.completionDate,
      );
    },
  );

  it.each([401, 403, 502, 503])("rejects live HTTP %s despite a valid snapshot", async (status) => {
    const loading = start(false, () => true, true);
    respond(snapshotUrl, snapshot);
    respond(liveUrl, null, status);
    await expect(loading).rejects.toThrow("inventory_unavailable");
    expect(onInventory).not.toHaveBeenCalled();
  });

  it.each([null, {}, { count: 2, items: [] }, { count: 1, items: null }])(
    "rejects invalid live payload %j despite a valid snapshot",
    async (payload) => {
      const loading = start(false, () => true, true);
      respond(snapshotUrl, snapshot);
      respond(liveUrl, payload);
      await expect(loading).rejects.toThrow("inventory_payload_invalid");
      expect(onInventory).not.toHaveBeenCalled();
    },
  );

  it("propagates a live network failure without applying the pending snapshot later", async () => {
    const failure = new TypeError("Failed to fetch");
    vi.mocked(fetch)
      .mockImplementationOnce(
        (url) => new Promise<Response>((resolve) => requests.set(String(url), resolve)),
      )
      .mockRejectedValueOnce(failure);
    const loading = start(false, () => true, true);
    await expect(loading).rejects.toBe(failure);
    const readSnapshotBody = vi.fn().mockResolvedValue(snapshot);
    requests.get(snapshotUrl)!({ ok: true, json: readSnapshotBody } as unknown as Response);
    await vi.waitFor(() => expect(readSnapshotBody).toHaveResolvedWith(snapshot));
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("propagates a live JSON parsing failure", async () => {
    const failure = new SyntaxError("Invalid JSON");
    const loading = start(false, () => true, true);
    respond(snapshotUrl, snapshot);
    requests.get(liveUrl)!({ ok: true, json: () => Promise.reject(failure) } as Response);
    await expect(loading).rejects.toBe(failure);
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("propagates a live timeout even when its response body eventually completes", async () => {
    const timeout = new AbortController();
    const failure = new DOMException("The operation timed out", "TimeoutError");
    vi.spyOn(AbortSignal, "timeout")
      .mockReturnValueOnce(new AbortController().signal)
      .mockReturnValueOnce(timeout.signal);
    let finishBody!: (payload: unknown) => void;
    const body = new Promise((resolve) => {
      finishBody = resolve;
    });
    const readLiveBody = vi.fn(() => body);
    const loading = start(false, () => true, true);
    respond(snapshotUrl, snapshot);
    requests.get(liveUrl)!({ ok: true, json: readLiveBody } as unknown as Response);
    await vi.waitFor(() => expect(readLiveBody).toHaveBeenCalledOnce());
    timeout.abort(failure);
    finishBody(live);
    await expect(loading).rejects.toBe(failure);
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("does not deliver inventory or late facts after cancellation", async () => {
    const onReferenceFacts = vi.fn();
    const loading = loadInvestorInventory({
      snapshotOnly: false,
      liveRequired: true,
      signal: controller.signal,
      canReplace: () => false,
      onInventory,
      onReferenceFacts,
    });
    controller.abort();
    respond(snapshotUrl, snapshot);
    respond(liveUrl, live);
    await expect(loading).rejects.toBe(controller.signal.reason);
    expect(onInventory).not.toHaveBeenCalled();
    expect(onReferenceFacts).not.toHaveBeenCalled();
  });

  it.each([503, 200])(
    "accepts live when snapshot fails with HTTP %s or invalid JSON shape",
    async (status) => {
      const loading = start(false, () => true, true);
      respond(snapshotUrl, null, status);
      respond(liveUrl, live);
      await loading;
      expect(onInventory).toHaveBeenCalledExactlyOnceWith(live, []);
    },
  );

  it("accepts empty live stock without exposing snapshot units", async () => {
    const emptyLive = { count: 0, items: [] };
    const loading = start(false, () => true, true);
    respond(snapshotUrl, snapshot);
    respond(liveUrl, emptyLive);
    await loading;
    expect(onInventory).toHaveBeenCalledExactlyOnceWith(emptyLive, snapshot.items);
  });

  it("offers only raw live facts when a proposal prevents replacement", async () => {
    const onReferenceFacts = vi.fn();
    const loading = loadInvestorInventory({
      snapshotOnly: false,
      liveRequired: true,
      signal: controller.signal,
      canReplace: () => false,
      onInventory,
      onReferenceFacts,
    });
    respond(snapshotUrl, snapshot);
    respond(liveUrl, live);
    await loading;
    expect(onInventory).not.toHaveBeenCalled();
    expect(onReferenceFacts).toHaveBeenCalledExactlyOnceWith(live.items);
  });

  it("does not suppress a live failure when a proposal prevents replacement", async () => {
    const loading = start(false, () => false, true);
    respond(snapshotUrl, snapshot);
    respond(liveUrl, null, 503);
    await expect(loading).rejects.toThrow("inventory_unavailable");
    expect(onInventory).not.toHaveBeenCalled();
  });

  it("rejects conflicting snapshotOnly and liveRequired options before fetching", async () => {
    await expect(start(true, () => true, true)).rejects.toThrow("inventory_options_invalid");
    expect(fetch).not.toHaveBeenCalled();
    expect(onInventory).not.toHaveBeenCalled();
  });
});

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

  it.each([false, true])(
    "rechecks proposal state after live arrives first and the reference is pending (liveRequired: %s)",
    async (liveRequired) => {
      let interacted = false;
      const loading = start(false, () => !interacted, liveRequired);
      respond(liveUrl, live);
      await Promise.resolve();
      interacted = true;
      respond(snapshotUrl, snapshot);
      await loading;
      expect(onInventory).not.toHaveBeenCalled();
    },
  );

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
