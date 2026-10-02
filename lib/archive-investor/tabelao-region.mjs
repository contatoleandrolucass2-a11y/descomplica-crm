const REGION_NAMES = new Set(["Centro", "Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste"]);
const REGION_SOURCE = "viacep+localizasampa+geosampa";
const UNKNOWN_REGION = "N\u00e3o confirmada";
const OUTSIDE_CITY = "Fora de S\u00e3o Paulo";
const REGION_REQUEST_LIMIT = 256;
const REGION_CONCURRENCY = 3;
const REGION_BATCH_SIZE = 8;
const REGION_REASON_LABELS = {
  region_address_conflict: "Diverg\u00eancia entre fontes de endere\u00e7o",
  "ambiguous-postal-code": "CEP abrange mais de uma regi\u00e3o",
  region_provider_unavailable: "Fonte de localiza\u00e7\u00e3o indispon\u00edvel",
  region_provider_invalid: "Resposta de localiza\u00e7\u00e3o inv\u00e1lida",
  region_lookup_busy: "Consulta de localiza\u00e7\u00e3o temporariamente ocupada",
  "postal-code-not-found": "CEP n\u00e3o localizado",
};
const regionDateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function normalizeTabelaoPostalCode(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^(?:\d{8}|\d{5}-\d{3})$/.test(text)) return null;
  const postalCode = text.replace("-", "");
  return postalCode === "00000000" ? null : postalCode;
}

function normalizePlace(value) {
  return typeof value === "string"
    ? value
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";
}

function isSaoPaulo(municipality, state) {
  return normalizePlace(municipality) === "sao paulo" && normalizePlace(state) === "sp";
}

export function parseTabelaoRegionResolution(value, expectedPostalCode) {
  const postalCode = normalizeTabelaoPostalCode(expectedPostalCode);
  if (
    !postalCode ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.postalCode !== postalCode ||
    value.source !== REGION_SOURCE ||
    !["confirmed", "unconfirmed", "outside-city"].includes(value.status) ||
    !(value.region === null || REGION_NAMES.has(value.region)) ||
    typeof value.reason !== "string" ||
    !value.reason.trim() ||
    !(value.municipality === null || typeof value.municipality === "string") ||
    !(value.state === null || typeof value.state === "string") ||
    !Array.isArray(value.districts) ||
    value.districts.length > 256 ||
    !value.districts.every(
      (district) =>
        typeof district === "string" && district.trim().length > 0 && district.length <= 256,
    ) ||
    typeof value.checkedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value.checkedAt,
    ) ||
    !Number.isFinite(Date.parse(value.checkedAt)) ||
    new Date(`${value.checkedAt.slice(0, 10)}T00:00:00.000Z`).toISOString().slice(0, 10) !==
      value.checkedAt.slice(0, 10)
  ) {
    return null;
  }

  if (value.status === "confirmed") {
    if (
      !value.districts.length ||
      !REGION_NAMES.has(value.region) ||
      !isSaoPaulo(value.municipality, value.state)
    )
      return null;
  } else {
    if (value.region !== null) return null;
    if (
      value.status === "outside-city" &&
      (!normalizePlace(value.municipality) ||
        !normalizePlace(value.state) ||
        isSaoPaulo(value.municipality, value.state))
    ) {
      return null;
    }
  }

  return {
    postalCode,
    region: value.region,
    status: value.status,
    reason: value.reason,
    municipality: value.municipality,
    state: value.state,
    districts: [...value.districts],
    checkedAt: value.checkedAt,
    source: REGION_SOURCE,
  };
}

export function resolveTabelaoRegion(item) {
  const resolution = parseTabelaoRegionResolution(item?.regionResolution, item?.postalCode);
  if (!resolution) return UNKNOWN_REGION;
  for (const [actual, expected] of [
    [item.city, resolution.municipality],
    [item.state, resolution.state],
  ]) {
    if (actual == null || actual === "") continue;
    if (typeof actual !== "string") return UNKNOWN_REGION;
    if (actual.trim() && normalizePlace(actual) !== normalizePlace(expected)) return UNKNOWN_REGION;
  }
  if (resolution.status === "confirmed") return resolution.region;
  return resolution.status === "outside-city" ? OUTSIDE_CITY : UNKNOWN_REGION;
}

