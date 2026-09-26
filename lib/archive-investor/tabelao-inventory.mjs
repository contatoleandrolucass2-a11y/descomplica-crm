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

const TABELAO_LOCATION_FIELDS = ["street", "streetNumber", "neighborhood"];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function referenceKey(item, includeIdentifier) {
  const parts = [item.businessUnit, item.project];
  if (includeIdentifier) parts.push(item.identifier);
  if (parts.some((value) => !hasText(value))) return null;
  return JSON.stringify(parts.map(normalize));
}

function locationCandidate(item) {
  const candidate = Object.fromEntries(
    TABELAO_LOCATION_FIELDS.map((field) => [
      field,
      hasText(item[field]) ? item[field].trim() : null,
    ]),
  );
  const values = TABELAO_LOCATION_FIELDS.map((field) => candidate[field]);
  if (values.every((value) => value === null)) return null;
  return candidate;
}

function uniqueLocationReferences(reference, includeIdentifier) {
  const candidatesByKey = new Map();
  for (const item of reference) {
    const key = referenceKey(item, includeIdentifier);
    const candidate = locationCandidate(item);
    if (!key || !candidate) continue;
    if (!candidatesByKey.has(key)) candidatesByKey.set(key, new Map());
    const signature = JSON.stringify(
      TABELAO_LOCATION_FIELDS.map((field) => normalize(candidate[field])),
    );
    if (!candidatesByKey.get(key).has(signature)) {
      candidatesByKey.get(key).set(signature, candidate);
    }
  }

  return new Map(
    Array.from(candidatesByKey, ([key, candidates]) => [
      key,
      candidates.size === 1 ? candidates.values().next().value : null,
    ]),
  );
}

function compatibleLocationSource(item, candidate, requireComplete) {
  if (!candidate) return null;
  if (requireComplete && TABELAO_LOCATION_FIELDS.some((field) => !hasText(candidate[field]))) {
    return null;
  }
  if (
    TABELAO_LOCATION_FIELDS.some(
      (field) =>
        hasText(item[field]) &&
        (!hasText(candidate[field]) || normalize(item[field]) !== normalize(candidate[field])),
    )
  ) {
    return null;
  }
  return TABELAO_LOCATION_FIELDS.some((field) => !hasText(item[field]) && hasText(candidate[field]))
    ? candidate
    : null;
}

export function enrichTabelaoLocationFields(items, reference) {
  const referenceByUnit = uniqueLocationReferences(reference, true);
  const referenceByProject = uniqueLocationReferences(reference, false);

  return items.map((item) => {
    const unitSource = compatibleLocationSource(
      item,
      referenceByUnit.get(referenceKey(item, true)),
      false,
    );
    const projectCandidate = referenceByProject.get(referenceKey(item, false));
    // Project fallback is safe only when every address candidate is the same complete triplet.
    const projectSource = compatibleLocationSource(item, projectCandidate, true);
    // Never assemble one displayed address from multiple reference records.
    const locationSource = unitSource ?? projectSource;
    return {
      ...item,
      ...Object.fromEntries(
        TABELAO_LOCATION_FIELDS.map((field) => [
          field,
          hasText(item[field])
            ? item[field]
            : hasText(locationSource?.[field])
              ? locationSource[field]
              : null,
        ]),
      ),
    };
  });
}

