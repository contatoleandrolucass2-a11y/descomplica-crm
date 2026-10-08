import assert from "node:assert/strict";
import { test } from "node:test";
import fs, { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

import {
  collectReport,
  exportCandidate,
  publishCandidatePayload,
  REPORTS,
} from "./export-candidate.mjs";
import { buildSalesforceSnapshot } from "./transform.mjs";

const REFERENCE = "2026-10-08";
const json = (value) => new Response(JSON.stringify(value));
const definitionFor = (key) => REPORTS.find((report) => report.key === key);
const DATE_COLUMNS = {
  opportunities: "Opportunity.CreatedDate",
  appointments: "Activity.CreatedDate",
  visits: "Activity.Data_de_comparecimento__c",
  folders: "Avaliacao_credito__c.CreatedDate",
  sales: "Opportunity.DataVenda__c",
};
const ID_COLUMNS = {
  opportunities: ["Opportunity.Name", "006"],
  sales: ["Opportunity.Name", "006"],
  folders: ["Avaliacao_credito__c.Name", "a1V"],
  brokers: ["Contact.Name", "003"],
  imobAccounts: ["Account.Name", "001"],
};

function metadataFor(definition) {
  return {
    id: definition.id,
    reportFormat: "TABULAR",
    aggregates: ["RowCount"],
    detailColumns: definition.requiredColumns.map((column) =>
      Array.isArray(column) ? column[0] : column,
    ),
    standardDateFilter: {
      column: DATE_COLUMNS[definition.key] ?? "CreatedDate",
      durationValue: "THIS_YEAR",
      startDate: null,
      endDate: null,
    },
  };
}

function detailRow(definition, metadata, number = 1, date = REFERENCE) {
  return {
    dataCells: metadata.detailColumns.map((column) => {
      if (column === DATE_COLUMNS[definition.key]) return { value: date, label: date };
      if (column === ID_COLUMNS[definition.key]?.[0])
        return {
          value: "Synthetic",
          label: "Synthetic",
          recordId: `${ID_COLUMNS[definition.key][1]}${String(number).padStart(12, "0")}AAA`,
        };
      if (column === "Activity.Codigo_do_agendamento__c")
        return { value: `AG-${number}`, label: `AG-${number}` };
      if (column === "Opportunity.Valor_Real_de_Venda__c")
        return { value: 100_000, label: "100.000,00" };
      if (column === "Contact.Status_Corretor__c") return { value: "Ativo", label: "Ativo" };
      if (column === "Avaliacao_credito__c.Status__c")
        return { value: "An\u00e1lise aprovada", label: "An\u00e1lise aprovada" };
      return { value: "Synthetic", label: "Synthetic" };
    }),
  };
}

function complete(definition, metadata, numbers = [1]) {
  return {
    attributes: { status: "Success" },
    allData: true,
    hasDetailRows: true,
    reportMetadata: metadata,
    factMap: {
      "T!T": {
        aggregates: [{ value: numbers.length }],
        rows: numbers.map((n) => detailRow(definition, metadata, n)),
      },
    },
  };
}

function client({ describeFor, resultFor, startFor } = {}) {
  const calls = [];
  const instances = new Map();
  let time = 0;
  const options = {
    now: () => time,
    sleep: async (ms) => {
      time += ms;
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body });
      const definition = REPORTS.find((report) => url.includes(`/${report.id}/`));
      assert.ok(definition, "only the seven unchanged report IDs may be requested");
      if (url.endsWith("/describe")) {
        const described = metadataFor(definition);
        return json({ reportMetadata: describeFor?.(described, definition) ?? described });
      }
      if (init.method === "POST") {
        const requested = JSON.parse(init.body).reportMetadata;
        assert.ok(url.endsWith("/instances?includeDetails=true"));
        assert.equal(requested.hasDetailRows, true);
        assert.equal(requested.hasRecordCount, true);
        const id = `0LG${String(instances.size + 1).padStart(12, "0")}AAA`;
        instances.set(id, { requested, polls: 0 });
        return json(startFor?.({ id, status: "New" }) ?? { id, status: "New" });
      }
      const instance = instances.get(new URL(url).pathname.split("/").at(-1));
      assert.ok(instance);
      instance.polls += 1;
      return json(
        resultFor?.(definition, instance.requested, instance.polls) ??
          complete(definition, instance.requested),
      );
    },
  };
  return { options, calls };
}

