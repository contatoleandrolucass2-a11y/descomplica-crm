import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRoute: vi.fn(),
}));

vi.mock("@/lib/security/route-auth", () => ({
  authorizeRoute: mocks.authorizeRoute,
}));

const temporaryDirectories: string[] = [];

beforeEach(() => {
  vi.resetModules();
  mocks.authorizeRoute.mockReset();
  delete process.env.INVESTOR_INVENTORY_SNAPSHOT_PATH;
  delete process.env.INVESTOR_INVENTORY_SNAPSHOT_REFERENCE_DATE;
  delete process.env.INVESTOR_INVENTORY_SNAPSHOT_SHA256;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("inventory API authorization and cache boundaries", () => {
  it.each([401, 403])(
    "rejects unauthorized access with %i before reading either source",
    async (status) => {
      mocks.authorizeRoute.mockImplementation(async () => ({
        ok: false,
        response: Response.json(
          { error: status === 401 ? "authentication_required" : "forbidden" },
          { status, headers: { "cache-control": "no-store" } },
        ),
      }));
      const upstreamFetch = vi.fn(() => {
        throw new Error("upstream_must_not_run");
      });
      vi.stubGlobal("fetch", upstreamFetch);

      const [{ GET: getSnapshot }, { GET: getLive }] = await Promise.all([
        import("@/app/api/inventory/snapshot/route"),
        import("@/app/api/inventory/route"),
      ]);
      const [snapshotResponse, liveResponse] = await Promise.all([getSnapshot(), getLive()]);

      for (const response of [snapshotResponse, liveResponse]) {
        expect(response.status).toBe(status);
        expect(response.headers.get("cache-control")).toContain("no-store");
      }
      expect(upstreamFetch).not.toHaveBeenCalled();
      expect(mocks.authorizeRoute).toHaveBeenCalledTimes(2);
      expect(mocks.authorizeRoute).toHaveBeenNthCalledWith(1, "crm.simulators.view");
      expect(mocks.authorizeRoute).toHaveBeenNthCalledWith(2, "crm.simulators.view");
    },
  );

  it("serves the validated private snapshot with server-owned lineage metadata", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    const directory = await mkdtemp(path.join(os.tmpdir(), "direct-table-snapshot-test-"));
    temporaryDirectories.push(directory);
    const snapshotPath = path.join(directory, "inventory.json");
    const contents = JSON.stringify({
      source: "ESTOQUE SPC.xlsx",
      count: 3301,
      items: Array.from({ length: 3301 }, (_, index) => ({ id: `fixture-${index + 1}` })),
    });
    process.env.INVESTOR_INVENTORY_SNAPSHOT_PATH = snapshotPath;
    process.env.INVESTOR_INVENTORY_SNAPSHOT_REFERENCE_DATE = "2026-09-05";
    process.env.INVESTOR_INVENTORY_SNAPSHOT_SHA256 = createHash("sha256")
      .update(contents)
      .digest("hex");
    await writeFile(snapshotPath, contents, { mode: 0o600 });

    const { GET } = await import("@/app/api/inventory/snapshot/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toMatchObject({
      source: "ESTOQUE SPC.xlsx",
      sourceKind: "versioned-snapshot",
      snapshotReferenceDate: "2026-09-05",
      snapshotSha256: process.env.INVESTOR_INVENTORY_SNAPSHOT_SHA256,
      count: 3301,
    });
    expect(payload.items).toHaveLength(3301);
  });

  it("serves a valid live inventory only after authorization and without caching", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    const upstreamFetch = vi.fn().mockResolvedValue(
      Response.json({
        source: "live-protected-source",
        generatedAt: "2026-09-06T03:00:00.000Z",
        count: 1,
        items: [{ id: "unit-1" }],
      }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const { GET } = await import("@/app/api/inventory/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload).toMatchObject({ count: 1, source: "live-protected-source" });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(mocks.authorizeRoute).toHaveBeenCalledWith("crm.simulators.view");
  });
});
