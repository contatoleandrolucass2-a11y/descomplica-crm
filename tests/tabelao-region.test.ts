import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTabelaoRegion,
  fetchTabelaoRegions,
  formatTabelaoRegionTitle,
  loadTabelaoRegions,
  normalizeTabelaoPostalCode,
  parseTabelaoRegionResolution,
  resolveTabelaoRegion,
  type TabelaoRegionName,
  type TabelaoRegionResolution,
} from "@/lib/archive-investor/tabelao-region.mjs";
import {
  buildTabelaoCellSpans,
  enrichTabelaoLocationFields,
} from "@/lib/archive-investor/tabelao-inventory.mjs";

const postalCode = "01234567";
const confirmed: TabelaoRegionResolution = {
  postalCode,
  region: "Centro",
  status: "confirmed",
  reason: "all_districts_same_region",
  municipality: "S\u00e3o Paulo",
  state: "SP",
  districts: ["Distrito QA"],
  checkedAt: "2026-10-01T12:00:00.000Z",
  source: "viacep+localizasampa+geosampa",
};

function requestedPostalCodes(url: unknown) {
  const parameters = new URL(String(url), "https://crm.example").searchParams;
  return (parameters.get("postalCodes") ?? parameters.get("postalCode") ?? "").split(",");
}

function responseFor(url: unknown, overrides: Partial<TabelaoRegionResolution> = {}) {
  const results = requestedPostalCodes(url).map((value) => ({
    ...confirmed,
    postalCode: value,
    ...overrides,
  }));
  return Response.json(String(url).includes("postalCodes=") ? { results } : results[0]);
}

function postalCodeList(count: number) {
  return Array.from({ length: count }, (_, index) => String(12345000 + index));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Tabelao strict postal code", () => {
  it.each(["01234567", "01234-567", " 01234-567 "])("normalizes only CEP notation: %s", (value) => {
    expect(normalizeTabelaoPostalCode(value)).toBe(postalCode);
  });

  it.each([
    null,
    undefined,
    12345678,
    {},
    "",
    "00000000",
    "00000-000",
    "1234567",
    "012345678",
    "CEP 01234-567",
    "a01234567",
    "01234a567",
    "01.234-567",
    "01234 567",
    "01234-567/1",
  ])("does not manufacture a CEP from invalid input: %j", (value) => {
    expect(normalizeTabelaoPostalCode(value)).toBeNull();
  });
});

describe("Tabelao confirmed geography", () => {
  const regions: TabelaoRegionName[] = [
    "Centro",
    "Zona Norte",
    "Zona Sul",
    "Zona Leste",
    "Zona Oeste",
  ];
  it.each(regions)("uses the verified region %s", (region) => {
    expect(
      resolveTabelaoRegion({
        postalCode: "01234-567",
        city: " sao paulo ",
        state: "sp",
        regionResolution: { ...confirmed, region },
      }),
    ).toBe(region);
  });

  it("never falls back to legacy region, neighborhood, project or postal ranges", () => {
    const legacy = { postalCode, region: "Zona Norte", neighborhood: "Centro", project: "Centro" };
    expect(resolveTabelaoRegion(legacy)).toBe("N\u00e3o confirmada");
    expect(resolveTabelaoRegion(null)).toBe("N\u00e3o confirmada");
    expect(
      resolveTabelaoRegion({
        ...legacy,
        regionResolution: { ...confirmed, postalCode: "12345678" },
      }),
    ).toBe("N\u00e3o confirmada");
  });

  it.each([
    { city: "Guarulhos" },
    { state: "RJ" },
    { city: "Sao Paulo", state: "RJ" },
    { city: 123 },
  ])("does not confirm a location that conflicts with inventory: %j", (location) => {
    expect(resolveTabelaoRegion({ postalCode, regionResolution: confirmed, ...location })).toBe(
      "N\u00e3o confirmada",
    );
  });

  it("keeps outside-city and unknown separate without guessing from city alone", () => {
    const outside: TabelaoRegionResolution = {
      ...confirmed,
      status: "outside-city",
      region: null,
      municipality: "Guarulhos",
    };
    expect(
      resolveTabelaoRegion({
        postalCode,
        city: "Guarulhos",
        state: "SP",
        regionResolution: outside,
      }),
    ).toBe("Fora de S\u00e3o Paulo");
    expect(resolveTabelaoRegion({ postalCode, city: "Sao Paulo", regionResolution: outside })).toBe(
      "N\u00e3o confirmada",
    );
    expect(resolveTabelaoRegion({ postalCode, city: "Guarulhos" })).toBe("N\u00e3o confirmada");
    expect(
      resolveTabelaoRegion({
        postalCode,
        regionResolution: {
          ...confirmed,
          status: "unconfirmed",
          region: null,
          reason: "ambiguous_districts",
        },
      }),
    ).toBe("N\u00e3o confirmada");
  });

  it("merges only consecutive identical region labels within each project", () => {
    const item = (region: TabelaoRegionName) => ({
      postalCode,
      regionResolution: { ...confirmed, region },
    });
    const first = [item("Centro"), item("Centro"), item("Zona Sul"), item("Centro")];
    const second = [item("Centro"), item("Centro")];
    expect(buildTabelaoCellSpans(first.map(resolveTabelaoRegion))).toEqual([2, 0, 1, 1]);
    expect(buildTabelaoCellSpans(second.map(resolveTabelaoRegion))).toEqual([2, 0]);
  });

  it("does not resolve an ambiguous CEP using the available street number", () => {
    const item = {
      postalCode,
      streetNumber: "100",
      regionResolution: {
        ...confirmed,
        status: "unconfirmed",
        region: null,
        districts: ["Distrito QA A", "Distrito QA B"],
        reason: "ambiguous_districts",
      },
    };
    expect(resolveTabelaoRegion(item)).toBe("N\u00e3o confirmada");
  });
});