function collect(key, fixture, start = REFERENCE, end = REFERENCE) {
  return collectReport("synthetic-sid", definitionFor(key), start, end, fixture.options);
}

test("collects all seven reports preserving projection, IDs and transform business semantics", async () => {
  const fixture = client();
  const reports = {};
  for (const definition of REPORTS)
    reports[definition.key] = await collect(definition.key, fixture);
  assert.deepEqual(
    Object.values(reports).map((rows) => rows.length),
    [1, 1, 1, 1, 1, 1, 1],
  );
  assert.equal(reports.sales[0].amount, 100_000);
  assert.equal(reports.opportunities[0].recordId, "006000000000001AAA");
  assert.equal(reports.folders[0].recordId, "a1V000000000001AAA");
  const candidate = buildSalesforceSnapshot({
    reports,
    referenceDate: REFERENCE,
    generatedAt: `${REFERENCE}T15:00:00Z`,
    requestId: "00000000-0000-4000-8000-000000000001",
  });
  assert.deepEqual(
    candidate.diagnostics.sourceRows,
    Object.fromEntries(REPORTS.map(({ key }) => [key, 1])),
  );
  assert.equal(candidate.payload.dashboard.metrics.length, 15);
  assert.equal(candidate.payload.ranking.participants.length, 4);
  assert.equal(candidate.payload.dashboard.views[0].salesValueToday, 100_000);
  assert.equal(candidate.diagnostics.dataQuality.approvedFolders, 1);
  assert.equal(candidate.payload.dashboard.goalsAvailable, false);
  assert.equal(candidate.payload.ranking.rouletteAvailable, false);
  assert.doesNotMatch(JSON.stringify(candidate.payload), /003000000000001AAA/);
});

test("splits truncated date ranges without overlap, describes once and reconciles parent count", async () => {
  const ranges = [];
  const fixture = client({
    resultFor: (definition, metadata) => {
      const filter = metadata.standardDateFilter;
      ranges.push([filter.startDate, filter.endDate]);
      const result = complete(definition, metadata);
      if (filter.startDate !== filter.endDate) {
        result.allData = false;
        result.factMap["T!T"].aggregates[0].value = 2;
      } else {
        result.factMap["T!T"].rows = [
          detailRow(
            definition,
            metadata,
            filter.startDate.endsWith("07") ? 1 : 2,
            filter.startDate,
          ),
        ];
      }
      return result;
    },
  });
  const rows = await collect("opportunities", fixture, "2026-10-07", REFERENCE);
  assert.equal(rows.length, 2);
  assert.deepEqual(ranges, [
    ["2026-10-07", REFERENCE],
    ["2026-10-07", "2026-10-07"],
    [REFERENCE, REFERENCE],
  ]);
  assert.equal(fixture.calls.filter(({ url }) => url.endsWith("/describe")).length, 1);
});

test("fails closed for undated and one-day truncation and exceeded tabular limit", async () => {
  for (const key of ["brokers", "imobAccounts", "opportunities"]) {
    for (const flag of ["allData", "hasExceededTabularRowLimit"]) {
      const fixture = client({
        resultFor: (definition, metadata) => {
          const result = complete(definition, metadata);
          result[flag] = flag !== "allData";
          return result;
        },
      });
      await assert.rejects(collect(key, fixture), { code: "SALESFORCE_INCOMPLETE_REPORT" });
    }
  }
});

test("waits for explicit success and never accepts a running/error factMap", async () => {
  const fixture = client({
    resultFor: (definition, metadata, polls) => {
      const result = complete(definition, metadata);
      result.attributes.status = polls === 1 ? "New" : polls === 2 ? "Running" : "Success";
      return result;
    },
  });
  assert.equal((await collect("brokers", fixture)).length, 1);
  assert.equal(fixture.calls.length, 5);
  for (const status of ["Error", "Unknown", null]) {
    const failing = client({
      resultFor: (definition, metadata) => ({
        ...complete(definition, metadata),
        attributes: { status },
      }),
    });
    await assert.rejects(collect("brokers", failing), {
      code: status === "Error" ? "SALESFORCE_REPORT_ERROR" : "SALESFORCE_INVALID_REPORT",
    });
  }
});

