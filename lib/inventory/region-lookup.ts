import { parse, type DefaultTreeAdapterTypes } from "parse5";

import {
  normalizeTabelaoPostalCode,
  type TabelaoRegionName,
  type TabelaoRegionResolution,
} from "../archive-investor/tabelao-region.mjs";

const SOURCE = "viacep+localizasampa+geosampa";
const GEOSAMPA_URL =
  "https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=geoportal:distrito_municipal&outputFormat=application/json&count=256";
const LOCALIZA_URL = "http://www.sinasc.saude.prefeitura.sp.gov.br/localizasampa/buscacep.asp";
const DAY_MS = 86_400_000;
const FAILURE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 256;
const regionsByName = new Map<string, TabelaoRegionName>([
  ["centro", "Centro"],
  ["norte", "Zona Norte"],
  ["sul", "Zona Sul"],
  ["leste", "Zona Leste"],
  ["oeste", "Zona Oeste"],
]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type DistrictMap = Map<string, TabelaoRegionName>;

export function parseDistrictRegions(payload: unknown): DistrictMap {
  if (
    !record(payload) ||
    payload.type !== "FeatureCollection" ||
    !Array.isArray(payload.features) ||
    payload.features.length !== payload.numberMatched ||
    payload.features.length !== payload.numberReturned ||
    payload.features.length !== 96
  ) {
    throw new Error("region_provider_invalid");
  }
  const districts: DistrictMap = new Map();
  for (const feature of payload.features) {
    const properties = record(feature) ? feature.properties : null;
    if (
      !record(properties) ||
      !text(properties.nm_distrito_municipal) ||
      !text(properties.nm_regiao_05)
    ) {
      throw new Error("region_provider_invalid");
    }
    const district = normalize(properties.nm_distrito_municipal);
    // Localiza and GeoSampa use different district codes. Join the official names only.
    const region = regionsByName.get(normalize(properties.nm_regiao_05));
    if (!region || districts.has(district)) throw new Error("region_provider_invalid");
    districts.set(district, region);
  }
  if (new Set(districts.values()).size !== 5) throw new Error("region_provider_invalid");
  return districts;
}

type HtmlNode = DefaultTreeAdapterTypes.Node;
function descendants(node: HtmlNode, tag: string): DefaultTreeAdapterTypes.Element[] {
  const result: DefaultTreeAdapterTypes.Element[] = [];
  const nodes = [node];
  while (nodes.length) {
    const current = nodes.pop()!;
    if ("tagName" in current && current.tagName === tag) result.push(current);
    if ("childNodes" in current) nodes.push(...[...current.childNodes].reverse());
  }
  return result;
}

function nodeText(node: HtmlNode): string {
  if ("value" in node) return node.value;
  return "childNodes" in node
    ? node.childNodes.map(nodeText).join(" ").replace(/\s+/g, " ").trim()
    : "";
}

type LocalizaAddress = { street: string; district: string; streetCode: string };

function parseLocalizaAddresses(html: string, postalCode: string): LocalizaAddress[] {
  const document = parse(html);
  const tables = descendants(document, "table").filter((node) =>
    node.attrs.some((attr) => attr.name === "id" && attr.value === "myTable"),
  );
  const totals = descendants(document, "div")
    .map(nodeText)
    .filter((value) => /^\d+ registro\(s\) encontrado\(s\)$/.test(value));
  if (tables.length !== 1 || totals.length !== 1) throw new Error("region_provider_invalid");
  const rows = descendants(tables[0]!, "tr");
  if (!rows[0]) throw new Error("region_provider_invalid");
  const headers = descendants(rows[0], "th").map((cell) => normalize(nodeText(cell)));
  if (
    headers.join("|") !== "cep|logradouro|faixa|distrito|cod. distrito|bairro|cod.localiza" ||
    rows.length - 1 !== Number(totals[0]!.split(" ")[0]) ||
    rows.length < 2 ||
    rows.length > 501
  ) {
    throw new Error("region_provider_invalid");
  }
  const addresses: LocalizaAddress[] = [];
  for (const row of rows.slice(1)) {
    const cells = descendants(row, "td").map(nodeText);
    if (
      cells.length !== 7 ||
      normalizeTabelaoPostalCode(cells[0]) !== postalCode ||
      !cells[3] ||
      !cells[1]
    )
      throw new Error("region_address_conflict");
    addresses.push({ street: cells[1], district: cells[3], streetCode: cells[6]! });
  }
  return addresses;
}

export function parseLocalizaDistricts(html: string, postalCode: string, street: string): string[] {
  const addresses = parseLocalizaAddresses(html, postalCode);
  if (addresses.some((address) => normalize(address.street) !== normalize(street)))
    throw new Error("region_address_conflict");
  return [...new Set(addresses.map((address) => address.district))];
}

async function resolveLocalizaDistricts(
  html: string,
  postalCode: string,
  street: string,
  signal: AbortSignal,
): Promise<string[]> {
  const addresses = parseLocalizaAddresses(html, postalCode);
  const canonicalStreet = normalize(street);
  if (addresses.some((address) => normalize(address.street) !== canonicalStreet)) {
    const streetCode = addresses[0]!.streetCode;
    const name = /^(rua|avenida) (.+)$/.exec(canonicalStreet)?.[2];
    // A type/title discrepancy is only a candidate, never proof of the same street.
    if (
      !name ||
      !/^\d{6}$/.test(streetCode) ||
      addresses.some(
        (address) =>
          address.streetCode !== streetCode ||
          /^(rua|avenida) (?:professor )?(.+)$/.exec(normalize(address.street))?.[2] !== name,
      )
    ) {
      throw new Error("region_address_conflict");
    }
    const url = new URL("https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs");
    url.search = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "geoportal:segmento_logradouro",
      outputFormat: "application/json",
      count: "256",
      CQL_FILTER: `codlog = '${streetCode}'`,
    }).toString();
    const payload: unknown = JSON.parse(await fetchLimited(url.href, 500_000, signal));
    if (
      !record(payload) ||
      payload.type !== "FeatureCollection" ||
      !Array.isArray(payload.features) ||
      payload.features.length < 1 ||
      payload.features.length > 256 ||
      payload.features.length !== payload.numberMatched ||
      payload.features.length !== payload.numberReturned
    ) {
      throw new Error("region_provider_invalid");
    }
    // Require the entire code-filtered municipal street to agree with ViaCEP over TLS.
    // No fuzzy names, dropped name tokens, CEP ranges or project-to-region overrides.
    for (const feature of payload.features) {
      const properties = record(feature) ? feature.properties : null;
      if (
        !record(properties) ||
        properties.codlog !== streetCode ||
        !text(properties.nm_logradouro) ||
        properties.cd_titulo_logradouro !== null ||
        (properties.tx_preposicao_logradouro !== null && !text(properties.tx_preposicao_logradouro))
      ) {
        throw new Error("region_address_conflict");
      }
      const type =
        properties.cd_tipo_logradouro === "R"
          ? "rua"
          : properties.cd_tipo_logradouro === "AV"
            ? "avenida"
            : null;
      const officialStreet = [type, properties.tx_preposicao_logradouro, properties.nm_logradouro]
        .filter(Boolean)
        .join(" ");
      if (!type || normalize(officialStreet) !== canonicalStreet)
        throw new Error("region_address_conflict");
    }
  }
  return [...new Set(addresses.map((address) => address.district))];
}

