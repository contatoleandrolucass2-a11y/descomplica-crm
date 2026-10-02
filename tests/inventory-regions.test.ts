import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noStoreHeaders } from "@/lib/security/api";

const mocks = vi.hoisted(() => ({ authorizeRoute: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));

const POSTAL_CODE = "01001000";
const STREET = "Rua Sintetica de Teste";
const DAY_MS = 86_400_000;
const SOURCE = "viacep+localizasampa+geosampa";
const GEOSAMPA_URL =
  "https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:distrito_municipal&outputFormat=application/json&count=256";
const LOCALIZA_URL = "http://www.sinasc.saude.prefeitura.sp.gov.br/localizasampa/buscacep.asp";
const HEADERS = [
  "CEP",
  "Logradouro",
  "Faixa",
  "Distrito",
  "Cod. Distrito",
  "Bairro",
  "Cod.Localiza",
];
const REGION_NAMES = ["Centro", "Norte", "Sul", "Leste", "Oeste"] as const;

let backend: typeof import("@/lib/inventory/region-lookup");
let GET: typeof import("@/app/api/inventory/regions/route").GET;
let unexpectedUrls: string[];

function districtFixture(count = 96) {
  const named = [
    ["Liberdade", "Centro"],
    ["Bela Vista", "Centro"],
    ["Distrito Norte Sintetico", "Norte"],
    ["Distrito Sul Sintetico", "Sul"],
    ["Distrito Leste Sintetico", "Leste"],
    ["Distrito Oeste Sintetico", "Oeste"],
  ];
  return {
    type: "FeatureCollection",
    numberMatched: count,
    numberReturned: count,
    features: Array.from({ length: count }, (_, index) => ({
      type: "Feature",
      geometry: null,
      properties: {
        nm_distrito_municipal: named[index]?.[0] ?? `Distrito Sintetico ${index}`,
        nm_regiao_05: named[index]?.[1] ?? REGION_NAMES[index % REGION_NAMES.length]!,
        cd_distrito_municipal: String(9000 + index),
      },
    })),
  };
}

function viaCep(postalCode = POSTAL_CODE) {
  return {
    cep: `${postalCode.slice(0, 5)}-${postalCode.slice(5)}`,
    localidade: "São Paulo",
    uf: "SP",
    ibge: "3550308",
    logradouro: STREET,
    bairro: "Bairro Sintetico Zona Oeste",
  };
}

function localizaHtml(
  postalCode = POSTAL_CODE,
  districts = ["Liberdade"],
  street = STREET,
  count = districts.length,
) {
  const rows = districts.map((district) =>
    [postalCode, street, "1 a 999", district, "9005", "Distrito Oeste Sintetico", "LOCAL-1"]
      .map((value) => `<td>${value}</td>`)
      .join(""),
  );
  return `<!doctype html><html><body><div>${count} registro(s) encontrado(s)</div>
    <table id="myTable"><thead><tr>${HEADERS.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row}</tr>`).join("")}</tbody></table></body></html>`;
}

type Provider = (postalCode: string, signal: AbortSignal) => Response | Promise<Response>;
type Providers = {
  viaCep?: Provider;
  localiza?: Provider;
  geoSampa?: (signal: AbortSignal) => Response | Promise<Response>;
};

function serve(providers: Providers = {}) {
  mocks.fetch.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(init).toMatchObject({
      cache: "no-store",
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
    const signal = init!.signal as AbortSignal;
    const viaPath = /^\/ws\/(\d{8})\/json\/$/.exec(url.pathname);
    if (url.origin === "https://viacep.com.br" && viaPath && !url.search) {
      return providers.viaCep?.(viaPath[1]!, signal) ?? Response.json(viaCep(viaPath[1]!));
    }
    if (`${url.origin}${url.pathname}` === LOCALIZA_URL && /^\?r2=\d{8}$/.test(url.search)) {
      const postalCode = url.searchParams.get("r2")!;
      return providers.localiza?.(postalCode, signal) ?? new Response(localizaHtml(postalCode));
    }
    if (url.href === GEOSAMPA_URL) {
      return providers.geoSampa?.(signal) ?? Response.json(districtFixture());
    }
    unexpectedUrls.push(url.href);
    throw new Error("unexpected_synthetic_provider_url");
  });
}

function providerCalls(host: string) {
  return mocks.fetch.mock.calls.filter(([input]) => new URL(String(input)).hostname === host);
}

function request(postalCode = POSTAL_CODE, signal?: AbortSignal) {
  return new Request(
    `https://crm.example.test/api/inventory/regions?postalCode=${encodeURIComponent(postalCode)}`,
    signal ? { signal } : undefined,
  );
}

function batchRequest(postalCodes: readonly string[]) {
  return new Request(
    `https://crm.example.test/api/inventory/regions?postalCodes=${encodeURIComponent(postalCodes.join(","))}`,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function expectNoStore(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
  // Native AbortSignal.timeout is not driven by Vitest's fake clock.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new DOMException("Synthetic deadline", "TimeoutError")),
      milliseconds,
    );
    return controller.signal;
  });
  unexpectedUrls = [];
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.authorizeRoute.mockResolvedValue({ ok: true, context: {} });
  serve();
  backend = await import("@/lib/inventory/region-lookup");
  ({ GET } = await import("@/app/api/inventory/regions/route"));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  expect(unexpectedUrls).toEqual([]);
});