test("polling deadline bounds repeatedly running instances", async () => {
  const fixture = client({ resultFor: () => ({ attributes: { status: "Running" }, factMap: {} }) });
  fixture.options.reportTimeoutMs = 3_000;
  await assert.rejects(collect("brokers", fixture), { code: "SALESFORCE_TIMEOUT" });
  assert.equal(fixture.calls.length, 3);
});

test("collects summary/matrix detail facts and validates grand total before dedupe", async () => {
  for (const format of ["SUMMARY", "MATRIX"]) {
    const fixture = client({
      describeFor: (metadata) => ({ ...metadata, reportFormat: format }),
      resultFor: (definition, metadata) => {
        const result = complete(definition, metadata, [1, 2]);
        const rows = result.factMap["T!T"].rows;
        delete result.factMap["T!T"].rows;
        result.factMap[format === "SUMMARY" ? "0!T" : "0!0"] = { rows: [rows[0]] };
        result.factMap[format === "SUMMARY" ? "1!T" : "1!0"] = { rows: [rows[1]] };
        return result;
      },
    });
    assert.equal((await collect("brokers", fixture)).length, 2);
  }
});

test("only a complete explicit zero-count result becomes an empty dataset", async () => {
  const fixture = client({
    resultFor: (definition, metadata) => complete(definition, metadata, []),
  });
  assert.deepEqual(await collect("opportunities", fixture), []);
});

test("rejects malformed shapes, missing columns/details, wrong identity and contradictory counts", async () => {
  const mutations = [
    (r) => {
      delete r.allData;
    },
    (r) => {
      r.allData = "true";
    },
    (r) => {
      r.hasDetailRows = false;
    },
    (r) => {
      delete r.hasDetailRows;
    },
    (r) => {
      r.factMap = {};
    },
    (r) => {
      r.factMap = [];
    },
    (r) => {
      r.factMap["T!T"].rows = null;
    },
    (r) => {
      delete r.factMap["T!T"].rows;
    },
    (r) => {
      r.factMap["T!T"].aggregates[0].value = 2;
    },
    (r) => {
      r.factMap["T!T"].rows[0].dataCells.pop();
    },
    (r) => {
      r.factMap["T!T"].rows[0].dataCells[0] = {};
    },
    (r) => {
      delete r.factMap["T!T"].rows[0].dataCells[0].recordId;
    },
    (r) => {
      r.reportMetadata.id = "WRONG";
    },
    (r) => {
      r.reportMetadata.detailColumns = [];
    },
    (r) => {
      r.reportMetadata.detailColumns.push(r.reportMetadata.detailColumns[0]);
    },
    (r) => {
      r.reportMetadata.reportFormat = "MULTI_BLOCK";
    },
    (r) => {
      r.status = "Error";
    },
    (r) => {
      r.factMap["0!T"] = { rows: r.factMap["T!T"].rows };
    },
  ];
  for (const mutate of mutations) {
    const fixture = client({
      resultFor: (definition, metadata) => {
        const result = complete(definition, metadata);
        mutate(result);
        return result;
      },
    });
    await assert.rejects(collect("brokers", fixture), { code: "SALESFORCE_INVALID_REPORT" });
  }
});

test("rejects invalid dates, numeric amounts, missing activity identity and conflicting duplicates", async () => {
  for (const [key, column, cell] of [
    ["opportunities", "Opportunity.CreatedDate", { value: "2026-02-30", label: "30/02/2026" }],
    ["opportunities", "Opportunity.CreatedDate", { value: null, label: "" }],
    ["sales", "Opportunity.Valor_Real_de_Venda__c", { value: null, label: "" }],
    ["sales", "Opportunity.Valor_Real_de_Venda__c", { value: "not-a-number", label: "private" }],
    ["sales", "Opportunity.Valor_Real_de_Venda__c", { value: -1, label: "-1" }],
    ["appointments", "Activity.Codigo_do_agendamento__c", { value: "", label: "" }],
  ]) {
    const fixture = client({
      resultFor: (definition, metadata) => {
        const result = complete(definition, metadata);
        result.factMap["T!T"].rows[0].dataCells[metadata.detailColumns.indexOf(column)] = cell;
        return result;
      },
    });
    await assert.rejects(collect(key, fixture), { code: "SALESFORCE_INVALID_REPORT" });
  }
  for (const key of REPORTS.map(({ key }) => key)) {
    const fixture = client({
      resultFor: (definition, metadata) => {
        const result = complete(definition, metadata, [1, 1]);
        result.factMap["T!T"].rows[1].dataCells.at(-1).label = "conflicting";
        if (key === "sales") result.factMap["T!T"].rows[1].dataCells.at(-1).value = 100_001;
        return result;
      },
    });
    await assert.rejects(collect(key, fixture), { code: "SALESFORCE_INVALID_REPORT" });
  }
});

