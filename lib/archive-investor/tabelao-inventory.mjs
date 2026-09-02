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
    .trim();
}

function validPrice(item) {
  const price = Number(item.finalPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function buildTabelaoExclusiveInventory(items) {
  const exclusiveByProjectAndPlant = new Map();

  for (const item of items) {
    const project = String(item.project ?? "").trim();
    const plant = String(item.plant ?? "").trim();
    if (!project || !plant || validPrice(item) == null) continue;

    const exclusiveKey = `${project}\u001f${plant}`;
    const candidate = { ...item, project, plant, exclusiveKey };
    const current = exclusiveByProjectAndPlant.get(exclusiveKey);

    if (!current) {
      exclusiveByProjectAndPlant.set(exclusiveKey, { ...candidate, availableUnits: 1 });
      continue;
    }

    const availableUnits = current.availableUnits + 1;
    const candidateOrder = validPrice(candidate) - validPrice(current)
      || collator.compare(String(candidate.identifier ?? "\uffff"), String(current.identifier ?? "\uffff"))
      || collator.compare(String(candidate.product ?? "\uffff"), String(current.product ?? "\uffff"))
      || collator.compare(String(candidate.id ?? "\uffff"), String(current.id ?? "\uffff"));
    if (candidateOrder < 0) {
      exclusiveByProjectAndPlant.set(exclusiveKey, { ...candidate, availableUnits });
    } else {
      current.availableUnits = availableUnits;
    }
  }

  return Array.from(exclusiveByProjectAndPlant.values());
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
  if (filters.businessUnit && filters.businessUnit !== "all" && item.businessUnit !== filters.businessUnit) return false;
  if (filters.project && filters.project !== "all" && item.project !== filters.project) return false;
  if (filters.plant && filters.plant !== "all" && item.plant !== filters.plant) return false;
  if (filters.region && filters.region !== "all" && resolveInvestorRegion(item) !== filters.region) return false;
  if (!matchesPriceRange(item, filters.priceRange)) return false;

  const query = normalize(filters.query);
  if (!query) return true;
  const haystack = [
    item.businessUnit,
    item.project,
    item.plant,
    item.neighborhood,
    resolveInvestorRegion(item),
  ].map(normalize).join(" ");
  return haystack.includes(query);
}

export function sortTabelaoInventory(items, order = "price-asc") {
  return [...items].sort((left, right) => {
    const leftPrice = validPrice(left);
    const rightPrice = validPrice(right);
    if (order === "price-desc") {
      if (leftPrice == null || rightPrice == null) return leftPrice == null ? 1 : -1;
      if (leftPrice !== rightPrice) return rightPrice - leftPrice;
    } else if (order === "project") {
      const projectResult = collator.compare(String(left.project ?? ""), String(right.project ?? ""));
      if (projectResult) return projectResult;
    } else {
      if (leftPrice == null || rightPrice == null) return leftPrice == null ? 1 : -1;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    }
    return collator.compare(String(left.project ?? ""), String(right.project ?? ""))
      || collator.compare(String(left.plant ?? ""), String(right.plant ?? ""));
  });
}

export function buildTabelaoOptions(items) {
  const unique = (valueFromItem) => Array.from(new Set(items.map(valueFromItem).filter(Boolean)))
    .sort((left, right) => collator.compare(String(left), String(right)));
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
    projects: new Set(items.map((item) => item.project).filter(Boolean)).size,
    plants: new Set(items.map((item) => item.plant).filter(Boolean)).size,
    minimumPrice: prices.length ? Math.min(...prices) : null,
    maximumPrice: prices.length ? Math.max(...prices) : null,
  };
}