describe("Tabelao client and protected region queue", () => {
  it.each([1, 4])(
    "resolves 22 cold CEPs for %i simultaneous pages without exhausting the queue",
    async (pages) => {
      let active = 0;
      let peak = 0;
      serve({
        geoSampa: () =>
          new Promise<Response>((resolve) =>
            setTimeout(() => resolve(Response.json(districtFixture())), 8_000),
          ),
        localiza: (postalCode) =>
          new Promise<Response>((resolve) => {
            peak = Math.max(peak, ++active);
            setTimeout(() => {
              active--;
              resolve(new Response(localizaHtml(postalCode)));
            }, 6_000);
          }),
      });
      vi.stubGlobal(
        "fetch",
        vi.fn((input: string | URL | Request, init?: RequestInit) => {
          const url = String(input);
          if (url.startsWith("/api/inventory/regions?")) {
            return GET(new Request("https://crm.example.test" + url, init));
          }
          return mocks.fetch(input, init);
        }),
      );
      const { loadTabelaoRegions } = await import("@/lib/archive-investor/tabelao-region.mjs");
      const postalCodes = Array.from({ length: 22 }, (_, index) => String(16000000 + index));
      const callbacks = Array.from({ length: pages }, () => vi.fn());
      const pending = callbacks.map((callback, index) =>
        loadTabelaoRegions(
          index % 2 ? [...postalCodes].reverse() : postalCodes,
          new AbortController().signal,
          callback,
        ),
      );
      await vi.advanceTimersByTimeAsync(8_000);
      const progressiveResults = callbacks.map((callback) => callback.mock.calls.length);
      await vi.advanceTimersByTimeAsync(60_000);
      await Promise.all(pending);
      for (const callback of callbacks) {
        expect(callback).toHaveBeenCalledTimes(22);
        expect(
          callback.mock.calls.every(
            ([, resolution]) =>
              resolution?.status === "confirmed" && resolution.region === "Centro",
          ),
        ).toBe(true);
      }
      expect(progressiveResults.every((count) => count > 0 && count < 22)).toBe(true);
      expect(peak).toBeLessThanOrEqual(3);
      expect(active).toBe(0);
      expect(providerCalls("viacep.com.br")).toHaveLength(22);
      expect(providerCalls("www.sinasc.saude.prefeitura.sp.gov.br")).toHaveLength(22);
      expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
      expect(mocks.authorizeRoute).toHaveBeenCalledTimes(8 * pages);
    },
  );
});

describe("GeoSampa district parser", () => {
  it("maps all 96 distinct names to five regions, without joining district codes", () => {
    const fixture = districtFixture();
    fixture.features[0]!.properties.nm_distrito_municipal = " LIBERDÁDE ";
    fixture.features[0]!.properties.nm_regiao_05 = " CENTRO ";
    const parsed = backend.parseDistrictRegions(fixture);
    expect(parsed.size).toBe(96);
    expect(parsed.get("liberdade")).toBe("Centro");
    expect(parsed.get("distrito oeste sintetico")).toBe("Zona Oeste");
    expect(new Set(parsed.values())).toEqual(
      new Set(["Centro", "Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste"]),
    );
  });

  it.each([0, 89, 90, 95, 97, 256])(
    "rejects a self-consistent but incomplete or excess set of %i districts",
    (count) => {
      expect(() => backend.parseDistrictRegions(districtFixture(count))).toThrow();
    },
  );

  it.each([null, [], {}, { type: "FeatureCollection", features: [] }])(
    "rejects malformed WFS envelopes: %j",
    (value) => {
      expect(() => backend.parseDistrictRegions(value)).toThrow();
    },
  );

  it.each([
    "matched",
    "returned",
    "string-count",
    "duplicate",
    "empty-name",
    "unknown-region",
    "missing-region",
    "only-four-regions",
  ])("rejects WFS inconsistency: %s", (kind) => {
    const fixture = districtFixture();
    if (kind === "matched") fixture.numberMatched = 97;
    if (kind === "returned") fixture.numberReturned = 95;
    if (kind === "string-count") Object.assign(fixture, { numberMatched: "96" });
    if (kind === "duplicate") fixture.features[1]!.properties.nm_distrito_municipal = " LIBERDÁDE ";
    if (kind === "empty-name") fixture.features[0]!.properties.nm_distrito_municipal = " ";
    if (kind === "unknown-region") fixture.features[0]!.properties.nm_regiao_05 = "Metropolitana";
    if (kind === "missing-region")
      Object.assign(fixture.features[0]!.properties, { nm_regiao_05: null });
    if (kind === "only-four-regions") {
      for (const feature of fixture.features) {
        if (feature.properties.nm_regiao_05 === "Norte") feature.properties.nm_regiao_05 = "Sul";
      }
    }
    expect(() => backend.parseDistrictRegions(fixture)).toThrow();
  });
});