test("deduplicates identical account/contact rows and leaves stage duplicate diagnostics intact", async () => {
  const fixture = client({
    resultFor: (definition, metadata) => complete(definition, metadata, [1, 1]),
  });
  for (const key of ["brokers", "imobAccounts"])
    assert.equal((await collect(key, fixture)).length, 1);
  assert.equal((await collect("opportunities", fixture)).length, 2);
});

test("rejects schema drift, row limits and ignored date overrides without widening filters", async () => {
  for (const mutate of [
    (m) => {
      m.detailColumns.pop();
    },
    (m) => {
      m.topRows = { rowLimit: 10 };
    },
    (m) => {
      m.standardDateFilter = null;
    },
  ]) {
    const fixture = client({
      describeFor: (metadata) => {
        mutate(metadata);
        return metadata;
      },
    });
    await assert.rejects(collect("opportunities", fixture), { code: "SALESFORCE_INVALID_REPORT" });
    assert.equal(fixture.calls.length, 1);
  }
  const fixture = client({
    resultFor: (definition, metadata) => {
      metadata.standardDateFilter.column = "Activity.OtherDate";
      return complete(definition, metadata);
    },
  });
  await assert.rejects(collect("appointments", fixture), { code: "SALESFORCE_INVALID_REPORT" });
  const unused = client();
  await assert.rejects(collect("opportunities", unused, "2026-02-30", REFERENCE), {
    code: "SALESFORCE_INVALID_REPORT",
  });
  await assert.rejects(collect("opportunities", unused, REFERENCE, "2026-01-01"), {
    code: "SALESFORCE_INVALID_REPORT",
  });
  assert.equal(unused.calls.length, 0);
});

test("rejects reconciliation drift after date partitioning", async () => {
  const fixture = client({
    resultFor: (definition, metadata) => {
      const result = complete(definition, metadata);
      if (metadata.standardDateFilter.startDate !== metadata.standardDateFilter.endDate) {
        result.allData = false;
        result.factMap["T!T"].aggregates[0].value = 3;
      }
      return result;
    },
  });
  await assert.rejects(collect("opportunities", fixture, "2026-10-07", REFERENCE), {
    code: "SALESFORCE_INVALID_REPORT",
  });
});

test("export awaits onCollected, keeps candidate return shape, and releases the cycle lock", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-collection-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, "candidate.json");
  const fixture = client();
  let closed = 0;
  let collected;
  const events = [];
  t.mock.method(chromium, "connectOverCDP", async () => ({
    contexts: () => [
      {
        pages: () => [
          { url: () => "https://direcional.my.salesforce.com/lightning", reload: async () => {} },
        ],
        cookies: async () => [{ name: "sid", value: "synthetic-sid" }],
      },
    ],
    close: async () => {
      closed += 1;
    },
  }));
  t.mock.method(globalThis, "fetch", fixture.options.fetchImpl);
  const candidate = await exportCandidate(
    { SALESFORCE_CANDIDATE_OUTPUT: output, SALESFORCE_REFERENCE_DATE: REFERENCE },
    {
      onCollected: async (value) => {
        await access(`${output}.lock`);
        assert.deepEqual(JSON.parse(await readFile(output, "utf8")), value);
        collected = value;
        events.push("collected");
      },
    },
  );
  assert.deepEqual(events, ["collected"]);
  assert.equal(collected, candidate);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), candidate);
  assert.equal(candidate.diagnostics.sourceRows.sales, 1);
  assert.equal(candidate.validation, undefined);
  assert.equal(closed, 1);
  await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
});

