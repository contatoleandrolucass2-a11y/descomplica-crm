import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildTabelaoExclusiveInventory,
  buildTabelaoFacets,
  enrichTabelaoLocationFields,
  groupTabelaoInventoryByProject,
  matchesTabelaoFacets,
  normalizeTabelaoProgress,
  TABELAO_FILTER_DEFAULTS,
  sortTabelaoInventory,
} from "../../lib/archive-investor/tabelao-inventory.mjs";

async function loadPayload(source) {
  return source.startsWith("https://")
    ? fetch(source, { signal: AbortSignal.timeout(30_000) }).then((response) => {
        assert.equal(response.ok, true, `Source HTTP ${response.status}`);
        return response.json();
      })
    : JSON.parse(await readFile(source, "utf8"));
}

// Pass local, untracked payload paths to audit archived live and address-reference responses.
const source = process.argv[2] ?? "https://descomplicapro.com.br/api/inventory";
const referenceSource = process.argv[3] ?? null;
const payload = await loadPayload(source);
const referencePayload = referenceSource ? await loadPayload(referenceSource) : null;

const rows = payload.items;
assert.equal(rows.length, Number(payload.count));
assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, "Duplicate source IDs");
const sourceById = new Map(rows.map((row) => [row.id, row]));
const detailFields = [
  "cashBackSlack",
  "appraisal",
  "street",
  "streetNumber",
  "neighborhood",
  "progress",
  "classification",
];
const required = [
  "id",
  "businessUnit",
  "project",
  "plant",
  "finalWithKit",
  "unitBonus",
  "tableSlack",
];
const missing = Object.fromEntries(
  required.map((field) => [
    field,
    rows.filter((row) => row[field] == null || row[field] === "").length,
  ]),
);
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

// Independent oracle: group the source directly and recompute from decimal cents, not the production price helper.
const key = (row) => JSON.stringify([...[row.businessUnit, row.project, row.plant].map(normalize)]);
const cents = (value) => Number(value.toFixed(2).replace(".", ""));
const expected = new Map();
const stockUnits = new Map();
let excluded = 0;
for (const row of rows) {
  if (
    ["id", "businessUnit", "project", "plant"].every((field) => String(row[field] ?? "").trim())
  ) {
    if (!stockUnits.has(key(row))) stockUnits.set(key(row), new Set());
    stockUnits.get(key(row)).add(String(row.id).trim());
  }
  const numbers = [row.finalWithKit, row.unitBonus, row.tableSlack];
  if (
    required.some((field) => row[field] == null || String(row[field]).trim() === "") ||
    numbers.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)
  ) {
    excluded += 1;
    continue;
  }
  const price = cents(row.finalWithKit) - cents(row.unitBonus) - cents(row.tableSlack);
  if (price <= 0) {
    excluded += 1;
    continue;
  }
  const group = expected.get(key(row)) ?? [];
  group.push({ id: row.id, price });
  expected.set(key(row), group);
}

const selected = sortTabelaoInventory(buildTabelaoExclusiveInventory(rows));
assert.equal(selected.length, expected.size, "Lost or duplicated typologies");
assert.equal(new Set(selected.map(key)).size, selected.length);
for (const row of selected) {
  const group = expected.get(key(row));
  const sourceRow = sourceById.get(row.id);
  const minimum = Math.min(...group.map((candidate) => candidate.price));
  assert.equal(Math.round(row.minimumPrice * 100), minimum, "Incorrect net minimum");
  assert.equal(
    group.some((candidate) => candidate.id === row.id && candidate.price === minimum),
    true,
  );
  assert.equal(row.availableUnits, stockUnits.get(key(row)).size);
  assert.equal(row.pricedUnits, group.length);
  for (const field of detailFields) {
    assert.deepEqual(
      row[field],
      sourceRow[field],
      `Detail ${field} did not come from winning unit`,
    );
  }
}
assert.equal(
  selected.reduce((sum, row) => sum + row.pricedUnits, 0),
  rows.length - excluded,
);
assert.deepEqual(
  selected,
  sortTabelaoInventory(buildTabelaoExclusiveInventory([...rows].reverse())),
);
const grouped = sortTabelaoInventory(selected, "project");
const seenProjects = new Set();
const projectCollator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
let previousProject = null;
let previousRow = null;
for (const row of grouped) {
  const [business, project] = JSON.parse(key(row));
  const projectKey = JSON.stringify([project, business]);
  if (projectKey !== previousProject) {
    assert.equal(seenProjects.has(projectKey), false, "Project split across the table");
    if (previousProject) {
      const [lastProject, lastBusiness] = JSON.parse(previousProject);
      assert.ok(
        (projectCollator.compare(lastProject, project) ||
          projectCollator.compare(lastBusiness, business)) <= 0,
        "Projects not alphabetically ordered",
      );
    }
    seenProjects.add(projectKey);
  } else {
    assert.ok(previousRow.minimumPrice <= row.minimumPrice, "Prices not ascending inside project");
  }
  previousProject = projectKey;
  previousRow = row;
}
assert.deepEqual(new Set(grouped.map(key)), new Set(selected.map(key)), "Grouping lost options");
const projectGroups = groupTabelaoInventoryByProject(grouped);
assert.equal(projectGroups.length, seenProjects.size);
assert.deepEqual(
  projectGroups.flatMap((group) => group.items),
  grouped,
);
let nextIndex = 0;
for (const group of projectGroups) {
  assert.equal(group.startIndex, nextIndex);
  assert.ok(
    group.items.every((row) => JSON.stringify(JSON.parse(key(row)).slice(0, 2)) === group.key),
  );
  nextIndex += group.items.length;
}
assert.equal(nextIndex, selected.length);
assert.deepEqual(
  grouped,
  sortTabelaoInventory(buildTabelaoExclusiveInventory([...rows].reverse()), "project"),
);

