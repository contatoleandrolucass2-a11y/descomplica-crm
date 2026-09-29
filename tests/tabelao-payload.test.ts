import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchInventoryPayload,
  needsTabelaoLocationReference,
} from "@/lib/archive-investor/tabelao-payload";

const item = {
  id: "qa-1",
  businessUnit: "QA",
  project: "Projeto QA",
  product: "Unidade QA",
  plant: "2 quartos",
  finalWithKit: 300_000,
  unitBonus: 10_000,
  tableSlack: 5_000,
  street: "Rua QA",
  streetNumber: "10",
  neighborhood: "Centro",
};
const payload = { count: 1, items: [item] };
const url = "/api/inventory";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Tabelao payload and request lifecycle", () => {
  it("keeps the source values and accepts the upstream numeric count string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...payload, count: "1" })));
    const result = await fetchInventoryPayload(url, new AbortController().signal);
    expect(result).toEqual(payload);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.cache).toBe("no-store");
  });

  it.each([
    null,
    { count: null, items: [] },
    { count: 2, items: [item] },
    { count: 1, items: [null] },
    { count: 1, items: [{ ...item, plant: {} }] },
    { count: 1, items: [{ ...item, streetNumber: 10 }] },
    { count: 1, items: [{ ...item, finalWithKit: "300000" }] },
    { ...payload, generatedAt: {} },
  ])("rejects malformed data before it can crash rendering: %j", async (invalid) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(invalid)));
    await expect(fetchInventoryPayload(url, new AbortController().signal)).rejects.toThrow(
      "inventory_payload_invalid",
    );
  });

  it("does not fetch an address reference for empty or complete live inventory", () => {
    expect(needsTabelaoLocationReference([])).toBe(false);
    expect(needsTabelaoLocationReference([item])).toBe(false);
    expect(needsTabelaoLocationReference([{ ...item, streetNumber: " " }])).toBe(true);
    expect(needsTabelaoLocationReference([{ ...item, neighborhood: null }])).toBe(true);
  });

  it("bounds waiting for headers to 25 seconds and permits a subsequent retry", async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener("abort", () => reject(options.signal!.reason), {
              once: true,
            });
          }),
      ),
    );
    const request = fetchInventoryPayload(url, new AbortController().signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "TimeoutError" });
    deadline.abort(new DOMException("Timeout", "TimeoutError"));
    await rejected;
    expect(timeout).toHaveBeenCalledWith(25_000);

    timeout.mockReturnValue(new AbortController().signal);
    vi.mocked(fetch).mockResolvedValue(Response.json(payload));
    await expect(fetchInventoryPayload(url, new AbortController().signal)).resolves.toEqual(
      payload,
    );
  });

  it("rejects a body that completes after its request was canceled", async () => {
    let finishBody!: (value: unknown) => void;
    const json = vi.fn(
      () =>
        new Promise((resolve) => {
          finishBody = resolve;
        }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json }));
    const controller = new AbortController();
    const request = fetchInventoryPayload(url, controller.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce());
    controller.abort();
    finishBody(payload);
    await rejected;
  });

  it("times out an incomplete response body even after HTTP 200", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options: RequestInit) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(stream) {
                stream.enqueue(new TextEncoder().encode('{"count":1,"items":['));
                options.signal!.addEventListener(
                  "abort",
                  () => stream.error(options.signal!.reason),
                  { once: true },
                );
              },
            }),
          ),
        ),
      ),
    );
    const request = fetchInventoryPayload(url, new AbortController().signal);
    const rejected = expect(request).rejects.toMatchObject({ name: "TimeoutError" });
    deadline.abort(new DOMException("Timeout", "TimeoutError"));
    await rejected;
  });

  it("isolates cancellation and results across 30 concurrent page loads", async () => {
    const replies: Array<(value: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => replies.push(resolve))),
    );
    const controllers = Array.from({ length: 30 }, () => new AbortController());
    const requests = controllers.map((controller) => fetchInventoryPayload(url, controller.signal));
    const results = Promise.allSettled(requests);
    controllers[0]!.abort();
    for (let index = replies.length - 1; index >= 0; index -= 1) {
      replies[index]!(Response.json({ count: 1, items: [{ ...item, id: `qa-${index}` }] }));
    }
    const settled = await results;
    expect(settled[0]!.status).toBe("rejected");
    for (let index = 1; index < settled.length; index += 1) {
      expect(settled[index]).toMatchObject({
        status: "fulfilled",
        value: { items: [{ id: `qa-${index}` }] },
      });
    }
  });
});
