import { INVESTOR_REGIONS, resolveInvestorRegion } from "./investor-region.mjs";

const ALL_VALUES = {
  businessUnit: "Todas",
  project: "Todos",
  plant: "Todos",
  region: "Todas",
  salePrice: "Todos",
};

const collator = new Intl.Collator("pt-BR");
const identifierCollator = new Intl.Collator("pt-BR", { numeric: true });
const RECONCILIATION_ORDER = ["project", "plant", "region", "salePrice", "businessUnit"];

function normalizedInventoryText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function isInvestorEligibleUnit(item) {
  const unitType = normalizedInventoryText(item?.unitType);
  const product = normalizedInventoryText(item?.product);
  return unitType !== "vaga de garagem" && !product.startsWith("vaga de garagem");
}

function filterValue(filters, dimension) {
  return filters[dimension] ?? ALL_VALUES[dimension];
}

function salePriceValue(item) {
  const value = Number(item.finalPrice);
  return Number.isFinite(value) && value > 0 ? String(value) : null;
}

function countTextOptions(items, valueFromItem) {
  const counts = new Map();
  for (const item of items) {
    const value = valueFromItem(item);
    if (typeof value !== "string" || value === "") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) =>
    collator.compare(left.value, right.value),
  );
}

export function matchesInvestorFilters(item, filters, ignoredDimension = null) {
  if (
    ignoredDimension !== "businessUnit" &&
    filterValue(filters, "businessUnit") !== ALL_VALUES.businessUnit &&
    item.businessUnit !== filterValue(filters, "businessUnit")
  )
    return false;
  if (
    ignoredDimension !== "project" &&
    filterValue(filters, "project") !== ALL_VALUES.project &&
    item.project !== filterValue(filters, "project")
  )
    return false;
  if (
    ignoredDimension !== "plant" &&
    filterValue(filters, "plant") !== ALL_VALUES.plant &&
    item.plant !== filterValue(filters, "plant")
  )
    return false;
  if (
    ignoredDimension !== "region" &&
    filterValue(filters, "region") !== ALL_VALUES.region &&
    resolveInvestorRegion(item) !== filterValue(filters, "region")
  )
    return false;
  if (
    ignoredDimension !== "salePrice" &&
    filterValue(filters, "salePrice") !== ALL_VALUES.salePrice &&
    salePriceValue(item) !== filterValue(filters, "salePrice")
  )
    return false;
  return true;
}

export function buildInvestorFilterOptions(inventory, filters) {
  const compatible = (dimension) =>
    inventory.filter((item) => matchesInvestorFilters(item, filters, dimension));
  const businessUnitItems = compatible("businessUnit");
  const projectItems = compatible("project");
  const plantItems = compatible("plant");
  const regionItems = compatible("region");
  const salePriceItems = compatible("salePrice");
  const regionCountMap = new Map(INVESTOR_REGIONS.map((region) => [region, 0]));

  for (const item of regionItems) {
    const region = resolveInvestorRegion(item);
    regionCountMap.set(region, (regionCountMap.get(region) ?? 0) + 1);
  }

  const salePriceCountMap = new Map();
  for (const item of salePriceItems) {
    const value = salePriceValue(item);
    if (!value) continue;
    salePriceCountMap.set(value, (salePriceCountMap.get(value) ?? 0) + 1);
  }

  const regions = INVESTOR_REGIONS.map((region) => ({
    value: region,
    count: regionCountMap.get(region) ?? 0,
  })).filter((item) => item.count > 0);

  return {
    businessUnits: countTextOptions(businessUnitItems, (item) => item.businessUnit),
    projects: countTextOptions(projectItems, (item) => item.project),
    plants: countTextOptions(plantItems, (item) => item.plant),
    regions,
    salePrices: Array.from(salePriceCountMap, ([value, count]) => ({ value, count })).sort(
      (left, right) => Number(left.value) - Number(right.value),
    ),
    totals: {
      businessUnit: businessUnitItems.length,
      project: projectItems.length,
      plant: plantItems.length,
      region: regionItems.length,
      salePrice: salePriceItems.length,
    },
  };
}

function itemValue(item, dimension) {
  if (dimension === "region") return resolveInvestorRegion(item);
  if (dimension === "salePrice") return salePriceValue(item);
  return item[dimension];
}

export function reconcileInvestorFilters(inventory, filters) {
  for (const dimension of RECONCILIATION_ORDER) {
    if (filterValue(filters, dimension) === ALL_VALUES[dimension]) continue;
    if (!inventory.some((item) => itemValue(item, dimension) === filterValue(filters, dimension))) {
      return { ...filters, [dimension]: ALL_VALUES[dimension] };
    }
  }

  if (inventory.some((item) => matchesInvestorFilters(item, filters))) return filters;

  const incompatibleDimension = RECONCILIATION_ORDER.find(
    (dimension) => filterValue(filters, dimension) !== ALL_VALUES[dimension],
  );
  return incompatibleDimension
    ? { ...filters, [incompatibleDimension]: ALL_VALUES[incompatibleDimension] }
    : filters;
}

export function sortInvestorInventoryBySalePrice(items, direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...items].sort((left, right) => {
    const leftPrice = Number(left.finalPrice);
    const rightPrice = Number(right.finalPrice);
    const leftValid = Number.isFinite(leftPrice) && leftPrice > 0;
    const rightValid = Number.isFinite(rightPrice) && rightPrice > 0;
    if (leftValid !== rightValid) return leftValid ? -1 : 1;
    if (leftValid && rightValid && leftPrice !== rightPrice)
      return (leftPrice - rightPrice) * multiplier;

    return (
      collator.compare(String(left.project ?? ""), String(right.project ?? "")) ||
      identifierCollator.compare(String(left.identifier ?? ""), String(right.identifier ?? "")) ||
      identifierCollator.compare(String(left.id ?? ""), String(right.id ?? ""))
    );
  });
}