test("collection callback completes before publication and its failures remain export errors", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-collected-callback-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, "candidate.json");
  const fixture = client();
  let closed = 0;
  t.mock.method(chromium, "connectOverCDP", async () => ({
    contexts: () => [
      {
        pages: () => [
          { url: () => "https://direcional.my.salesforce.com/lightning", reload: async () => {} },
        ],
        cookies: async () => [{ name: "sid", value: "synthetic-sid" }],
      },
    ],
    close: async () => {
      closed += 1;
    },
  }));
  t.mock.method(globalThis, "fetch", fixture.options.fetchImpl);
  for (const failure of ["publication", "callback"]) {
    let callbackCalls = 0;
    let callbackCompleted = false;
    let publicationCalls = 0;
    let collected;
    const environment = {
      SALESFORCE_CANDIDATE_OUTPUT: output,
      SALESFORCE_REFERENCE_DATE: REFERENCE,
      get SALESFORCE_N8N_PUBLISH_ENABLED() {
        publicationCalls += 1;
        assert.equal(callbackCompleted, true);
        return "true";
      },
    };
    await assert.rejects(
      exportCandidate(environment, {
        onCollected: async (candidate) => {
          callbackCalls += 1;
          assert.deepEqual(JSON.parse(await readFile(output, "utf8")), candidate);
          collected = candidate;
          if (failure === "callback") throw new Error("PRIVATE callback details");
          callbackCompleted = true;
        },
      }),
      (error) => {
        assert.equal(
          error.code,
          failure === "publication" ? "publication_failed" : "SALESFORCE_EXPORT_FAILED",
        );
        assert.equal(error.cause, undefined);
        assert.doesNotMatch(error.message, /PRIVATE/);
        return true;
      },
    );
    assert.equal(callbackCalls, 1);
    assert.equal(publicationCalls, failure === "publication" ? 1 : 0);
    assert.deepEqual(
      collected.diagnostics.sourceRows,
      Object.fromEntries(REPORTS.map(({ key }) => [key, 1])),
    );
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), collected);
    await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
  }
  assert.equal(closed, 2);
});

test("cancelled export keeps ownership until pending rename completes before another export", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-pending-rename-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, "candidate.json");
  const environment = { SALESFORCE_CANDIDATE_OUTPUT: output, SALESFORCE_REFERENCE_DATE: REFERENCE };
  const fixture = client();
  const controller = new AbortController();
  const renameStarted = Promise.withResolvers();
  const finishRename = Promise.withResolvers();
  const renameCompleted = Promise.withResolvers();
  const realRename = fs.rename;
  let renameFinished = false;
  let renameCalls = 0;
  let closedBeforeRename = false;
  let collectedA = 0;
  let settledA = false;
  let candidateA;
  const renameMock = t.mock.method(fs, "rename", async (source, destination) => {
    if (destination === output && ++renameCalls === 1) {
      try {
        candidateA = JSON.parse(await readFile(source, "utf8"));
        renameStarted.resolve();
        await finishRename.promise;
        await realRename(source, destination);
        renameFinished = true;
        return;
      } finally {
        renameCompleted.resolve();
      }
    }
    return realRename(source, destination);
  });
  syncBuiltinESMExports();
  t.after(() => {
    renameMock.mock.restore();
    syncBuiltinESMExports();
  });
  t.mock.method(chromium, "connectOverCDP", async () => ({
    contexts: () => [
      {
        pages: () => [
          { url: () => "https://direcional.my.salesforce.com/lightning", reload: async () => {} },
        ],
        cookies: async () => [{ name: "sid", value: "synthetic-sid" }],
      },
    ],
    close: async () => {
      closedBeforeRename ||= !renameFinished;
    },
  }));
  t.mock.method(globalThis, "fetch", fixture.options.fetchImpl);
  const resultA = exportCandidate(environment, {
    signal: controller.signal,
    onCollected: () => {
      collectedA += 1;
    },
  }).then(
    (value) => {
      settledA = true;
      return { value };
    },
    (error) => {
      settledA = true;
      return { error };
    },
  );
  try {
    await Promise.race([
      renameStarted.promise,
      resultA.then(({ error }) => {
        throw error ?? new Error("export completed before rename");
      }),
    ]);
    controller.abort();
    await assert.rejects(exportCandidate(environment), { code: "SALESFORCE_EXPORT_LOCKED" });
    await access(`${output}.lock`);
    assert.equal(settledA, false);
    assert.equal(closedBeforeRename, false);
    assert.equal(renameFinished, false);
    finishRename.resolve();
    const outcomeA = await resultA;
    assert.equal(outcomeA.error?.code, "SALESFORCE_CANCELLED");
    assert.equal(renameFinished, true);
    assert.equal(collectedA, 0);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), candidateA);
    await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });

    const candidateB = await exportCandidate(environment);
    assert.notEqual(candidateB.payload.requestId, candidateA.payload.requestId);
    assert.equal(renameCalls, 2);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), candidateB);
    await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
    assert.deepEqual(await fs.readdir(directory), ["candidate.json"]);
  } finally {
    finishRename.resolve();
    await resultA;
    if (renameCalls > 0) await renameCompleted.promise;
  }
});