const locationFields = ["street", "streetNumber", "neighborhood"];
const withoutLocation = (row) =>
  Object.fromEntries(Object.entries(row).filter(([field]) => !locationFields.includes(field)));
const locationCandidate = (row) => {
  const candidate = Object.fromEntries(
    locationFields.map((field) => [
      field,
      typeof row[field] === "string" && row[field].trim() ? row[field].trim() : null,
    ]),
  );
  const values = locationFields.map((field) => candidate[field]);
  if (values.every((value) => value === null)) return null;
  return candidate;
};
const uniqueLocation = (candidates) => {
  const unique = new Map();
  for (const row of candidates) {
    const candidate = locationCandidate(row);
    if (!candidate) continue;
    const signature = JSON.stringify(locationFields.map((field) => normalize(candidate[field])));
    if (!unique.has(signature)) unique.set(signature, candidate);
  }
  return unique.size === 1 ? unique.values().next().value : null;
};
const compatibleLocation = (row, candidate, requireComplete) => {
  if (!candidate) return null;
  if (requireComplete && locationFields.some((field) => !candidate[field])) return null;
  if (
    locationFields.some(
      (field) =>
        row[field]?.trim() &&
        (!candidate[field] || normalize(row[field]) !== normalize(candidate[field])),
    )
  ) {
    return null;
  }
  return locationFields.some((field) => !row[field]?.trim() && candidate[field]) ? candidate : null;
};
let addressEnrichment = null;
if (referencePayload) {
  assert.equal(referencePayload.items.length, Number(referencePayload.count));
  assert.equal(
    new Set(referencePayload.items.map((row) => row.id)).size,
    referencePayload.items.length,
    "Duplicate address-reference IDs",
  );
  const displayed = enrichTabelaoLocationFields(selected, referencePayload.items);
  const provenance = { live: 0, exactUnit: 0, uniqueProject: 0, unresolved: 0 };
  assert.equal(displayed.length, selected.length);
  for (let index = 0; index < selected.length; index += 1) {
    const row = selected[index];
    const actual = displayed[index];
    assert.equal(actual.id, row.id, "Address enrichment changed row identity or order");
    assert.deepEqual(
      withoutLocation(actual),
      withoutLocation(row),
      "Address enrichment changed data",
    );
    const sameProject = referencePayload.items.filter(
      (candidate) =>
        normalize(candidate.businessUnit) === normalize(row.businessUnit) &&
        normalize(candidate.project) === normalize(row.project),
    );
    const exactRows = row.identifier
      ? sameProject.filter(
          (candidate) => normalize(candidate.identifier) === normalize(row.identifier),
        )
      : [];
    const exact = compatibleLocation(row, uniqueLocation(exactRows), false);
    const projectCandidate = uniqueLocation(sameProject);
    const project = compatibleLocation(row, projectCandidate, true);
    const locationSource = exact ?? project;
    const expected = Object.fromEntries(
      locationFields.map((field) => [field, row[field]?.trim() || locationSource?.[field] || null]),
    );
    assert.deepEqual(
      Object.fromEntries(locationFields.map((field) => [field, actual[field]])),
      expected,
      "Displayed address has no coherent source",
    );
    const completedFields = locationFields.filter(
      (field) => !row[field]?.trim() && actual[field]?.trim(),
    );
    if (completedFields.length === 0) {
      provenance[locationFields.every((field) => actual[field]?.trim()) ? "live" : "unresolved"] +=
        1;
    } else if (completedFields.every((field) => actual[field] === exact?.[field])) {
      provenance.exactUnit += 1;
    } else {
      assert.equal(
        completedFields.every((field) => actual[field] === project?.[field]),
        true,
        "Project fallback is not a unique coherent address",
      );
      provenance.uniqueProject += 1;
    }
  }
  addressEnrichment = {
    referenceSource,
    referenceRows: referencePayload.items.length,
    displayedRows: displayed.length,
    provenance,
    liveRowsAndOrderPreserved: true,
    nonLocationFieldsPreserved: true,
    coherentAddressRequired: true,
  };
}

