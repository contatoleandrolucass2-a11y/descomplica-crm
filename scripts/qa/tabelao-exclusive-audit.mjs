import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildTabelaoExclusiveInventory,
  buildTabelaoFacets,
  matchesTabelaoFacets,
  TABELAO_FILTER_DEFAULTS,
  sortTabelaoInventory,
} from "../../lib/archive-investor/tabelao-inventory.mjs";

// Pass a local, untracked payload path to audit an archived response without consulting the live source.
const source = process.argv[2] ?? "https://descomplicapro.com.br/api/inventory";
const payload = source.startsWith("https://")
  ? await fetch(source, { signal: AbortSignal.timeout(30_000) }).then((response) => {
      assert.equal(response.ok, true, `Source HTTP ${response.status}`);
      return response.json();
    })
  : JSON.parse(await readFile(source, "utf8"));

const rows = payload.items;
assert.equal(rows.length, Number(payload.count));
assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, "Duplicate source IDs");
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

// Independent oracle: group the source directly and recompute from decimal cents, not the production price helper.
const key = (row) =>
  JSON.stringify([
    ...[row.businessUnit, row.project, row.plant].map((value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "),
    ),
  ]);
const cents = (value) => Number(value.toFixed(2).replace(".", ""));
const expected = new Map();
let excluded = 0;
for (const row of rows) {
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
  const minimum = Math.min(...group.map((candidate) => candidate.price));
  assert.equal(Math.round(row.minimumPrice * 100), minimum, "Incorrect net minimum");
  assert.equal(
    group.some((candidate) => candidate.id === row.id && candidate.price === minimum),
    true,
  );
  assert.equal(row.availableUnits, group.length);
}
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
assert.deepEqual(
  grouped,
  sortTabelaoInventory(buildTabelaoExclusiveInventory([...rows].reverse()), "project"),
);
const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
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
      excluded,
      exclusiveOptions: selected.length,
      projects: new Set(selected.map((row) => JSON.stringify([row.businessUnit, row.project])))
        .size,
      minimumPrice: selected[0]?.minimumPrice ?? null,
      maximumPrice: selected.at(-1)?.minimumPrice ?? null,
      allGroupsChecked: true,
      allMinimaChecked: true,
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