describe("LocalizaSampa HTML parser", () => {
  it("reads only myTable, retaining all matching districts and ignoring bairro and incompatible codes", () => {
    const html = localizaHtml(
      POSTAL_CODE,
      ["Liberdade", "Bela Vista", "Liberdade"],
      " RUA SINTÉTICA  DE TESTE ",
    );
    expect(
      backend.parseLocalizaDistricts(
        `<table><tr><td>irrelevant</td></tr></table>${html}`,
        POSTAL_CODE,
        STREET,
      ),
    ).toEqual(["Liberdade", "Bela Vista"]);
  });

  it.each([
    ["missing-table", (html: string) => html.replace('id="myTable"', 'id="other"')],
    ["duplicate-table", (html: string) => html + html],
    ["missing-count", (html: string) => html.replace("1 registro(s) encontrado(s)", "")],
    [
      "mismatched-count",
      (html: string) => html.replace("1 registro(s) encontrado(s)", "2 registro(s) encontrado(s)"),
    ],
    ["duplicate-count", (html: string) => html + "<div>1 registro(s) encontrado(s)</div>"],
    ["wrong-header", (html: string) => html.replace("<th>Distrito</th>", "<th>Regiao</th>")],
    ["missing-header", (html: string) => html.replace("<th>Faixa</th>", "")],
    [
      "extra-header",
      (html: string) => html.replace("<th>Faixa</th>", "<th>Faixa</th><th>Extra</th>"),
    ],
    ["missing-cell", (html: string) => html.replace("<td>LOCAL-1</td>", "")],
    [
      "extra-cell",
      (html: string) => html.replace("<td>LOCAL-1</td>", "<td>LOCAL-1</td><td>extra</td>"),
    ],
    ["empty-district", (html: string) => html.replace("<td>Liberdade</td>", "<td> </td>")],
    ["truncated-row", (html: string) => html.slice(0, html.indexOf("<td>9005"))],
  ] as const)("fails closed on %s", (_kind, transform) => {
    expect(() =>
      backend.parseLocalizaDistricts(transform(localizaHtml()), POSTAL_CODE, STREET),
    ).toThrow();
  });

  it.each([
    ["01002000", STREET],
    [POSTAL_CODE, "Outra Rua Sintetica"],
  ])("rejects a row for another address: %s %s", (postalCode, street) => {
    expect(() =>
      backend.parseLocalizaDistricts(
        localizaHtml(postalCode, ["Liberdade"], street),
        POSTAL_CODE,
        STREET,
      ),
    ).toThrow("region_address_conflict");
  });

  it("rejects a conflicting later row instead of accepting the first district", () => {
    const html = localizaHtml(POSTAL_CODE, ["Liberdade", "Bela Vista"]);
    const secondStreet = html.lastIndexOf(`<td>${STREET}</td>`);
    const conflicting =
      html.slice(0, secondStreet) + html.slice(secondStreet).replace(STREET, "Outra Rua");
    expect(() => backend.parseLocalizaDistricts(conflicting, POSTAL_CODE, STREET)).toThrow(
      "region_address_conflict",
    );
  });

  it("rejects zero rows and a result exceeding 500 rows", () => {
    expect(() =>
      backend.parseLocalizaDistricts(localizaHtml(POSTAL_CODE, []), POSTAL_CODE, STREET),
    ).toThrow();
    expect(() =>
      backend.parseLocalizaDistricts(
        localizaHtml(POSTAL_CODE, Array<string>(501).fill("Liberdade")),
        POSTAL_CODE,
        STREET,
      ),
    ).toThrow();
  });
});

