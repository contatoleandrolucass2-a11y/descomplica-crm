import { resolveInvestorRegion } from "./investor-region.mjs";

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export const TABELAO_PRICE_RANGES = [
  { value: "all", label: "Todos os valores" },
  { value: "up-to-200", label: "Até R$ 200 mil" },
  { value: "200-to-300", label: "R$ 200 mil a R$ 300 mil" },
  { value: "300-to-400", label: "R$ 300 mil a R$ 400 mil" },
  { value: "over-400", label: "Acima de R$ 400 mil" },
];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateTabelaoPrice(item) {
  const values = [item.finalWithKit, item.unitBonus, item.tableSlack];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    return null;
  }
  const [gross, bonus, slack] = values.map((value) => Math.round((value + Number.EPSILON) * 100));
  const net = gross - bonus - slack;
  return values[0] > 0 && [gross, bonus, slack, net].every(Number.isSafeInteger) && net > 0
    ? net / 100
    : null;
}

const validPrice = calculateTabelaoPrice;

function compareUnits(left, right) {
  return (
    collator.compare(String(left.identifier ?? "\uffff"), String(right.identifier ?? "\uffff")) ||
    collator.compare(String(left.product ?? ""), String(right.product ?? "")) ||
    collator.compare(String(left.id ?? ""), String(right.id ?? "")) ||
    (String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0)
  );
}

function compareGroupNames(left, right) {
  const leftName = normalize(left);
  const rightName = normalize(right);
  // Natural collation may equate distinct groups such as "Residencial 1" and "Residencial 01".
  return (
    collator.compare(leftName, rightName) ||
    (leftName < rightName ? -1 : leftName > rightName ? 1 : 0)
  );
}

export function buildTabelaoExclusiveInventory(items) {
  const exclusiveByTypology = new Map();

  for (const item of items) {
    const businessUnit = String(item.businessUnit ?? "").trim();
    const project = String(item.project ?? "").trim();
    const plant = String(item.plant ?? "").trim();
    const minimumPrice = calculateTabelaoPrice(item);
    if (
      !String(item.id ?? "").trim() ||
      !businessUnit ||
      !project ||
      !plant ||
      typeof item.privateArea !== "number" ||
      !Number.isFinite(item.privateArea) ||
      item.privateArea <= 0 ||
      minimumPrice == null
    )
      continue;

    // Area is part of the identity: never discard a larger/smaller layout under the same plant name.
    const exclusiveKey = JSON.stringify([
      normalize(businessUnit),
      normalize(project),
      normalize(plant),
      item.privateArea,
    ]);
    const candidate = { ...item, businessUnit, project, plant, minimumPrice, exclusiveKey };
    const current = exclusiveByTypology.get(exclusiveKey);

    if (!current) {
      exclusiveByTypology.set(exclusiveKey, { ...candidate, availableUnits: 1 });
      continue;
    }

    const availableUnits = current.availableUnits + 1;
    const candidateOrder =
      candidate.minimumPrice - current.minimumPrice || compareUnits(candidate, current);
    if (candidateOrder < 0) {
      exclusiveByTypology.set(exclusiveKey, { ...candidate, availableUnits });
    } else {
      current.availableUnits = availableUnits;
    }
  }

  return Array.from(exclusiveByTypology.values());
}

function matchesPriceRange(item, range) {
  if (!range || range === "all") return true;
  const price = validPrice(item);
  if (price == null) return false;
  if (range === "up-to-200") return price <= 200_000;
  if (range === "200-to-300") return price > 200_000 && price <= 300_000;
  if (range === "300-to-400") return price > 300_000 && price <= 400_000;
  if (range === "over-400") return price > 400_000;
  return true;
}

export function matchesTabelaoFilters(item, filters = {}) {
  if (
    filters.businessUnit &&
    filters.businessUnit !== "all" &&
    item.businessUnit !== filters.businessUnit
  )
    return false;
  if (filters.project && filters.project !== "all" && item.project !== filters.project)
    return false;
  if (filters.plant && filters.plant !== "all" && item.plant !== filters.plant) return false;
  if (filters.region && filters.region !== "all" && resolveInvestorRegion(item) !== filters.region)
    return false;
  if (!matchesPriceRange(item, filters.priceRange)) return false;

  const query = normalize(filters.query);
  if (!query) return true;
  const haystack = [
    item.businessUnit,
    item.project,
    item.plant,
    item.neighborhood,
    resolveInvestorRegion(item),
  ]
    .map(normalize)
    .join(" ");
  return haystack.includes(query);
}

export function sortTabelaoInventory(items, order = "price-asc") {
  return [...items].sort((left, right) => {
    const leftPrice = validPrice(left);
    const rightPrice = validPrice(right);
    if (order === "price-desc") {
      if (leftPrice == null || rightPrice == null)
        return Number(leftPrice == null) - Number(rightPrice == null);
      if (leftPrice !== rightPrice) return rightPrice - leftPrice;
    } else if (order === "project") {
      const projectResult =
        compareGroupNames(left.project, right.project) ||
        compareGroupNames(left.businessUnit, right.businessUnit);
      if (projectResult) return projectResult;
      if (leftPrice == null || rightPrice == null)
        return Number(leftPrice == null) - Number(rightPrice == null);
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    } else {
      if (leftPrice == null || rightPrice == null)
        return Number(leftPrice == null) - Number(rightPrice == null);
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    }
    return (
      collator.compare(String(left.project ?? ""), String(right.project ?? "")) ||
      collator.compare(String(left.plant ?? ""), String(right.plant ?? "")) ||
      (left.privateArea ?? 0) - (right.privateArea ?? 0) ||
      collator.compare(String(left.businessUnit ?? ""), String(right.businessUnit ?? "")) ||
      compareUnits(left, right)
    );
  });
}

export function buildTabelaoOptions(items) {
  const unique = (valueFromItem) =>
    Array.from(new Set(items.map(valueFromItem).filter(Boolean))).sort((left, right) =>
      collator.compare(String(left), String(right)),
    );
  return {
    businessUnits: unique((item) => item.businessUnit),
    projects: unique((item) => item.project),
    plants: unique((item) => item.plant),
    regions: unique((item) => resolveInvestorRegion(item)),
  };
}

export function summarizeTabelao(items) {
  const prices = items.map(validPrice).filter((value) => value != null);
  return {
    exclusiveOptions: items.length,
    projects: new Set(
      items.map((item) => JSON.stringify([normalize(item.businessUnit), normalize(item.project)])),
    ).size,
    plants: new Set(items.map((item) => item.plant).filter(Boolean)).size,
    minimumPrice: prices.length ? Math.min(...prices) : null,
    maximumPrice: prices.length ? Math.max(...prices) : null,
  };
}