async function fetchLimited(url: string, maxBytes: number, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const response = await withinDeadline(
    fetch(url, { cache: "no-store", redirect: "error", signal }).then((result) => {
      if (signal.aborted) {
        void result.body?.cancel().catch(() => undefined);
        throw signal.reason;
      }
      return result;
    }),
    signal,
  );
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error("region_provider_unavailable");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await withinDeadline(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("region_provider_invalid");
      chunks.push(value);
    }
    signal.throwIfAborted();
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

let districtCache: { value: DistrictMap; expiresAt: number } | null = null;
let districtPending: Promise<DistrictMap> | null = null;
let districtFailureUntil = 0;

async function getDistrictRegions(): Promise<DistrictMap> {
  if (districtCache && Date.now() < districtCache.expiresAt) return districtCache.value;
  if (Date.now() < districtFailureUntil) throw new Error("region_provider_unavailable");
  districtPending ??= fetchLimited(GEOSAMPA_URL, 6_000_000, AbortSignal.timeout(15_000))
    .then((body) => {
      const value = parseDistrictRegions(JSON.parse(body));
      districtCache = { value, expiresAt: Date.now() + DAY_MS };
      return value;
    })
    .catch((error: unknown) => {
      districtFailureUntil = Date.now() + FAILURE_TTL_MS;
      throw error;
    })
    .finally(() => {
      districtPending = null;
    });
  return districtPending;
}

function withinDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) {
      void promise.catch(() => undefined);
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function unresolved(postalCode: string, reason: string): TabelaoRegionResolution {
  return {
    postalCode,
    region: null,
    status: "unconfirmed",
    reason,
    municipality: null,
    state: null,
    districts: [],
    checkedAt: new Date().toISOString(),
    source: SOURCE,
  };
}

async function resolvePostalCode(postalCode: string): Promise<TabelaoRegionResolution> {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]);
  try {
    const value: unknown = JSON.parse(
      await fetchLimited(`https://viacep.com.br/ws/${postalCode}/json/`, 20_000, signal),
    );
    if (record(value) && value.erro === true)
      return unresolved(postalCode, "postal-code-not-found");
    if (
      !record(value) ||
      normalizeTabelaoPostalCode(value.cep) !== postalCode ||
      !text(value.localidade) ||
      !text(value.uf) ||
      !/^[A-Z]{2}$/.test(value.uf) ||
      !text(value.ibge) ||
      !/^\d{7}$/.test(value.ibge)
    ) {
      throw new Error("region_provider_invalid");
    }
    const result = {
      ...unresolved(postalCode, "ambiguous-postal-code"),
      municipality: value.localidade,
      state: value.uf,
    };
    if (value.ibge !== "3550308") {
      if (normalize(value.localidade) === "sao paulo" && value.uf === "SP")
        throw new Error("region_address_conflict");
      return { ...result, status: "outside-city", reason: "outside-city" };
    }
    if (
      normalize(value.localidade) !== "sao paulo" ||
      value.uf !== "SP" ||
      !text(value.logradouro)
    ) {
      throw new Error("region_address_conflict");
    }
    const [html, districtRegions] = await Promise.all([
      fetchLimited(`${LOCALIZA_URL}?r2=${postalCode}`, 250_000, signal),
      withinDeadline(getDistrictRegions(), signal),
    ]);
    const districts = await resolveLocalizaDistricts(html, postalCode, value.logradouro, signal);
    const regions = districts.map((district) => districtRegions.get(normalize(district)));
    const unique = new Set(regions);
    // A CEP can cross a zone boundary. Never choose its first district or infer from a bairro.
    if (regions.some((region) => !region) || unique.size !== 1) return { ...result, districts };
    return {
      ...result,
      districts,
      status: "confirmed",
      reason: "single-region-for-postal-code",
      region: regions[0]!,
    };
  } finally {
    // A failed sibling must not leave an external request running after its slot is released.
    controller.abort();
  }
}

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
let active = 0;
const queue: Waiter[] = [];

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (active < 3) active += 1;
  else {
    if (queue.length >= 32) throw new Error("region_lookup_busy");
    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = queue.indexOf(waiter);
          if (index >= 0) queue.splice(index, 1);
          reject(new Error("region_lookup_busy"));
        }, 5_000),
      };
      queue.push(waiter);
    });
  }
  try {
    return await run();
  } finally {
    const waiter = queue.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    } else active -= 1;
  }
}