let filterCombinationsChecked = 0;
for (const [dimension, facet] of Object.entries(
  buildTabelaoFacets(selected, TABELAO_FILTER_DEFAULTS),
)) {
  assert.equal(facet.total, selected.length);
  assert.equal(
    facet.options.reduce((total, option) => total + option.count, 0),
    selected.length,
  );
  for (const option of facet.options) {
    const filters = { ...TABELAO_FILTER_DEFAULTS, [dimension]: option.value };
    const matching = selected.filter((row) => matchesTabelaoFacets(row, filters));
    assert.equal(matching.length, option.count);
    for (const row of matching) {
      if (dimension === "price")
        assert.equal(
          String(cents(row.finalWithKit) - cents(row.unitBonus) - cents(row.tableSlack)),
          option.value,
        );
      else if (dimension !== "region") assert.equal(normalize(row[dimension]), option.value);
    }
    const prices = buildTabelaoFacets(selected, filters).price;
    if (dimension !== "price") assert.equal(prices.total, matching.length);
    for (const price of prices.options) {
      const combined = { ...filters, price: price.value };
      const actual = selected.filter((row) => matchesTabelaoFacets(row, combined));
      const expectedPriceRows = (dimension === "price" ? selected : matching).filter(
        (row) =>
          String(cents(row.finalWithKit) - cents(row.unitBonus) - cents(row.tableSlack)) ===
          price.value,
      );
      assert.deepEqual(
        actual.map((row) => row.id),
        expectedPriceRows.map((row) => row.id),
      );
      assert.equal(actual.length, price.count);
      filterCombinationsChecked += 1;
    }
  }
}
assert.deepEqual(
  selected.filter((row) => matchesTabelaoFacets(row, TABELAO_FILTER_DEFAULTS)),
  selected,
);
console.log(
  JSON.stringify(
    {
      source,
      sourceLabel: payload.source,
      sourceGeneratedAt: payload.generatedAt ?? null,
      auditedAt: new Date().toISOString(),
      sourceRows: rows.length,
      uniqueIds: new Set(rows.map((row) => row.id)).size,
      missing,
      selectedDetailPresence: Object.fromEntries(
        detailFields.map((field) => [
          field,
          selected.filter(
            (row) =>
              row[field] != null &&
              (typeof row[field] !== "string" || row[field].trim().length > 0),
          ).length,
        ]),
      ),
      selectedDisplayedDetailPresence: Object.fromEntries(
        detailFields.map((field) => [
          field,
          selected.filter((row) => {
            if (field === "classification") {
              return (
                typeof row[field] === "string" &&
                row[field].trim().length > 0 &&
                row[field].trim() !== "0"
              );
            }
            if (field === "progress") return normalizeTabelaoProgress(row[field]) !== null;
            return (
              row[field] != null && (typeof row[field] !== "string" || row[field].trim().length > 0)
            );
          }).length,
        ]),
      ),
      excluded,
      exclusiveOptions: selected.length,
      projects: new Set(selected.map((row) => JSON.stringify([row.businessUnit, row.project])))
        .size,
      minimumPrice: selected[0]?.minimumPrice ?? null,
      maximumPrice: selected.at(-1)?.minimumPrice ?? null,
      allGroupsChecked: true,
      allQuantitiesChecked: true,
      availableUnitsInDisplayedGroups: selected.reduce((sum, row) => sum + row.availableUnits, 0),
      allRowSpansChecked: true,
      allMinimaChecked: true,
      allDetailsFromWinningUnit: true,
      addressEnrichment,
      sourceOrderIndependent: true,
      allProjectsContiguous: true,
      ascendingPricesWithinProjects: true,
      filterCombinationsChecked,
      filterCountsReconciled: true,
    },
    null,
    2,
  ),
);