describe("Region route authorization and input", () => {
  it.each([401, 403])(
    "authorizes before cold, pending and warm cache access (%i)",
    async (status) => {
      const error = status === 401 ? "unauthenticated" : "forbidden";
      mocks.authorizeRoute.mockImplementation(async () => ({
        ok: false,
        response: Response.json({ error }, { status, headers: noStoreHeaders() }),
      }));
      const deniedCold = await GET(request("invalid"));
      expect(deniedCold.status).toBe(status);
      expectNoStore(deniedCold);
      expect(mocks.fetch).not.toHaveBeenCalled();

      const gate = deferred<Response>();
      serve({ viaCep: () => gate.promise });
      mocks.authorizeRoute.mockResolvedValueOnce({ ok: true });
      const allowed = GET(request());
      await vi.advanceTimersByTimeAsync(0);
      const deniedPending = await GET(request());
      const pendingFetches = mocks.fetch.mock.calls.length;
      gate.resolve(Response.json(viaCep()));
      expect((await allowed).status).toBe(200);
      const deniedWarm = await GET(request());
      for (const response of [deniedPending, deniedWarm]) {
        expect(response.status).toBe(status);
        expectNoStore(response);
        await expect(response.json()).resolves.toEqual({ error });
      }
      expect(pendingFetches).toBe(1);
      expect(mocks.fetch).toHaveBeenCalledTimes(3);
      expect(mocks.authorizeRoute.mock.calls).toEqual(
        Array.from({ length: 4 }, () => ["crm.simulators.view"]),
      );
    },
  );

  it.each([
    "",
    "?postalCode=",
    "?postalCode=00000000",
    "?postalCode=123",
    "?postalCode=010010000",
    "?postalCode=01.001-000",
    "?postalCode=01001abc",
    "?postalCode=01001%20000",
    "?postalCode=01001000&postalCode=01002000",
    "?postalCode=01001000&postalCode=01001000",
  ])("returns 400 for an invalid query (%s) before providers", async (query) => {
    const response = await GET(
      new Request(`https://crm.example.test/api/inventory/regions${query}`),
    );
    expect(response.status).toBe(400);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({ error: "invalid_postal_code" });
    expect(mocks.authorizeRoute).toHaveBeenCalledWith("crm.simulators.view");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("normalizes a valid formatted CEP and returns a no-store verified resolution", async () => {
    const response = await GET(request("01001-000"));
    expectNoStore(response);
    await expect(response.json()).resolves.toMatchObject({
      postalCode: POSTAL_CODE,
      region: "Centro",
      status: "confirmed",
      municipality: "São Paulo",
      state: "SP",
      districts: ["Liberdade"],
      source: SOURCE,
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("Region batch route", () => {
  it.each([401, 403])(
    "authorizes once before batch validation or cold and warm caches (%i)",
    async (status) => {
      const codes = [POSTAL_CODE, "01002000"];
      const error = status === 401 ? "unauthenticated" : "forbidden";
      const deny = () =>
        mocks.authorizeRoute.mockImplementation(async () => ({
          ok: false,
          response: Response.json({ error }, { status, headers: noStoreHeaders() }),
        }));
      deny();
      for (const codesToDeny of [[POSTAL_CODE, "invalid"], codes]) {
        const response = await GET(batchRequest(codesToDeny));
        expect(response.status).toBe(status);
        expectNoStore(response);
        await expect(response.json()).resolves.toEqual({ error });
      }
      expect(mocks.authorizeRoute).toHaveBeenCalledTimes(2);
      expect(mocks.fetch).not.toHaveBeenCalled();
      mocks.authorizeRoute.mockResolvedValueOnce({ ok: true });
      expect((await GET(batchRequest(codes))).status).toBe(200);
      const fetches = mocks.fetch.mock.calls.length;
      const deniedWarm = await GET(batchRequest(codes));
      expect(deniedWarm.status).toBe(status);
      expectNoStore(deniedWarm);
      await expect(deniedWarm.json()).resolves.toEqual({ error });
      expect(mocks.fetch).toHaveBeenCalledTimes(fetches);
      expect(mocks.authorizeRoute).toHaveBeenCalledTimes(4);
    },
  );

  it.each([
    "?postalCodes=",
    "?postalCodes=,",
    "?postalCodes=01001000,",
    "?postalCodes=,01001000",
    "?postalCodes=01001000,,01002000",
    "?postalCodes=01001000,%20",
    "?postalCodes=01001000,00000000",
    "?postalCodes=01001000,123",
    "?postalCodes=01001000,010020000",
    "?postalCodes=01001000,01002abc",
    "?postalCodes=01001000,01.002-000",
    "?postalCodes=01001000,01002%20000",
    "?postalCodes=01001000,01001000",
    "?postalCodes=01001000,01001-000",
    "?postalCodes=01001000,%2001001000%20",
    "?postalCodes=01001000&postalCodes=01002000",
    "?postalCodes=01001000&postalCodes=01001000",
    "?postalCodes=01001000&postalCodes=",
    "?postalCodes=01001000&postalCode=01002000",
    "?postalCodes=01001000&postalCode=",
    "?postalCodes=&postalCode=01001000",
    "?postalCodes=01001000&postalCode=01002000&postalCode=01003000",
    "?postalCode=01001000,01002000",
    `?postalCodes=${Array.from({ length: 9 }, (_, index) => String(17000000 + index)).join(",")}`,
  ])("rejects the whole invalid batch before any lookup: %s", async (query) => {
    const response = await GET(
      new Request(`https://crm.example.test/api/inventory/regions${query}`),
    );
    expect(response.status).toBe(400);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({ error: "invalid_postal_code" });
    expect(mocks.authorizeRoute).toHaveBeenCalledExactlyOnceWith("crm.simulators.view");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([1, 8])("returns a batch of %i normalized CEPs in input order", async (count) => {
    const codes = Array.from({ length: count }, (_, index) => String(18000000 + count - index));
    const formatted = codes.map((code, index) =>
      index % 2 === 0 ? `${code.slice(0, 5)}-${code.slice(5)}` : code,
    );
    const response = await GET(batchRequest(formatted));
    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({
      results: codes.map((postalCode) =>
        expect.objectContaining({ postalCode, status: "confirmed", region: "Centro" }),
      ),
    });
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(1);
    expect(providerCalls("viacep.com.br")).toHaveLength(count);
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
  });

  it("preserves the individual response and shares cache with a one-CEP batch", async () => {
    const individual = await GET(request("01001-000"));
    const item = await individual.json();
    const batch = await GET(batchRequest([POSTAL_CODE]));
    expectNoStore(individual);
    expectNoStore(batch);
    expect(item).toMatchObject({ postalCode: POSTAL_CODE, status: "confirmed", region: "Centro" });
    expect(item).not.toHaveProperty("results");
    await expect(batch.json()).resolves.toEqual({ results: [item] });
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  it("retains successful, outside-city and failed entries without failing the whole batch", async () => {
    const codes = ["19000001", "19000002", "19000003"];
    serve({
      viaCep: (postalCode) => {
        if (postalCode === codes[1]) {
          return Response.json({
            ...viaCep(postalCode),
            localidade: "Cidade Sintetica",
            ibge: "3500001",
          });
        }
        if (postalCode === codes[2]) throw new Error("synthetic provider failure");
        return Response.json(viaCep(postalCode));
      },
    });
    const response = await GET(batchRequest(codes));
    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        { postalCode: codes[0], status: "confirmed", region: "Centro" },
        { postalCode: codes[1], status: "outside-city", region: null },
        { postalCode: codes[2], status: "unconfirmed", region: null },
      ],
    });
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(1);
  });

  it("authorizes 30 identical eight-CEP batches only 30 times and coalesces within three slots", async () => {
    const codes = Array.from({ length: 8 }, (_, index) => String(20000008 - index));
    const gates = new Map(codes.map((code) => [code, deferred<Response>()]));
    const started: string[] = [];
    let active = 0;
    let peak = 0;
    serve({
      viaCep: async (postalCode) => {
        started.push(postalCode);
        active += 1;
        peak = Math.max(peak, active);
        try {
          return await gates.get(postalCode)!.promise;
        } finally {
          active -= 1;
        }
      },
    });
    const pending = Array.from({ length: 30 }, () => GET(batchRequest(codes)));
    await vi.advanceTimersByTimeAsync(0);
    const initial = [...started];
    for (const code of codes) {
      gates.get(code)!.resolve(Response.json(viaCep(code)));
      await vi.advanceTimersByTimeAsync(0);
    }
    const responses = await Promise.all(pending);
    expect(initial).toEqual(codes.slice(0, 3));
    expect(started).toEqual(codes);
    expect(peak).toBe(3);
    expect(active).toBe(0);
    expect(mocks.authorizeRoute.mock.calls).toEqual(
      Array.from({ length: 30 }, () => ["crm.simulators.view"]),
    );
    expect(providerCalls("viacep.com.br")).toHaveLength(8);
    expect(providerCalls("www.sinasc.saude.prefeitura.sp.gov.br")).toHaveLength(8);
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
    const expected = {
      results: codes.map((postalCode) =>
        expect.objectContaining({ postalCode, status: "confirmed", region: "Centro" }),
      ),
    };
    for (const response of responses) {
      expect(response.status).toBe(200);
      expectNoStore(response);
      await expect(response.json()).resolves.toEqual(expected);
    }
    const fetches = mocks.fetch.mock.calls.length;
    const warm = await GET(batchRequest(codes));
    await expect(warm.json()).resolves.toEqual(expected);
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(31);
    expect(mocks.fetch).toHaveBeenCalledTimes(fetches);
  });

  it("bounds a queued batch by five seconds of waiting plus 18 seconds of lookup", async () => {
    const blockers = ["21000001", "21000002", "21000003"];
    const codes = Array.from({ length: 8 }, (_, index) => String(21000010 + index));
    const gates = new Map([...blockers, ...codes].map((code) => [code, deferred<Response>()]));
    serve({ viaCep: (postalCode) => gates.get(postalCode)!.promise });
    const occupying = blockers.map((code) => backend.lookupInventoryRegion(code));
    const finished: Response[] = [];
    const batch = GET(batchRequest(codes)).then((response) => {
      finished.push(response);
      return response;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    gates
      .get(blockers[0]!)!
      .resolve(
        Response.json({ ...viaCep(blockers[0]), localidade: "Cidade Sintetica", ibge: "3500001" }),
      );
    await vi.advanceTimersByTimeAsync(17_999);
    const beforeDeadline = finished.length;
    await vi.advanceTimersByTimeAsync(1);
    const atDeadline = finished.length;
    for (const [postalCode, gate] of gates) gate.resolve(Response.json(viaCep(postalCode)));
    await Promise.all(occupying);
    const response = await batch;
    expect(beforeDeadline).toBe(0);
    expect(atDeadline).toBe(1);
    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toMatchObject({
      results: codes.map((postalCode, index) => ({
        postalCode,
        status: "unconfirmed",
        region: null,
        reason: index === 0 ? "region_provider_unavailable" : "region_lookup_busy",
      })),
    });
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(1);
    expect(providerCalls("viacep.com.br")).toHaveLength(4);
  });
});

describe("Postal code resolution", () => {
  it.each(["", "00000000", "01001-000", "123", "010010000", "01001a00", " 01001000 "])(
    "rejects noncanonical lookup input %s without providers",
    async (value) => {
      await expect(backend.lookupInventoryRegion(value)).resolves.toMatchObject({
        status: "unconfirmed",
        region: null,
        reason: "invalid-postal-code",
      });
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    { cep: "01002-000" },
    { cep: 1001000 },
    { localidade: "Outra Cidade" },
    { uf: "RJ" },
    { uf: "sp" },
    { ibge: "9999999" },
    { ibge: 3550308 },
    { logradouro: "" },
    { logradouro: null },
    { localidade: null },
  ])("rejects conflicting or malformed ViaCEP identity (%j) before Localiza", async (fields) => {
    serve({ viaCep: () => Response.json({ ...viaCep(), ...fields }) });
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status: "unconfirmed",
      region: null,
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns outside-city without querying Localiza or GeoSampa", async () => {
    serve({
      viaCep: (postalCode) =>
        Response.json({ ...viaCep(postalCode), localidade: "Cidade Sintetica", ibge: "3500001" }),
    });
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status: "outside-city",
      region: null,
      districts: [],
      municipality: "Cidade Sintetica",
      state: "SP",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not substitute bairro or district codes for official district names", async () => {
    serve({
      localiza: (postalCode) => new Response(localizaHtml(postalCode, ["Distrito Inexistente"])),
    });
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status: "unconfirmed",
      region: null,
      districts: ["Distrito Inexistente"],
    });
  });

  it.each([
    [["Liberdade", "Bela Vista"], "confirmed", "Centro"],
    [["Liberdade", "Distrito Oeste Sintetico"], "unconfirmed", null],
    [["Distrito Oeste Sintetico", "Liberdade"], "unconfirmed", null],
    [["Liberdade", "Distrito Inexistente"], "unconfirmed", null],
  ] as const)("requires agreement across every district: %j", async (districts, status, region) => {
    serve({ localiza: (postalCode) => new Response(localizaHtml(postalCode, [...districts])) });
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status,
      region,
      districts,
    });
  });

  it.each(["viaCep", "localiza", "geoSampa"] as const)(
    "fails closed on %s HTTP failure",
    async (provider) => {
      serve({ [provider]: () => new Response("synthetic unavailable", { status: 503 }) });
      await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
        status: "unconfirmed",
        region: null,
        reason: "region_provider_unavailable",
      });
    },
  );

  it.each(["not-json", '{"cep":', "null"])(
    "fails closed on malformed ViaCEP JSON %s",
    async (body) => {
      serve({ viaCep: () => new Response(body) });
      await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
        status: "unconfirmed",
        region: null,
      });
    },
  );

  it.each([
    ["viaCep", 20_000],
    ["localiza", 250_000],
    ["geoSampa", 6_000_000],
  ] as const)("bounds %s streamed bytes even when content-length lies", async (provider, limit) => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(limit + 1).fill(32));
      },
      cancel,
    });
    serve({ [provider]: () => new Response(stream, { headers: { "content-length": "1" } }) });
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status: "unconfirmed",
      region: null,
      reason: "region_provider_invalid",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid UTF-8 instead of replacing address bytes", async () => {
    serve({ viaCep: () => new Response(new Uint8Array([0xff])) });
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status: "unconfirmed",
      region: null,
    });
  });

  it("cancels an unread HTTP error body before releasing its lookup slot", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), { status: 503 });
    serve({ viaCep: () => response });
    const result = await backend.lookupInventoryRegion(POSTAL_CODE);
    const cancelledBeforeReturn = cancel.mock.calls.length;
    await response.body?.cancel();
    expect(result).toMatchObject({ status: "unconfirmed", region: null });
    expect(cancelledBeforeReturn).toBe(1);
  });

  it.each(["truncated-geosampa", "incomplete-localiza", "conflicting-street"] as const)(
    "never confirms a partially valid source: %s",
    async (kind) => {
      serve(
        kind === "truncated-geosampa"
          ? { geoSampa: () => new Response(JSON.stringify(districtFixture()).slice(0, -20)) }
          : {
              localiza: (postalCode) =>
                new Response(
                  localizaHtml(
                    postalCode,
                    ["Liberdade"],
                    kind === "conflicting-street" ? "Outra Rua Sintetica" : STREET,
                    kind === "incomplete-localiza" ? 2 : 1,
                  ),
                ),
            },
      );
      await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
        status: "unconfirmed",
        region: null,
      });
    },
  );
});

