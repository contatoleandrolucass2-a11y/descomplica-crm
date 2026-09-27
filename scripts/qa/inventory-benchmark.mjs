import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

import { buildInvestorFilterOptions } from "../../lib/archive-investor/investor-filter-options.mjs";
import { resolveInvestorRegion } from "../../lib/archive-investor/investor-region.mjs";

const [snapshotPath, baselineRoot] = process.argv.slice(2);
if (!snapshotPath || !baselineRoot || process.argv.length !== 4) {
  throw new Error(
    "Usage: node scripts/qa/inventory-benchmark.mjs <private-snapshot> <baseline-checkout>",
  );
}
const { items } = JSON.parse(await readFile(snapshotPath, "utf8"));
assert.ok(Array.isArray(items) && items.length > 0, "Inventory must contain items.");
const baseline = await import(
  pathToFileURL(path.join(baselineRoot, "lib/archive-investor/investor-filter-options.mjs"))
);
const filters = {
  businessUnit: "Todas",
  project: "Todos",
  plant: "Todos",
  region: "Todas",
  salePrice: "Todos",
};
const cases = [
  { name: "all", filters },
  { name: "region", filters: { ...filters, region: resolveInvestorRegion(items[0]) } },
  { name: "project", filters: { ...filters, project: items[0].project } },
];

function measure(build, selected) {
  for (let i = 0; i < 20; i += 1) build(items, selected);
  const samples = [];
  for (let i = 0; i < 100; i += 1) {
    const start = performance.now();
    build(items, selected);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return { medianMs: Number(samples[50].toFixed(3)), p95Ms: Number(samples[95].toFixed(3)) };
}

const results = cases.map(({ name, filters: selected }) => {
  assert.deepEqual(
    buildInvestorFilterOptions(items, selected),
    baseline.buildInvestorFilterOptions(items, selected),
  );
  return {
    name,
    baseline: measure(baseline.buildInvestorFilterOptions, selected),
    optimized: measure(buildInvestorFilterOptions, selected),
  };
});
// Only aggregate timings leave this process, never stock contents or identifiers.
process.stdout.write(
  `${JSON.stringify({ itemCount: items.length, samplesPerCase: 100, equivalent: true, results }, null, 2)}\n`,
);