test("failed connection releases the lock and preserves the prior candidate without leaking native errors", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-collection-failure-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, "candidate.json");
  await writeFile(output, "previous-synthetic-candidate");
  t.mock.method(chromium, "connectOverCDP", async () => {
    throw new Error("sid=PRIVATE");
  });
  await assert.rejects(exportCandidate({ SALESFORCE_CANDIDATE_OUTPUT: output }), (error) => {
    assert.equal(error.code, "SALESFORCE_EXPORT_FAILED");
    assert.doesNotMatch(error.message, /PRIVATE/);
    return true;
  });
  assert.equal(await readFile(output, "utf8"), "previous-synthetic-candidate");
  await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
});

test("global cycle timeout and caller cancellation release ownership without starting report requests", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-collection-cancel-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, "candidate.json");
  const controller = new AbortController();
  t.mock.method(chromium, "connectOverCDP", async () => {
    queueMicrotask(() => controller.abort("PRIVATE"));
    return new Promise(() => {});
  });
  await assert.rejects(
    exportCandidate({ SALESFORCE_CANDIDATE_OUTPUT: output }, { signal: controller.signal }),
    { code: "SALESFORCE_CANCELLED" },
  );
  await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
  await assert.rejects(
    exportCandidate({ SALESFORCE_CANDIDATE_OUTPUT: output }, { cycleTimeoutMs: 20 }),
    { code: "SALESFORCE_TIMEOUT" },
  );
  await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
});

test("an incomplete report never replaces the prior candidate or reaches publication", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-incomplete-export-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, "candidate.json");
  await writeFile(output, "previous-synthetic-candidate");
  const fixture = client({
    resultFor: (definition, metadata) => ({
      ...complete(definition, metadata),
      allData: false,
    }),
  });
  let closed = false;
  t.mock.method(chromium, "connectOverCDP", async () => ({
    contexts: () => [
      {
        pages: () => [
          { url: () => "https://direcional.my.salesforce.com/lightning", reload: async () => {} },
        ],
        cookies: async () => [{ name: "sid", value: "synthetic-sid" }],
      },
    ],
    close: async () => {
      closed = true;
    },
  }));
  t.mock.method(globalThis, "fetch", fixture.options.fetchImpl);
  await assert.rejects(
    exportCandidate({
      SALESFORCE_CANDIDATE_OUTPUT: output,
      SALESFORCE_REFERENCE_DATE: "2026-01-01",
      SALESFORCE_N8N_PUBLISH_ENABLED: "true",
    }),
    { code: "SALESFORCE_INCOMPLETE_REPORT" },
  );
  assert.equal(await readFile(output, "utf8"), "previous-synthetic-candidate");
  assert.equal(closed, true);
  assert.equal(fixture.calls.length, 3);
  await assert.rejects(access(`${output}.lock`), { code: "ENOENT" });
});

test("abort interrupts report polling before any additional fetch", async () => {
  const controller = new AbortController();
  const fixture = client();
  fixture.options.signal = controller.signal;
  fixture.options.sleep = async () => {
    controller.abort("PRIVATE");
  };
  await assert.rejects(collect("brokers", fixture), { code: "SALESFORCE_CANCELLED" });
  assert.equal(fixture.calls.length, 2);
});

test("publication failures have a distinct safe code without masking cancellation", async () => {
  await assert.rejects(
    publishCandidatePayload({}, { SALESFORCE_N8N_PUBLISH_ENABLED: "true" }),
    (error) => {
      assert.equal(error.code, "publication_failed");
      assert.equal(error.message, "Salesforce publication failed");
      assert.equal(error.cause, undefined);
      return true;
    },
  );
  const controller = new AbortController();
  controller.abort("PRIVATE");
  await assert.rejects(publishCandidatePayload({}, {}, controller.signal), {
    code: "SALESFORCE_CANCELLED",
  });
  assert.deepEqual(await publishCandidatePayload({}, {}), { published: false, status: "disabled" });
});
