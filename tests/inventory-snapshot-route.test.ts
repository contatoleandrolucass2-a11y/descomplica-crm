import { createHash } from "node:crypto";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noStoreHeaders } from "@/lib/security/api";

const authorizedBrands = {
  ok: true,
  context: { permissions: ["crm.inventory.riva.view", "crm.inventory.direcional.view"] },
};

const mocks = vi.hoisted(() => ({
  authorizeRoute: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHash: vi.fn(actual.createHash) };
});

const snapshotPath = path.resolve("synthetic-inventory-snapshot.json");
const fixture = {
  source: "ESTOQUE SPC.xlsx",
  count: 3301,
  items: Array.from({ length: 3301 }, (_, index) => ({
    id: `synthetic-unit-${index}`,
    businessUnit: index % 2 === 0 ? "Riva" : "Direcional",
  })),
  lineage: { origin: "synthetic-test", batchId: "synthetic-batch" },
  sourceKind: "untrusted-fixture-value",
  snapshotReferenceDate: "untrusted-fixture-value",
  snapshotSha256: "untrusted-fixture-value",
};
const contents = JSON.stringify(fixture);
const snapshotSha256 = createHash("sha256").update(contents).digest("hex");
const expectedSnapshot = {
  source: fixture.source,
  count: fixture.count,
  items: fixture.items,
  sourceKind: "versioned-snapshot",
  snapshotReferenceDate: "2026-09-05",
  snapshotSha256,
};

let GET: typeof import("@/app/api/inventory/snapshot/route").GET;

function deferredRead() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function expectNoStore(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
}