export function formatTabelaoRegionTitle(item) {
  if (!normalizeTabelaoPostalCode(item?.postalCode))
    return "CEP n\u00e3o informado ou inv\u00e1lido";
  const region = resolveTabelaoRegion(item);
  const resolution = parseTabelaoRegionResolution(item?.regionResolution, item?.postalCode);
  if (!resolution) return region;
  const status =
    region === UNKNOWN_REGION
      ? UNKNOWN_REGION
      : resolution.status === "outside-city"
        ? OUTSIDE_CITY
        : "Confirmada";
  const reason =
    region === UNKNOWN_REGION
      ? resolution.status !== "unconfirmed"
        ? "region_address_conflict"
        : resolution.reason
      : null;
  const reasonLabel =
    reason && Object.hasOwn(REGION_REASON_LABELS, reason) ? REGION_REASON_LABELS[reason] : null;
  return [
    region,
    `Situa\u00e7\u00e3o: ${status}`,
    reasonLabel,
    resolution.districts.length ? `Distritos: ${resolution.districts.join(", ")}` : null,
    `Verificado em: ${regionDateTime.format(new Date(resolution.checkedAt))}`,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
}

async function fetchRegionPayload(parameters, signal, parsePayload) {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(25_000)]);
  requestSignal.throwIfAborted();
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(requestSignal.reason);
    requestSignal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`/api/inventory/regions?${new URLSearchParams(parameters)}`, {
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          signal: requestSignal,
        });
        if (!response.ok) throw new Error("inventory_region_unavailable");
        const payload = await response.json();
        requestSignal.throwIfAborted();
        const resolution = parsePayload(payload);
        if (!resolution) throw new Error("inventory_region_payload_invalid");
        return resolution;
      })(),
      aborted,
    ]);
  } finally {
    requestSignal.removeEventListener("abort", onAbort);
  }
}

export async function fetchTabelaoRegion(postalCodeInput, signal) {
  const postalCode = normalizeTabelaoPostalCode(postalCodeInput);
  if (!postalCode) throw new Error("inventory_region_postal_code_invalid");
  return fetchRegionPayload({ postalCode }, signal, (payload) =>
    parseTabelaoRegionResolution(payload, postalCode),
  );
}

export async function fetchTabelaoRegions(postalCodeInputs, signal) {
  const postalCodes = Array.isArray(postalCodeInputs)
    ? Array.from(postalCodeInputs, normalizeTabelaoPostalCode)
    : [];
  const expected = new Set(postalCodes);
  if (
    postalCodes.length < 1 ||
    postalCodes.length > REGION_BATCH_SIZE ||
    expected.has(null) ||
    expected.size !== postalCodes.length
  ) {
    throw new Error("inventory_region_batch_invalid");
  }

  return fetchRegionPayload({ postalCodes: postalCodes.join(",") }, signal, (payload) => {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !Array.isArray(payload.results) ||
      payload.results.length !== postalCodes.length
    ) {
      return null;
    }
    const resolutions = new Map();
    for (const result of payload.results) {
      const postalCode = result?.postalCode;
      if (!expected.has(postalCode) || resolutions.has(postalCode)) return null;
      const resolution = parseTabelaoRegionResolution(result, postalCode);
      if (!resolution) return null;
      resolutions.set(postalCode, resolution);
    }
    return postalCodes.map((postalCode) => resolutions.get(postalCode));
  });
}

export async function loadTabelaoRegions(postalCodes, signal, onResolution) {
  const queue = [...new Set(postalCodes.map(normalizeTabelaoPostalCode).filter(Boolean))]
    .sort()
    .slice(0, REGION_REQUEST_LIMIT);
  let next = 0;

  async function worker() {
    while (!signal.aborted && next < queue.length) {
      const batch = queue.slice(next, next + REGION_BATCH_SIZE);
      next += REGION_BATCH_SIZE;
      let resolutions = null;
      try {
        resolutions = await fetchTabelaoRegions(batch, signal);
      } catch {
        // A failed batch leaves its CEPs unknown without blocking stock or other batches.
      }
      for (const [index, postalCode] of batch.entries()) {
        if (signal.aborted) return;
        onResolution(postalCode, resolutions?.[index] ?? null);
      }
    }
  }

  const workers = Math.min(REGION_CONCURRENCY, Math.ceil(queue.length / REGION_BATCH_SIZE));
  await Promise.all(Array.from({ length: workers }, worker));
}
