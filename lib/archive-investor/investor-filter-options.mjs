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
const FILTER_DIMENSIONS = Object.keys(ALL_VALUES);

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

function sortedTextOptions(counts) {
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
  const counts = Object.fromEntries(FILTER_DIMENSIONS.map((dimension) => [dimension, new Map()]));
  const totals = Object.fromEntries(FILTER_DIMENSIONS.map((dimension) => [dimension, 0]));
  const selected = Object.fromEntries(
    FILTER_DIMENSIONS.map((dimension) => [dimension, filterValue(filters, dimension)]),
  );
  const activeTextDimensions = FILTER_DIMENSIONS.filter(
    (dimension) => dimension !== "region" && selected[dimension] !== ALL_VALUES[dimension],
  );

  for (const item of inventory) {
    const values = {
      businessUnit: item.businessUnit,
      project: item.project,
      plant: item.plant,
      region: null,
      salePrice: salePriceValue(item),
    };
    let mismatch = null;
    let mismatchCount = 0;
    for (const dimension of activeTextDimensions) {
      if (values[dimension] !== selected[dimension]) {
        mismatch = dimension;
        mismatchCount += 1;
        if (mismatchCount > 1) break;
      }
    }
    if (mismatchCount > 1) continue;

    // Location normalization is expensive; only resolve it for contributing rows.
    if (selected.region !== ALL_VALUES.region) {
      values.region = resolveInvestorRegion(item);
      if (values.region !== selected.region) {
        mismatch = "region";
        mismatchCount += 1;
      }
      if (mismatchCount > 1) continue;
    } else if (mismatchCount === 0) {
      values.region = resolveInvestorRegion(item);
    }

    // Each facet ignores its own selection, preserving the chained counts.
    for (const dimension of FILTER_DIMENSIONS) {
      if (mismatchCount === 1 && mismatch !== dimension) continue;
      totals[dimension] += 1;
      const value = values[dimension];
      if (typeof value !== "string" || value === "") continue;
      const dimensionCounts = counts[dimension];
      dimensionCounts.set(value, (dimensionCounts.get(value) ?? 0) + 1);
    }
  }

  const regions = INVESTOR_REGIONS.map((region) => ({
    value: region,
    count: counts.region.get(region) ?? 0,
  })).filter((item) => item.count > 0);

  return {
    businessUnits: sortedTextOptions(counts.businessUnit),
    projects: sortedTextOptions(counts.project),
    plants: sortedTextOptions(counts.plant),
    regions,
    salePrices: Array.from(counts.salePrice, ([value, count]) => ({ value, count })).sort(
      (left, right) => Number(left.value) - Number(right.value),
    ),
    totals,
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