describe("Tabelao region response validation", () => {
  it("accepts and projects the endpoint contract", () => {
    expect(
      parseTabelaoRegionResolution({ ...confirmed, unrelated: "discard" }, postalCode),
    ).toEqual(confirmed);
    expect(
      parseTabelaoRegionResolution(
        {
          ...confirmed,
          status: "unconfirmed",
          region: null,
          municipality: null,
          state: null,
          districts: [],
        },
        postalCode,
      ),
    ).not.toBeNull();
  });

  it.each([
    null,
    [],
    {},
    { ...confirmed, postalCode: "01234-567" },
    { ...confirmed, postalCode: "12345678" },
    { ...confirmed, region: "Zona Central" },
    { ...confirmed, region: null },
    { ...confirmed, status: "ready" },
    { ...confirmed, status: "unconfirmed" },
    { ...confirmed, status: "outside-city", region: null },
    { ...confirmed, status: "outside-city", region: null, municipality: null },
    { ...confirmed, municipality: "Guarulhos" },
    { ...confirmed, state: "RJ" },
    { ...confirmed, state: 123 },
    { ...confirmed, districts: "Centro" },
    { ...confirmed, districts: [123] },
    { ...confirmed, districts: [] },
    { ...confirmed, districts: [""] },
    { ...confirmed, districts: ["  "] },
    { ...confirmed, districts: ["a".repeat(257)] },
    { ...confirmed, districts: Array.from({ length: 257 }, () => "Distrito QA") },
    { ...confirmed, checkedAt: "2026-10-01" },
    { ...confirmed, checkedAt: "invalid" },
    { ...confirmed, checkedAt: "2026-02-30T12:00:00.000Z" },
    { ...confirmed, reason: null },
    { ...confirmed, source: "legacy" },
  ])("rejects malformed or contradictory responses: %j", (value) => {
    expect(parseTabelaoRegionResolution(value, postalCode)).toBeNull();
  });

  it("sends only the normalized CEP to the same-host authenticated endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => Promise.resolve(responseFor(url))),
    );
    await expect(fetchTabelaoRegion("01234-567", new AbortController().signal)).resolves.toEqual(
      confirmed,
    );
    expect(fetch).toHaveBeenCalledWith(
      `/api/inventory/regions?postalCode=${postalCode}`,
      expect.objectContaining({
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    await expect(fetchTabelaoRegion("CEP 01234-567", new AbortController().signal)).rejects.toThrow(
      "inventory_region_postal_code_invalid",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects invalid bodies and HTTP failures without leaking them to the resolver", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ...confirmed, postalCode: "12345678" })),
    );
    await expect(fetchTabelaoRegion(postalCode, new AbortController().signal)).rejects.toThrow(
      "inventory_region_payload_invalid",
    );
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    await expect(fetchTabelaoRegion(postalCode, new AbortController().signal)).rejects.toThrow(
      "inventory_region_unavailable",
    );
  });
});

describe("Tabelao region tooltip", () => {
  it.each([
    ["region_address_conflict", "Diverg\u00eancia entre fontes de endere\u00e7o"],
    ["ambiguous-postal-code", "CEP abrange mais de uma regi\u00e3o"],
    ["region_provider_unavailable", "Fonte de localiza\u00e7\u00e3o indispon\u00edvel"],
    ["region_provider_invalid", "Resposta de localiza\u00e7\u00e3o inv\u00e1lida"],
    ["region_lookup_busy", "Consulta de localiza\u00e7\u00e3o temporariamente ocupada"],
    ["postal-code-not-found", "CEP n\u00e3o localizado"],
  ])("translates %s while retaining verification details", (reason, label) => {
    const title = formatTabelaoRegionTitle({
      postalCode,
      regionResolution: { ...confirmed, status: "unconfirmed", region: null, reason },
    });
    expect(title).toContain(label);
    expect(title).not.toContain(reason);
    expect(title).toContain("Situa\u00e7\u00e3o: N\u00e3o confirmada");
    expect(title).toContain("Distritos: Distrito QA");
    expect(title).toContain("Verificado em:");
  });

  it("does not invent a provider failure while pending or expose unknown error codes", () => {
    expect(formatTabelaoRegionTitle({ postalCode })).toBe("N\u00e3o confirmada");
    expect(formatTabelaoRegionTitle({ postalCode, regionResolution: null })).toBe(
      "N\u00e3o confirmada",
    );
    for (const reason of ["unmapped_internal_error", "toString", "__proto__"]) {
      expect(
        formatTabelaoRegionTitle({
          postalCode,
          regionResolution: { ...confirmed, status: "unconfirmed", region: null, reason },
        }),
      ).not.toContain(reason);
    }
  });

  it("distinguishes invalid CEP and conflicts with inventory from a pending lookup", () => {
    expect(formatTabelaoRegionTitle({})).toBe("CEP n\u00e3o informado ou inv\u00e1lido");
    expect(formatTabelaoRegionTitle({ postalCode: "bad" })).toBe(
      "CEP n\u00e3o informado ou inv\u00e1lido",
    );
    expect(
      formatTabelaoRegionTitle({ postalCode, city: "Guarulhos", regionResolution: confirmed }),
    ).toContain("Diverg\u00eancia entre fontes de endere\u00e7o");
    expect(formatTabelaoRegionTitle({ postalCode, regionResolution: confirmed })).toContain(
      "Situa\u00e7\u00e3o: Confirmada",
    );
    expect(formatTabelaoRegionTitle({ postalCode, regionResolution: confirmed })).not.toContain(
      "Diverg\u00eancia",
    );
  });
});

describe("Tabelao region batch contract", () => {
  const postalCodes = postalCodeList(8);
  const results = postalCodes.map((value) => ({ ...confirmed, postalCode: value }));

  it("encodes eight CEPs in one same-host request and restores requested result order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ results: [...results].reverse() })),
    );
    await expect(
      fetchTabelaoRegions(["12345-000", ...postalCodes.slice(1)], new AbortController().signal),
    ).resolves.toEqual(results);
    expect(fetch).toHaveBeenCalledWith(
      `/api/inventory/regions?postalCodes=${postalCodes.join("%2C")}`,
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    [],
    postalCodeList(9),
    ["12345000", "12345-000"],
    ["bad"],
    ["00000000"],
    [null],
    [12345000],
    Array(1),
  ])("rejects empty, oversized, repeated or invalid request lists: %j", async (values) => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(fetchTabelaoRegions(values, new AbortController().signal)).rejects.toThrow(
      "inventory_region_batch_invalid",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["null envelope", null],
    ["array envelope", results],
    ["absent results", {}],
    ["non-array results", { results: {} }],
    ["missing CEP", { results: results.slice(1) }],
    ["extra CEP", { results: [...results, { ...confirmed, postalCode: "23456789" }] }],
    ["duplicate CEP", { results: [...results.slice(0, 7), results[0]] }],
    [
      "unexpected CEP replacing an expected one",
      { results: [...results.slice(0, 7), { ...confirmed, postalCode: "23456789" }] },
    ],
    ["invalid resolution", { results: [...results.slice(0, 7), { ...results[7], districts: [] }] }],
    [
      "wrong CEP type",
      { results: [...results.slice(0, 7), { ...results[7], postalCode: 12345007 }] },
    ],
    ["null resolution", { results: [...results.slice(0, 7), null] }],
  ])("rejects the complete batch for %s", async (_reason, payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(fetchTabelaoRegions(postalCodes, new AbortController().signal)).rejects.toThrow(
      "inventory_region_payload_invalid",
    );
  });

  it("uses the batch envelope even for a single CEP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => Promise.resolve(responseFor(url))),
    );
    await expect(fetchTabelaoRegions([postalCode], new AbortController().signal)).resolves.toEqual([
      confirmed,
    ]);
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
      `/api/inventory/regions?postalCodes=${postalCode}`,
    );
  });
});