describe("Region cache and concurrency", () => {
  it("coalesces 30 cold callers and serves 30 warm callers, authorizing each one", async () => {
    const gate = deferred<Response>();
    serve({ viaCep: () => gate.promise });
    const pending = Array.from({ length: 30 }, () => GET(request()));
    await vi.advanceTimersByTimeAsync(0);
    const coldCalls = mocks.fetch.mock.calls.length;
    gate.resolve(Response.json(viaCep()));
    const cold = await Promise.all(pending);
    const warm = await Promise.all(Array.from({ length: 30 }, () => GET(request())));
    for (const response of [...cold, ...warm]) {
      expectNoStore(response);
      await expect(response.json()).resolves.toMatchObject({
        status: "confirmed",
        region: "Centro",
      });
    }
    expect(coldCalls).toBe(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(60);
  });

  it("expires successful CEP and shared GeoSampa cache at exactly 24 hours", async () => {
    const start = Date.now();
    const initial = await backend.lookupInventoryRegion(POSTAL_CODE);
    vi.setSystemTime(start + DAY_MS - 1);
    expect(await backend.lookupInventoryRegion(POSTAL_CODE)).toEqual(initial);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    vi.setSystemTime(start + DAY_MS);
    await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
      status: "confirmed",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(6);
  });

  it("caches at most 256 CEPs and retains a recently accessed entry", async () => {
    serve({
      viaCep: (postalCode) =>
        Response.json({ ...viaCep(postalCode), localidade: "Cidade Sintetica", ibge: "3500001" }),
    });
    const codes = Array.from({ length: 257 }, (_, index) => String(11000000 + index));
    for (const code of codes.slice(0, 256)) await backend.lookupInventoryRegion(code);
    await backend.lookupInventoryRegion(codes[0]!);
    await backend.lookupInventoryRegion(codes[256]!);
    await backend.lookupInventoryRegion(codes[0]!);
    expect(mocks.fetch).toHaveBeenCalledTimes(257);
    await backend.lookupInventoryRegion(codes[1]!);
    expect(mocks.fetch).toHaveBeenCalledTimes(258);
  });

  it.each(["network", "not-found", "ambiguous"] as const)(
    "keeps %s negative results for 60 seconds, then recovers",
    async (failure) => {
      serve(
        failure === "network"
          ? {
              viaCep: () => {
                throw new Error("synthetic network failure");
              },
            }
          : failure === "not-found"
            ? { viaCep: () => Response.json({ erro: true }) }
            : {
                localiza: (postalCode) =>
                  new Response(localizaHtml(postalCode, ["Liberdade", "Distrito Oeste Sintetico"])),
              },
      );
      const start = Date.now();
      const initial = await backend.lookupInventoryRegion(POSTAL_CODE);
      expect(initial).toMatchObject({ status: "unconfirmed", region: null });
      const fetches = mocks.fetch.mock.calls.length;
      serve();
      vi.setSystemTime(start + 59_999);
      expect(await backend.lookupInventoryRegion(POSTAL_CODE)).toEqual(initial);
      expect(mocks.fetch).toHaveBeenCalledTimes(fetches);
      vi.setSystemTime(start + 60_000);
      await expect(backend.lookupInventoryRegion(POSTAL_CODE)).resolves.toMatchObject({
        status: "confirmed",
        region: "Centro",
      });
      expect(providerCalls("viacep.com.br")).toHaveLength(2);
    },
  );

  it("shares GeoSampa failure cooldown across different CEPs and recovers after 60 seconds", async () => {
    const start = Date.now();
    serve({ geoSampa: () => new Response("synthetic failure", { status: 503 }) });
    await backend.lookupInventoryRegion(POSTAL_CODE);
    serve();
    vi.setSystemTime(start + 59_999);
    await expect(backend.lookupInventoryRegion("01002000")).resolves.toMatchObject({
      status: "unconfirmed",
      region: null,
    });
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
    vi.setSystemTime(start + 60_000);
    await expect(backend.lookupInventoryRegion("01003000")).resolves.toMatchObject({
      status: "confirmed",
    });
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(2);
  });

  it("limits active lookups to three, admits 32 waiters and expires only the queue after 5 seconds", async () => {
    const gate = deferred<void>();
    serve({
      viaCep: async (postalCode) => {
        await gate.promise;
        return Response.json(viaCep(postalCode));
      },
    });
    const settled: Array<{ index: number; reason: string }> = [];
    const pending = Array.from({ length: 36 }, (_, index) =>
      backend.lookupInventoryRegion(String(12000000 + index)).then((result) => {
        settled.push({ index, reason: result.reason });
        return result;
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    const initial = [...settled];
    const initialFetches = mocks.fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(4_999);
    const beforeDeadline = settled.length;
    await vi.advanceTimersByTimeAsync(1);
    const expired = [...settled];
    gate.resolve();
    const results = await Promise.all(pending);
    expect(initialFetches).toBe(3);
    expect(initial).toEqual([{ index: 35, reason: "region_lookup_busy" }]);
    expect(beforeDeadline).toBe(1);
    expect(expired).toHaveLength(33);
    expect(expired.every((result) => result.reason === "region_lookup_busy")).toBe(true);
    expect(results.slice(0, 3).every((result) => result.status === "confirmed")).toBe(true);
    expect(providerCalls("viacep.com.br")).toHaveLength(3);
    await expect(backend.lookupInventoryRegion("13000000")).resolves.toMatchObject({
      status: "confirmed",
    });
  });

  it("transfers a released slot to a queued request without starting a fourth lookup", async () => {
    const gates = Array.from({ length: 4 }, () => deferred<Response>());
    const codes = Array.from({ length: 4 }, (_, index) => String(14000000 + index));
    serve({ viaCep: (postalCode) => gates[codes.indexOf(postalCode)]!.promise });
    const pending = codes.map((code) => backend.lookupInventoryRegion(code));
    await vi.advanceTimersByTimeAsync(0);
    const initialFetches = providerCalls("viacep.com.br").length;
    gates[0]!.resolve(Response.json(viaCep(codes[0])));
    await vi.advanceTimersByTimeAsync(0);
    const releasedFetches = providerCalls("viacep.com.br").length;
    for (let index = 1; index < gates.length; index += 1)
      gates[index]!.resolve(Response.json(viaCep(codes[index])));
    const results = await Promise.all(pending);
    expect(initialFetches).toBe(3);
    expect(releasedFetches).toBe(4);
    expect(results.every((result) => result.status === "confirmed")).toBe(true);
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
  });

  it("does not let cancellation of one HTTP caller abort a shared CEP lookup", async () => {
    const gate = deferred<Response>();
    serve({ viaCep: () => gate.promise });
    const controller = new AbortController();
    const first = GET(request(POSTAL_CODE, controller.signal));
    const second = GET(request());
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    const providerSignal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal;
    const wasAborted = providerSignal.aborted;
    gate.resolve(Response.json(viaCep()));
    const responses = await Promise.all([first, second]);
    expect(wasAborted).toBe(false);
    for (const response of responses)
      await expect(response.json()).resolves.toMatchObject({
        status: "confirmed",
        region: "Centro",
      });
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not accumulate Localiza requests outside the three slots when GeoSampa fails", async () => {
    const activeLocaliza = new Set<string>();
    const finishLocaliza: Array<() => void> = [];
    let peakLocaliza = 0;
    serve({
      geoSampa: () => new Response("synthetic failure", { status: 503 }),
      localiza: (postalCode, signal) =>
        new Promise<Response>((resolve, reject) => {
          activeLocaliza.add(postalCode);
          peakLocaliza = Math.max(peakLocaliza, activeLocaliza.size);
          const abort = () => {
            activeLocaliza.delete(postalCode);
            reject(signal.reason);
          };
          signal.addEventListener("abort", abort, { once: true });
          finishLocaliza.push(() => {
            activeLocaliza.delete(postalCode);
            signal.removeEventListener("abort", abort);
            resolve(new Response(localizaHtml(postalCode)));
          });
        }),
    });
    const results = [];
    for (let index = 0; index < 6; index += 1) {
      results.push(await backend.lookupInventoryRegion(String(16000000 + index)));
    }
    const activeAfterLookups = activeLocaliza.size;
    for (const finish of finishLocaliza) finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(results.every((result) => result.status === "unconfirmed")).toBe(true);
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
    expect(peakLocaliza).toBeLessThanOrEqual(3);
    expect(activeAfterLookups).toBe(0);
  });

  it("shares the 15-second GeoSampa deadline across CEPs and then applies cooldown", async () => {
    serve({
      geoSampa: (signal) =>
        new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    });
    const results: Awaited<ReturnType<typeof backend.lookupInventoryRegion>>[] = [];
    const pending = [POSTAL_CODE, "01002000", "01003000"].map((code) =>
      backend.lookupInventoryRegion(code).then((result) => {
        results.push(result);
        return result;
      }),
    );
    await vi.advanceTimersByTimeAsync(14_999);
    const beforeDeadline = results.length;
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all(pending);
    expect(beforeDeadline).toBe(0);
    expect(results).toHaveLength(3);
    expect(
      results.every((result) => result.status === "unconfirmed" && result.region === null),
    ).toBe(true);
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
    await backend.lookupInventoryRegion("01004000");
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(15_000);
  });

  it("releases the lookup at 18 seconds even if fetch settles late after abort", async () => {
    const gate = deferred<Response>();
    serve({ viaCep: () => gate.promise });
    const settled: Awaited<ReturnType<typeof backend.lookupInventoryRegion>>[] = [];
    const pending = backend.lookupInventoryRegion(POSTAL_CODE).then((result) => {
      settled.push(result);
      return result;
    });
    await vi.advanceTimersByTimeAsync(18_000);
    const atDeadline = [...settled];
    gate.resolve(Response.json(viaCep()));
    await pending;
    expect(atDeadline).toHaveLength(1);
    expect(atDeadline[0]).toMatchObject({ status: "unconfirmed", region: null });
    expect(providerCalls("www.sinasc.saude.prefeitura.sp.gov.br")).toHaveLength(0);
  });

  it("does not let an expired lookup cancel the GeoSampa request needed by a later caller", async () => {
    const viaGate = deferred<Response>();
    const geoGate = deferred<Response>();
    let geoSignal!: AbortSignal;
    serve({
      viaCep: (postalCode) =>
        postalCode === POSTAL_CODE ? viaGate.promise : Response.json(viaCep(postalCode)),
      geoSampa: (signal) => {
        geoSignal = signal;
        return geoGate.promise;
      },
    });
    const firstResults: Awaited<ReturnType<typeof backend.lookupInventoryRegion>>[] = [];
    const first = backend.lookupInventoryRegion(POSTAL_CODE).then((result) => {
      firstResults.push(result);
      return result;
    });
    await vi.advanceTimersByTimeAsync(4_000);
    viaGate.resolve(Response.json(viaCep()));
    await vi.advanceTimersByTimeAsync(1_000);
    const second = backend.lookupInventoryRegion("01002000");
    await vi.advanceTimersByTimeAsync(13_000);
    const firstAtDeadline = [...firstResults];
    const geoWasAborted = geoSignal.aborted;
    geoGate.resolve(Response.json(districtFixture()));
    const results = await Promise.all([first, second]);
    expect(firstAtDeadline).toHaveLength(1);
    expect(firstAtDeadline[0]).toMatchObject({ status: "unconfirmed", region: null });
    expect(geoWasAborted).toBe(false);
    expect(results[1]).toMatchObject({ status: "confirmed", region: "Centro" });
    expect(providerCalls("wfs.geosampa.prefeitura.sp.gov.br")).toHaveLength(1);
  });

  it("releases a shared GeoSampa fetch at 15 seconds even if it acknowledges abort late", async () => {
    const gate = deferred<Response>();
    serve({ geoSampa: () => gate.promise });
    const settled: Awaited<ReturnType<typeof backend.lookupInventoryRegion>>[] = [];
    const pending = backend.lookupInventoryRegion(POSTAL_CODE).then((result) => {
      settled.push(result);
      return result;
    });
    await vi.advanceTimersByTimeAsync(15_000);
    const atDeadline = [...settled];
    gate.resolve(Response.json(districtFixture()));
    await pending;
    expect(atDeadline).toHaveLength(1);
    expect(atDeadline[0]).toMatchObject({ status: "unconfirmed", region: null });
  });

  it("releases a stalled body reader at 18 seconds and never caches its late body as success", async () => {
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          body = controller;
        },
      }),
    );
    serve({ viaCep: () => response });
    const settled: Awaited<ReturnType<typeof backend.lookupInventoryRegion>>[] = [];
    const pending = backend.lookupInventoryRegion(POSTAL_CODE).then((result) => {
      settled.push(result);
      return result;
    });
    await vi.advanceTimersByTimeAsync(18_000);
    const atDeadline = [...settled];
    try {
      body.enqueue(new TextEncoder().encode(JSON.stringify(viaCep())));
      body.close();
    } catch {
      /* A timely cancellation may already have closed this synthetic stream. */
    }
    await pending;
    const warm = await backend.lookupInventoryRegion(POSTAL_CODE);
    expect(atDeadline).toHaveLength(1);
    expect(warm).toMatchObject({ status: "unconfirmed", region: null });
    expect(providerCalls("www.sinasc.saude.prefeitura.sp.gov.br")).toHaveLength(0);
  });

  it("discards a late response without replacing a recovered CEP cache entry", async () => {
    const late = deferred<Response>();
    serve({ viaCep: () => late.promise });
    const timedOut = backend.lookupInventoryRegion(POSTAL_CODE);
    await vi.advanceTimersByTimeAsync(18_000);
    await expect(timedOut).resolves.toMatchObject({ status: "unconfirmed" });
    await vi.advanceTimersByTimeAsync(60_000);
    serve();
    const recovered = await backend.lookupInventoryRegion(POSTAL_CODE);
    const cancel = vi.fn();
    late.resolve(new Response(new ReadableStream<Uint8Array>({ cancel })));
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(recovered).toMatchObject({ status: "confirmed", region: "Centro" });
    expect(await backend.lookupInventoryRegion(POSTAL_CODE)).toEqual(recovered);
    expect(providerCalls("viacep.com.br")).toHaveLength(2);
  });
});