async function expectUnavailable(response: Response) {
  expect(response.status).toBe(503);
  expectNoStore(response);
  await expect(response.json()).resolves.toEqual({ error: "inventory_snapshot_unavailable" });
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_PATH", ` ${snapshotPath} `);
  vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_SHA256", ` ${snapshotSha256} `);
  vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_REFERENCE_DATE", "");
  mocks.authorizeRoute.mockResolvedValue(authorizedBrands);
  mocks.readFile.mockResolvedValue(contents);
  ({ GET } = await import("@/app/api/inventory/snapshot/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("inventory snapshot route", () => {
  it.each([
    { permissions: [], brands: [] },
    { permissions: ["crm.inventory.riva.view"], brands: ["Riva"] },
    { permissions: ["crm.inventory.direcional.view"], brands: ["Direcional"] },
    { permissions: authorizedBrands.context.permissions, brands: ["Riva", "Direcional"] },
  ])("filters a fully validated snapshot for $permissions", async ({ permissions, brands }) => {
    mocks.authorizeRoute.mockResolvedValue({
      ok: true,
      context: { roleKey: "master", permissions },
    });
    const response = await GET();
    expectNoStore(response);
    const payload = await response.json();
    const expectedItems = fixture.items.filter((item) => brands.includes(item.businessUnit));
    expect(payload.items).toEqual(expectedItems);
    expect(payload.count).toBe(expectedItems.length);
    expect(payload).not.toHaveProperty("lineage");
    if (permissions.length === 0) {
      expect(payload).toEqual({ count: 0, items: [] });
      expect(mocks.readFile).not.toHaveBeenCalled();
      expect(createHash).not.toHaveBeenCalled();
    } else {
      expect(payload.snapshotSha256).toBe(snapshotSha256);
      expect(createHash).toHaveBeenCalledExactlyOnceWith("sha256");
    }
  });

  it("filters current permissions on a warm snapshot after brand access is changed or removed", async () => {
    for (const permissions of [
      authorizedBrands.context.permissions,
      ["crm.inventory.riva.view"],
      ["crm.inventory.direcional.view"],
      [],
      ["crm.inventory.riva.view"],
    ]) {
      mocks.authorizeRoute.mockResolvedValue({ ok: true, context: { permissions } });
      const response = await GET();
      expectNoStore(response);
      const payload = await response.json();
      const expectedItems = fixture.items.filter((item) =>
        permissions.includes(`crm.inventory.${item.businessUnit.toLowerCase()}.view`),
      );
      expect(payload.items).toEqual(expectedItems);
      expect(payload.count).toBe(expectedItems.length);
      if (permissions.length === 0) expect(payload).toEqual({ count: 0, items: [] });
    }
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    expect(createHash).toHaveBeenCalledTimes(1);
  });

  it("keeps concurrent brand profiles separate on the same pending snapshot", async () => {
    const pending = deferredRead();
    mocks.readFile.mockReturnValueOnce(pending.promise);
    const requests = Array.from({ length: 20 }, (_, index) => {
      const brand = index % 2 === 0 ? "Riva" : "Direcional";
      mocks.authorizeRoute.mockResolvedValueOnce({
        ok: true,
        context: { permissions: [`crm.inventory.${brand.toLowerCase()}.view`] },
      });
      return GET().then(async (response) => {
        expectNoStore(response);
        const payload = await response.json();
        const expectedItems = fixture.items.filter((item) => item.businessUnit === brand);
        expect(payload.items).toEqual(expectedItems);
        expect(payload.count).toBe(expectedItems.length);
      });
    });
    await Promise.resolve();
    pending.resolve(contents);
    await Promise.all(requests);
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    expect(createHash).toHaveBeenCalledTimes(1);
  });

  it("omits empty, absent and unknown brands even when both brands are allowed", async () => {
    const unknownBrands = [undefined, null, "", "  ", "Outra", "Riva Direcional", "Direcional Sul"];
    const unknownFixture = {
      ...fixture,
      items: fixture.items.map((item, index) =>
        index < unknownBrands.length ? { ...item, businessUnit: unknownBrands[index] } : item,
      ),
      facets: { projects: ["Projeto restrito"] },
      aggregates: { count: 3301 },
    };
    const unknownContents = JSON.stringify(unknownFixture);
    vi.stubEnv(
      "INVESTOR_INVENTORY_SNAPSHOT_SHA256",
      createHash("sha256").update(unknownContents).digest("hex"),
    );
    mocks.readFile.mockResolvedValueOnce(unknownContents);
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.items).toEqual(fixture.items.slice(unknownBrands.length));
    expect(payload.count).toBe(3301 - unknownBrands.length);
    expect(payload).not.toHaveProperty("facets");
    expect(payload).not.toHaveProperty("aggregates");
  });

  it("validates all source rows before applying a narrow brand filter", async () => {
    const invalidContents = JSON.stringify({
      ...fixture,
      items: fixture.items.map((item, index) =>
        index === 3 ? { ...item, id: fixture.items[1]!.id } : item,
      ),
    });
    vi.stubEnv(
      "INVESTOR_INVENTORY_SNAPSHOT_SHA256",
      createHash("sha256").update(invalidContents).digest("hex"),
    );
    mocks.readFile.mockResolvedValueOnce(invalidContents);
    mocks.authorizeRoute.mockResolvedValue({
      ok: true,
      context: { permissions: ["crm.inventory.riva.view"] },
    });
    await expectUnavailable(await GET());
  });

  it("bounds successive read failures before allowing a shared retry", async () => {
    mocks.readFile.mockRejectedValue(new Error("synthetic_read_failure"));
    for (let index = 0; index < 20; index += 1) {
      const response = await GET();
      expect(response.headers.get("retry-after")).toBe("5");
      await expectUnavailable(response);
    }
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4_999);
    expect((await GET()).headers.get("retry-after")).toBe("1");
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    mocks.authorizeRoute.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    });
    const denied = await GET();
    expect(denied.status).toBe(403);
    expect(denied.headers.get("retry-after")).toBeNull();

    vi.advanceTimersByTime(1);
    mocks.readFile.mockResolvedValue(contents);
    for (const response of await Promise.all(Array.from({ length: 20 }, () => GET()))) {
      expect(response.status).toBe(200);
      expectNoStore(response);
      expect(response.headers.get("retry-after")).toBeNull();
      await expect(response.json()).resolves.toEqual(expectedSnapshot);
    }
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(42);
  });

  it("releases all waiters after the read deadline and ignores a late read", async () => {
    const stuck = deferredRead();
    mocks.readFile.mockReturnValueOnce(stuck.promise);
    const responses: Response[] = [];
    const pending = Promise.all(
      Array.from({ length: 20 }, async () => responses.push(await GET())),
    );
    await vi.advanceTimersByTimeAsync(19_999);
    expect(responses).toHaveLength(0);
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(responses).toHaveLength(20);
    await pending;
    expect(mocks.readFile.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    for (const response of responses) await expectUnavailable(response);

    await vi.advanceTimersByTimeAsync(5_000);
    const retry = deferredRead();
    mocks.readFile.mockReturnValueOnce(retry.promise);
    const recovering = GET();
    await Promise.resolve();
    stuck.resolve(contents);
    await vi.advanceTimersByTimeAsync(0);
    expect(createHash).not.toHaveBeenCalled();
    const joined = GET();
    await Promise.resolve();
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    retry.resolve(contents);
    for (const response of await Promise.all([recovering, joined, GET()])) {
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(expectedSnapshot);
    }
    expect(createHash).toHaveBeenCalledExactlyOnceWith("sha256");
  });

  it("shares cold reading, hashing and parsing while authorizing every request", async () => {
    const pending = deferredRead();
    mocks.readFile.mockReturnValue(pending.promise);
    const parse = vi.spyOn(JSON, "parse");

    const requests = [GET(), GET(), GET()];
    await Promise.resolve();
    expect(mocks.authorizeRoute.mock.calls).toEqual([
      ["crm.simulators.view"],
      ["crm.simulators.view"],
      ["crm.simulators.view"],
    ]);
    expect(createHash).not.toHaveBeenCalled();
    pending.resolve(contents);
    const responses = await Promise.all(requests);

    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(snapshotPath, {
      encoding: "utf8",
      signal: expect.any(AbortSignal),
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(createHash).toHaveBeenCalledExactlyOnceWith("sha256");
    expect(parse.mock.calls.filter(([value]) => value === contents)).toHaveLength(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expectNoStore(response);
      expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      await expect(response.json()).resolves.toEqual(expectedSnapshot);
    }
  });

  it("reuses only the validated result on warm requests and preserves safe provenance", async () => {
    vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_REFERENCE_DATE", " 2030-01-02 ");
    const parse = vi.spyOn(JSON, "parse");
    const cold = await GET();
    const warm = await GET();

    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(2);
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    expect(createHash).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls.filter(([value]) => value === contents)).toHaveLength(1);
    for (const response of [cold, warm]) {
      expect(response.status).toBe(200);
      expectNoStore(response);
      await expect(response.json()).resolves.toEqual({
        ...expectedSnapshot,
        snapshotReferenceDate: "2030-01-02",
      });
    }
  });

  it.each([
    { status: 401, error: "unauthenticated" },
    { status: 403, error: "forbidden" },
  ])(
    "denies $status before accessing cold, pending or warm snapshots",
    async ({ status, error }) => {
      const denyNext = () => {
        const response = Response.json({ error }, { status, headers: noStoreHeaders() });
        mocks.authorizeRoute.mockResolvedValueOnce({ ok: false, response });
        return response;
      };
      const checkDenied = async () => {
        const denial = denyNext();
        const response = await GET();
        expect(response).toBe(denial);
        expect(response.status).toBe(status);
        expectNoStore(response);
        await expect(response.json()).resolves.toEqual({ error });
      };

      await checkDenied();
      expect(mocks.readFile).not.toHaveBeenCalled();
      expect(createHash).not.toHaveBeenCalled();

      const pending = deferredRead();
      mocks.readFile.mockReturnValueOnce(pending.promise);
      const allowed = GET();
      await Promise.resolve();
      await checkDenied();
      expect(mocks.readFile).toHaveBeenCalledTimes(1);
      expect(createHash).not.toHaveBeenCalled();
      pending.resolve(contents);
      expect((await allowed).status).toBe(200);

      await checkDenied();
      expect(mocks.readFile).toHaveBeenCalledTimes(1);
      expect(createHash).toHaveBeenCalledTimes(1);
      expect(mocks.authorizeRoute.mock.calls).toEqual(
        Array.from({ length: 4 }, () => ["crm.simulators.view"]),
      );
    },
  );

  it.each(["read", "JSON", "hash"])(
    "shares a %s failure and retries without caching invalid contents",
    async (failure) => {
      const pending = deferredRead();
      mocks.readFile.mockReturnValueOnce(pending.promise);
      const invalidContents = failure === "JSON" ? "{invalid-synthetic-json" : `${contents} `;
      if (failure === "JSON") {
        vi.stubEnv(
          "INVESTOR_INVENTORY_SNAPSHOT_SHA256",
          createHash("sha256").update(invalidContents).digest("hex"),
        );
      }

      const requests = [GET(), GET(), GET()];
      await Promise.resolve();
      if (failure === "read") {
        pending.reject(new Error("synthetic_read_failure"));
      } else {
        pending.resolve(invalidContents);
      }
      for (const response of await Promise.all(requests)) {
        await expectUnavailable(response);
      }
      expect(mocks.readFile).toHaveBeenCalledTimes(1);

      vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_SHA256", snapshotSha256);
      vi.advanceTimersByTime(5_000);
      const retry = await GET();
      expect(retry.status).toBe(200);
      expectNoStore(retry);
      await expect(retry.json()).resolves.toEqual(expectedSnapshot);
      const warm = await GET();
      expect(warm.status).toBe(200);
      await expect(warm.json()).resolves.toEqual(expectedSnapshot);
      expect(mocks.readFile).toHaveBeenCalledTimes(2);
      expect(mocks.authorizeRoute).toHaveBeenCalledTimes(5);
    },
  );

  it.each([
    { name: "null payload", payload: null },
    { name: "wrong source", payload: { ...fixture, source: "synthetic-wrong-source" } },
    { name: "wrong count", payload: { ...fixture, count: 3300 } },
    { name: "string count", payload: { ...fixture, count: "3301" } },
    { name: "non-array items", payload: { ...fixture, items: {} } },
    { name: "wrong length", payload: { ...fixture, items: fixture.items.slice(1) } },
    {
      name: "duplicate IDs",
      payload: { ...fixture, items: fixture.items.map(() => ({ id: "synthetic-duplicate" })) },
    },
  ])("rejects $name even with a matching hash and allows retry", async ({ payload }) => {
    const invalidContents = JSON.stringify(payload);
    vi.stubEnv(
      "INVESTOR_INVENTORY_SNAPSHOT_SHA256",
      createHash("sha256").update(invalidContents).digest("hex"),
    );
    mocks.readFile.mockResolvedValueOnce(invalidContents);

    await expectUnavailable(await GET());

    vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_SHA256", snapshotSha256);
    vi.advanceTimersByTime(5_000);
    const retry = await GET();
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toEqual(expectedSnapshot);
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, "", "   ", "relative-synthetic-snapshot.json"])(
    "rejects an invalid path %s before reading and allows retry",
    async (configuredPath) => {
      vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_PATH", configuredPath);
      await expectUnavailable(await GET());
      expect(mocks.readFile).not.toHaveBeenCalled();

      vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_PATH", snapshotPath);
      vi.advanceTimersByTime(5_000);
      const retry = await GET();
      expect(retry.status).toBe(200);
      await expect(retry.json()).resolves.toEqual(expectedSnapshot);
      expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(snapshotPath, {
        encoding: "utf8",
        signal: expect.any(AbortSignal),
      });
    },
  );

  it.each([undefined, "", "   "])(
    "still checks the default hash when the configured hash is %s",
    async (configuredHash) => {
      vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_SHA256", configuredHash);
      await expectUnavailable(await GET());

      vi.stubEnv("INVESTOR_INVENTORY_SNAPSHOT_SHA256", snapshotSha256);
      vi.advanceTimersByTime(5_000);
      expect((await GET()).status).toBe(200);
      expect(mocks.readFile).toHaveBeenCalledTimes(2);
    },
  );
});