const cache = new Map<string, { result: TabelaoRegionResolution; expiresAt: number }>();
const pending = new Map<string, Promise<TabelaoRegionResolution>>();

export async function lookupInventoryRegion(postalCode: string): Promise<TabelaoRegionResolution> {
  if (normalizeTabelaoPostalCode(postalCode) !== postalCode)
    return unresolved(postalCode, "invalid-postal-code");
  const entry = cache.get(postalCode);
  if (entry && Date.now() < entry.expiresAt) {
    cache.delete(postalCode);
    cache.set(postalCode, entry);
    return entry.result;
  }
  if (pending.has(postalCode)) return pending.get(postalCode)!;
  const request = withSlot(() => resolvePostalCode(postalCode))
    .catch((error: unknown) =>
      unresolved(
        postalCode,
        error instanceof Error &&
          ["region_provider_invalid", "region_address_conflict", "region_lookup_busy"].includes(
            error.message,
          )
          ? error.message
          : "region_provider_unavailable",
      ),
    )
    .then((result) => {
      cache.delete(postalCode);
      cache.set(postalCode, {
        result,
        expiresAt: Date.now() + (result.status === "unconfirmed" ? FAILURE_TTL_MS : DAY_MS),
      });
      while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      return result;
    })
    .finally(() => pending.delete(postalCode));
  pending.set(postalCode, request);
  return request;
}
