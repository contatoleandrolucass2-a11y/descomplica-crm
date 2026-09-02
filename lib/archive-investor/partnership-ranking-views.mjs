export function latestPartnershipPeriod(entries) {
  return (
    Array.from(new Set(entries.map((entry) => entry.periodMonth)))
      .sort()
      .at(-1) ?? ""
  );
}

export function previousPartnershipPeriod(periodMonth) {
  if (!periodMonth) return "";
  const date = new Date(`${periodMonth.slice(0, 7)}-01T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function normalizePartnershipSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function partnershipImobRows(entries, query) {
  const normalizedQuery = normalizePartnershipSearch(query);
  const positioned = entries.map((entry, index) => ({ entry, position: index + 1 }));
  return normalizedQuery
    ? positioned.filter(({ entry }) =>
        normalizePartnershipSearch(entry.imobName).includes(normalizedQuery),
      )
    : positioned.slice(0, 10);
}

export function partnershipPositionChanges(currentEntries, previousEntries, keyForEntry) {
  const previousPositions = new Map(
    (previousEntries ?? []).map((entry, index) => [String(keyForEntry(entry)), index + 1]),
  );

  return new Map(
    (currentEntries ?? []).map((entry, index) => {
      const key = String(keyForEntry(entry));
      const currentPosition = index + 1;
      const previousPosition = previousPositions.get(key) ?? null;
      return [
        key,
        {
          currentPosition,
          previousPosition,
          change: previousPosition === null ? null : previousPosition - currentPosition,
        },
      ];
    }),
  );
}

export function partnershipEntriesForView(entries, view, options = {}) {
  const latestMonth = options.latestMonth ?? latestPartnershipPeriod(entries);
  if (view === "annual") {
    const year = latestMonth.slice(0, 4);
    const totals = new Map();
    for (const entry of entries.filter((item) => item.periodMonth.startsWith(`${year}-`))) {
      const current = totals.get(entry.imobKey) ?? {
        periodMonth: `${year}-01-01`,
        imobKey: entry.imobKey,
        imobName: entry.imobName,
        vgv: 0,
        contracts: 0,
        sourceRankVgv: null,
        sourceRankContracts: null,
      };
      current.imobName = entry.imobName;
      current.vgv += Number(entry.vgv) || 0;
      current.contracts += Number(entry.contracts) || 0;
      totals.set(entry.imobKey, current);
    }
    return [...totals.values()];
  }

  if (view === "custom") {
    const startMonth = options.customStartMonth ?? options.customMonth ?? "";
    const endMonth = options.customEndMonth ?? options.customMonth ?? "";
    if (!startMonth || !endMonth) return [];
    const totals = new Map();
    for (const entry of entries.filter(
      (item) => item.periodMonth >= startMonth && item.periodMonth <= endMonth,
    )) {
      const current = totals.get(entry.imobKey) ?? {
        periodMonth: startMonth,
        imobKey: entry.imobKey,
        imobName: entry.imobName,
        vgv: 0,
        contracts: 0,
        sourceRankVgv: null,
        sourceRankContracts: null,
      };
      current.imobName = entry.imobName;
      current.vgv += Number(entry.vgv) || 0;
      current.contracts += Number(entry.contracts) || 0;
      totals.set(entry.imobKey, current);
    }
    return [...totals.values()];
  }

  const selectedMonth = view === "previous" ? previousPartnershipPeriod(latestMonth) : latestMonth;
  return entries.filter((entry) => entry.periodMonth === selectedMonth);
}

const PARTNERSHIP_SALES_CHANNEL = "SPC - CANAL IMOB PJ";
const DEFAULT_MAX_SOURCE_SKEW_MS = 90 * 60 * 1000;

function partnershipNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function partnershipTotals(entries) {
  return (entries ?? []).reduce(
    (totals, entry) => ({
      vgv: totals.vgv + (Number(entry?.vgv) || 0),
      contracts: totals.contracts + (Number(entry?.contracts) || 0),
    }),
    { vgv: 0, contracts: 0 },
  );
}

export function partnershipTotalsMatch(imobEntries, developmentEntries) {
  const imobs = partnershipTotals(imobEntries);
  const developments = partnershipTotals(developmentEntries);
  return (
    imobs.contracts === developments.contracts && Math.abs(imobs.vgv - developments.vgv) < 0.01
  );
}

export function partnershipSnapshotsAligned(
  primaryAt,
  secondaryAt,
  maxSkewMs = DEFAULT_MAX_SOURCE_SKEW_MS,
) {
  const primaryTime = new Date(primaryAt ?? "").getTime();
  const secondaryTime = new Date(secondaryAt ?? "").getTime();
  return (
    Number.isFinite(primaryTime) &&
    Number.isFinite(secondaryTime) &&
    Math.abs(primaryTime - secondaryTime) <= maxSkewMs
  );
}

export function aggregatePartnershipDevelopmentSales(records) {
  const totals = new Map();
  const seenSales = new Set();
  for (const record of records ?? []) {
    const salesChannel = String(record?.salesChannel ?? "")
      .trim()
      .toLocaleUpperCase("pt-BR");
    if (!salesChannel.includes(PARTNERSHIP_SALES_CHANNEL)) continue;

    const period = String(record?.date ?? "").slice(0, 7);
    const businessUnit = String(record?.company ?? "").trim();
    const developmentName = String(record?.development ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(period) || !businessUnit || !developmentName) continue;

    const amount = partnershipNumber(record?.amount);
    if (amount <= 0) continue;
    const saleKey = String(record?.key ?? "").trim();
    if (saleKey) {
      if (seenSales.has(saleKey)) continue;
      seenSales.add(saleKey);
    }

    const periodMonth = `${period}-01`;
    const key = `${periodMonth}\u0000${businessUnit.toLocaleLowerCase("pt-BR")}\u0000${developmentName.toLocaleLowerCase("pt-BR")}`;
    const current = totals.get(key) ?? {
      periodMonth,
      businessUnit,
      developmentName,
      vgv: 0,
      contracts: 0,
    };
    current.vgv += amount;
    current.contracts += 1;
    totals.set(key, current);
  }
  return [...totals.values()].sort(
    (left, right) =>
      left.periodMonth.localeCompare(right.periodMonth) ||
      left.businessUnit.localeCompare(right.businessUnit, "pt-BR") ||
      right.vgv - left.vgv ||
      left.developmentName.localeCompare(right.developmentName, "pt-BR"),
  );
}

export function partnershipDevelopmentsForView(entries, view, options = {}) {
  const businessUnit = options.businessUnit ?? "";
  const scoped = businessUnit
    ? entries.filter((entry) => entry.businessUnit === businessUnit)
    : entries;
  const latestMonth = options.latestMonth ?? latestPartnershipPeriod(scoped);

  if (view === "annual") {
    const year = latestMonth.slice(0, 4);
    const totals = new Map();
    for (const entry of scoped.filter((item) => item.periodMonth.startsWith(`${year}-`))) {
      const key = entry.developmentName.toLocaleLowerCase("pt-BR");
      const current = totals.get(key) ?? {
        periodMonth: `${year}-01-01`,
        businessUnit: entry.businessUnit,
        developmentName: entry.developmentName,
        vgv: 0,
        contracts: 0,
      };
      current.vgv += Number(entry.vgv) || 0;
      current.contracts += Number(entry.contracts) || 0;
      totals.set(key, current);
    }
    return [...totals.values()];
  }

  if (view === "custom") {
    const startMonth = options.customStartMonth ?? options.customMonth ?? "";
    const endMonth = options.customEndMonth ?? options.customMonth ?? "";
    if (!startMonth || !endMonth) return [];
    const totals = new Map();
    for (const entry of scoped.filter(
      (item) => item.periodMonth >= startMonth && item.periodMonth <= endMonth,
    )) {
      const key = entry.developmentName.toLocaleLowerCase("pt-BR");
      const current = totals.get(key) ?? {
        periodMonth: startMonth,
        businessUnit: entry.businessUnit,
        developmentName: entry.developmentName,
        vgv: 0,
        contracts: 0,
      };
      current.vgv += Number(entry.vgv) || 0;
      current.contracts += Number(entry.contracts) || 0;
      totals.set(key, current);
    }
    return [...totals.values()];
  }

  const selectedMonth = view === "previous" ? previousPartnershipPeriod(latestMonth) : latestMonth;
  return scoped.filter((entry) => entry.periodMonth === selectedMonth);
}