describe("Tabelao region concurrency and lifecycle", () => {
  it("loads 22 distinct CEPs with only three protected requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => Promise.resolve(responseFor(url))),
    );
    const onResolution = vi.fn();
    await loadTabelaoRegions(postalCodeList(22), new AbortController().signal, onResolution);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => requestedPostalCodes(url).length)).toEqual([
      8, 8, 6,
    ]);
    expect(onResolution).toHaveBeenCalledTimes(22);
  });

  it("turns a malformed batch into eight unknown CEPs and preserves the other batch", async () => {
    const postalCodes = postalCodeList(9);
    vi.stubGlobal(
      "fetch",
      vi.fn((url) =>
        Promise.resolve(
          requestedPostalCodes(url).includes(postalCodes[0]!)
            ? Response.json({
                results: requestedPostalCodes(url).map((value, index) => ({
                  ...confirmed,
                  postalCode: value,
                  districts: index === 0 ? [] : confirmed.districts,
                })),
              })
            : responseFor(url),
        ),
      ),
    );
    const onResolution = vi.fn();
    await loadTabelaoRegions(postalCodes, new AbortController().signal, onResolution);
    for (const value of postalCodes.slice(0, 8))
      expect(onResolution).toHaveBeenCalledWith(value, null);
    expect(onResolution).toHaveBeenCalledWith(
      postalCodes[8],
      expect.objectContaining({ status: "confirmed" }),
    );
    expect(onResolution).toHaveBeenCalledTimes(9);
  });

  it("deduplicates and sorts CEPs in groups of eight with at most three concurrent batches", async () => {
    const pending: Array<{ url: unknown; finish: (response: Response) => void }> = [];
    let active = 0;
    let peak = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        peak = Math.max(peak, ++active);
        return new Promise<Response>((resolve) =>
          pending.push({
            url,
            finish: (response) => {
              active--;
              resolve(response);
            },
          }),
        );
      }),
    );
    const onResolution = vi.fn();
    const postalCodes = postalCodeList(40);
    const request = loadTabelaoRegions(
      [...postalCodes].reverse().concat("12345-000", "bad", postalCodes[0]!),
      new AbortController().signal,
      onResolution,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(pending.flatMap(({ url }) => requestedPostalCodes(url))).toEqual(
      postalCodes.slice(0, 24),
    );
    pending[1]!.finish(responseFor(pending[1]!.url));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    pending[0]!.finish(responseFor(pending[0]!.url));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    for (const entry of pending.slice(2)) entry.finish(responseFor(entry.url));
    await request;
    expect(peak).toBe(3);
    expect(onResolution).toHaveBeenCalledTimes(40);
    expect(pending.map(({ url }) => requestedPostalCodes(url).length)).toEqual([8, 8, 8, 8, 8]);
  });

  it("bounds each load to 256 distinct CEPs already in the inventory", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => Promise.resolve(responseFor(url))),
    );
    const postalCodes = Array.from({ length: 300 }, (_, index) =>
      String(12345000 + index),
    ).reverse();
    const onResolution = vi.fn();
    await loadTabelaoRegions(postalCodes, new AbortController().signal, onResolution);
    expect(fetch).toHaveBeenCalledTimes(32);
    expect(onResolution).toHaveBeenCalledTimes(256);
    expect(vi.mocked(fetch).mock.calls.flatMap(([url]) => requestedPostalCodes(url))).toEqual(
      [...postalCodes].sort().slice(0, 256),
    );
  });

  it("resolves every CEP in a failed batch as unknown while continuing the queue", async () => {
    const postalCodes = postalCodeList(33);
    vi.stubGlobal(
      "fetch",
      vi.fn((url) =>
        requestedPostalCodes(url).includes(postalCodes[0]!)
          ? Promise.reject(new Error("offline"))
          : Promise.resolve(responseFor(url)),
      ),
    );
    const onResolution = vi.fn();
    await loadTabelaoRegions(postalCodes, new AbortController().signal, onResolution);
    for (const value of postalCodes.slice(0, 8))
      expect(onResolution).toHaveBeenCalledWith(value, null);
    expect(onResolution).toHaveBeenCalledTimes(33);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(onResolution).toHaveBeenCalledWith(
      postalCodes[32],
      expect.objectContaining({ status: "confirmed" }),
    );
  });

  it("isolates 25-second deadlines, including incomplete response bodies", async () => {
    const deadlines: AbortController[] = [];
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      deadlines.push(controller);
      return controller.signal;
    });
    const finish: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url) =>
        Promise.resolve({
          ok: true,
          json: () =>
            new Promise((resolve) =>
              finish.push(() =>
                resolve({
                  results: requestedPostalCodes(url).map((value) => ({
                    ...confirmed,
                    postalCode: value,
                  })),
                }),
              ),
            ),
        }),
      ),
    );
    const onResolution = vi.fn();
    const postalCodes = postalCodeList(9);
    const request = loadTabelaoRegions(postalCodes, new AbortController().signal, onResolution);
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    deadlines[0]!.abort(new DOMException("Timeout", "TimeoutError"));
    await vi.waitFor(() => expect(onResolution).toHaveBeenCalledTimes(8));
    for (const value of postalCodes.slice(0, 8))
      expect(onResolution).toHaveBeenCalledWith(value, null);
    expect(deadlines[1]!.signal.aborted).toBe(false);
    finish[1]!();
    await request;
    finish[0]!();
    await Promise.resolve();
    expect(onResolution).toHaveBeenCalledTimes(9);
    expect(timeout).toHaveBeenCalledWith(25_000);
  });

  it("aborts queued work on navigation and ignores late responses from an earlier load", async () => {
    const pending: Array<{
      url: unknown;
      signal: AbortSignal;
      finish: (response: Response) => void;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url, options: RequestInit) =>
          new Promise<Response>((resolve) => {
            pending.push({ url, signal: options.signal as AbortSignal, finish: resolve });
          }),
      ),
    );
    const controller = new AbortController();
    const abandoned = vi.fn();
    const previous = loadTabelaoRegions(postalCodeList(33), controller.signal, abandoned);
    controller.abort();
    await previous;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(pending.every(({ signal }) => signal.aborted)).toBe(true);
    const onResolution = vi.fn();
    const current = loadTabelaoRegions(
      [postalCode, "45678901"],
      new AbortController().signal,
      onResolution,
    );
    for (const entry of pending) entry.finish(responseFor(entry.url));
    await current;
    expect(abandoned).not.toHaveBeenCalled();
    expect(onResolution).toHaveBeenCalledTimes(2);
    expect(onResolution).toHaveBeenCalledWith(
      "45678901",
      expect.objectContaining({ postalCode: "45678901" }),
    );
  });

  it("does not cancel a different page or start requests for an already canceled load", async () => {
    const pending: Array<{ url: unknown; finish: (response: Response) => void }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => new Promise<Response>((finish) => pending.push({ url, finish }))),
    );
    const firstController = new AbortController();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const first = loadTabelaoRegions([postalCode], firstController.signal, firstCallback);
    const second = loadTabelaoRegions([postalCode], new AbortController().signal, secondCallback);
    firstController.abort();
    for (const entry of pending) entry.finish(responseFor(entry.url));
    await Promise.all([first, second]);
    await loadTabelaoRegions([postalCode], firstController.signal, firstCallback);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("combines late geography with the latest address reference without mutating stock", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const raw = {
      id: "qa-1",
      businessUnit: "QA",
      project: "QA",
      identifier: "QA-1",
      postalCode,
      parkingSpaces: 0,
    };
    let inventory = [raw];
    const resolutions = new Map<string, TabelaoRegionResolution | null>();
    const request = loadTabelaoRegions(
      [postalCode],
      new AbortController().signal,
      (key, resolution) => resolutions.set(key, resolution),
    );
    inventory = enrichTabelaoLocationFields(inventory, [
      { ...raw, street: "Rua QA", streetNumber: "10", neighborhood: "Bairro QA" },
    ]);
    const enriched = inventory[0]!;
    finish(Response.json({ results: [confirmed] }));
    await request;
    const combined = inventory.map((item) => ({
      ...item,
      regionResolution: resolutions.get(item.postalCode),
    }));
    expect(inventory[0]).toBe(enriched);
    expect(combined[0]).toMatchObject({ street: "Rua QA", parkingSpaces: 0 });
    expect(resolveTabelaoRegion(combined[0])).toBe("Centro");
    expect(raw).not.toHaveProperty("regionResolution");
    expect(raw).not.toHaveProperty("street");
  });
});