export function normalizeTabelaoProgress(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
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
  const unitIdsByTypology = new Map();

  for (const item of items) {
    const businessUnit = String(item.businessUnit ?? "").trim();
    const project = String(item.project ?? "").trim();
    const plant = String(item.plant ?? "").trim();
    const unitId = String(item.id ?? "").trim();
    if (!unitId || !businessUnit || !project || !plant) continue;

    // Exclusivity follows the source plant label; area belongs to the winning unit, not the group.
    const exclusiveKey = JSON.stringify([
      normalize(businessUnit),
      normalize(project),
      normalize(plant),
    ]);
    // Stock quantity is independent of price eligibility and counts each source unit once.
    if (!unitIdsByTypology.has(exclusiveKey)) unitIdsByTypology.set(exclusiveKey, new Set());
    unitIdsByTypology.get(exclusiveKey).add(unitId);
    const minimumPrice = calculateTabelaoPrice(item);
    if (minimumPrice == null) continue;
    const candidate = { ...item, businessUnit, project, plant, minimumPrice, exclusiveKey };
    const current = exclusiveByTypology.get(exclusiveKey);

    if (!current) {
      exclusiveByTypology.set(exclusiveKey, { ...candidate, pricedUnits: 1 });
      continue;
    }

    const pricedUnits = current.pricedUnits + 1;
    const candidateOrder =
      candidate.minimumPrice - current.minimumPrice || compareUnits(candidate, current);
    if (candidateOrder < 0) {
      exclusiveByTypology.set(exclusiveKey, { ...candidate, pricedUnits });
    } else {
      current.pricedUnits = pricedUnits;
    }
  }

  return Array.from(exclusiveByTypology.values(), (item) => ({
    ...item,
    availableUnits: unitIdsByTypology.get(item.exclusiveKey).size,
  }));
}

export function groupTabelaoInventoryByProject(items) {
  const projects = new Map();
  for (const item of items) {
    const key = JSON.stringify([normalize(item.businessUnit), normalize(item.project)]);
    if (!projects.has(key)) {
      projects.set(key, {
        key,
        businessUnit: item.businessUnit,
        project: item.project,
        items: [],
      });
    }
    projects.get(key).items.push(item);
  }
  let startIndex = 0;
  return Array.from(projects.values(), (group) => {
    const result = { ...group, startIndex };
    startIndex += group.items.length;
    return result;
  });
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
    } else if (order === "project" || order === "project-desc") {
      const projectResult =
        compareGroupNames(left.project, right.project) ||
        compareGroupNames(left.businessUnit, right.businessUnit);
      if (projectResult) return projectResult;
      if (leftPrice == null || rightPrice == null)
        return Number(leftPrice == null) - Number(rightPrice == null);
      if (leftPrice !== rightPrice)
        return order === "project-desc" ? rightPrice - leftPrice : leftPrice - rightPrice;
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

export const TABELAO_FILTER_DEFAULTS = Object.freeze({
  businessUnit: "",
  project: "",
  region: "",
  plant: "",
  price: "",
});

function facetValue(item, dimension) {
  if (dimension === "price") {
    const price = calculateTabelaoPrice(item);
    return price == null ? "" : String(Math.round(price * 100));
  }
  return normalize(dimension === "region" ? resolveInvestorRegion(item) : item[dimension]);
}

export function matchesTabelaoFacets(item, filters, ignoredDimension = null) {
  return Object.keys(TABELAO_FILTER_DEFAULTS).every(
    (dimension) =>
      dimension === ignoredDimension ||
      !filters[dimension] ||
      facetValue(item, dimension) === filters[dimension],
  );
}

export function buildTabelaoFacets(items, filters) {
  return Object.fromEntries(
    Object.keys(TABELAO_FILTER_DEFAULTS).map((dimension) => {
      const compatible = items.filter((item) => matchesTabelaoFacets(item, filters, dimension));
      const options = new Map();
      for (const item of compatible) {
        const value = facetValue(item, dimension);
        if (!value) continue;
        const existing = options.get(value);
        if (existing) existing.count += 1;
        else
          options.set(value, {
            value,
            label:
              dimension === "price"
                ? value
                : String(
                    dimension === "region" ? resolveInvestorRegion(item) : item[dimension],
                  ).trim(),
            count: 1,
          });
      }
      return [
        dimension,
        {
          total: compatible.length,
          options: [...options.values()].sort((left, right) =>
            dimension === "price"
              ? Number(left.value) - Number(right.value)
              : collator.compare(left.label, right.label),
          ),
        },
      ];
    }),
  );
}
