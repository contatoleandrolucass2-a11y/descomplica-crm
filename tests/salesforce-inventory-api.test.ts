import { mkdtemp, rm, writeFile, rename, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorizeRoute: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));
const directories: string[] = [];

const sample = () => ({
  schemaVersion: 1,
  source: "Salesforce · ESTOQUE SPC",
  sourceKind: "live",
  reportId: "00OU6000007yRpKMAU",
  generatedAt: "2026-10-13T17:00:00.000Z",
  sourceRows: 1,
  duplicateRows: 0,
  projectCount: 1,
  count: 1,
  items: [
    {
      id: "a0Q000000000001AAA",
      businessUnit: "Riva",
      project: "Projeto sintético",
      product: "Produto sintético",
      description: null,
      identifier: "BL01-0001",
      plant: null,
      classification: null,
      unitType: null,
      building: null,
      constructionStatus: null,
      completionDate: "2027-11-01",
      postalCode: null,
      city: null,
      street: null,
      streetNumber: null,
      neighborhood: null,
      district: null,
      state: null,
      status: "Mirror - Reservada",
      launchPrice: null,
      appraisal: null,
      finalWithKit: 300000,
      unitBonus: 5000,
      tableSlack: 1000,
      cashBackSlack: 1000,
      minimumSignal: null,
      finalPrice: 294000,
      privateArea: null,
      rooms: null,
      parkingSpaces: null,
      floor: null,
      finalUnit: null,
      progress: null,
    },
  ],
});

async function configure(payload: unknown = sample()) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "salesforce-stock-test-"));
  directories.push(directory);
  const file = path.join(directory, "current.json");
  await writeFile(file, JSON.stringify(payload), { mode: 0o600 });
  process.env.SALESFORCE_INVENTORY_PATH = file;
  return file;
}

beforeEach(() => {
  vi.resetModules();
  mocks.authorizeRoute.mockReset().mockResolvedValue({ ok: true });
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-13T18:00:00Z"));
  delete process.env.SALESFORCE_INVENTORY_PATH;
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.SALESFORCE_INVENTORY_PATH;
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("official Salesforce inventory", () => {
  it("returns only inventory counts and collection time in the settings status", async () => {
    await configure();
    const { GET } = await import("@/app/api/salesforce/status/route");
    const response = await GET();
    const data = await response.json();
    expect(data.inventory).toEqual({ generatedAt: sample().generatedAt, sourceRows: 1, count: 1 });
    expect(JSON.stringify(data)).not.toContain("Produto sintético");
    expect(JSON.stringify(data)).not.toContain("finalPrice");
    expect(mocks.authorizeRoute).toHaveBeenCalledWith("crm.settings.manage");
  });
  it("serves the same official units to both simulator sources without querying the legacy feed", async () => {
    await configure();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const [{ GET: live }, { GET: snapshot }] = await Promise.all([
      import("@/app/api/inventory/route"),
      import("@/app/api/inventory/snapshot/route"),
    ]);
    const responses = await Promise.all([live(), snapshot()]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual(sample());
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "checks authorization before reading the official file (%i)",
    async (status) => {
      process.env.SALESFORCE_INVENTORY_PATH = "/missing/inventory.json";
      mocks.authorizeRoute.mockResolvedValue({
        ok: false,
        response: Response.json({ error: "denied" }, { status }),
      });
      const [{ GET: live }, { GET: snapshot }] = await Promise.all([
        import("@/app/api/inventory/route"),
        import("@/app/api/inventory/snapshot/route"),
      ]);
      expect((await live()).status).toBe(status);
      expect((await snapshot()).status).toBe(status);
    },
  );

  it.each(["missing", "wrong-report", "duplicate-id", "wrong-count", "future", "symlink"])(
    "rejects %s and never falls back to the old inventory",
    async (failure) => {
      const data = sample();
      if (failure === "wrong-report") data.reportId = "unapproved-report";
      if (failure === "duplicate-id") {
        data.items.push(data.items[0]!);
        data.count = data.sourceRows = 2;
      }
      if (failure === "wrong-count") data.sourceRows = 2;
      if (failure === "future") data.generatedAt = "2027-01-01T00:00:00Z";
      const file = await configure(data);
      if (failure === "missing") await rm(file);
      if (failure === "symlink") {
        await rename(file, `${file}.real`);
        await symlink(`${file}.real`, file);
      }
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const [{ GET: live }, { GET: snapshot }] = await Promise.all([
        import("@/app/api/inventory/route"),
        import("@/app/api/inventory/snapshot/route"),
      ]);
      expect((await live()).status).toBe(502);
      expect((await snapshot()).status).toBe(503);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("reads an atomic update after 30 seconds without keeping the startup snapshot forever", async () => {
    const file = await configure();
    const { GET } = await import("@/app/api/inventory/snapshot/route");
    expect((await (await GET()).json()).count).toBe(1);
    const updated = sample();
    updated.generatedAt = "2026-10-13T18:00:00.000Z";
    updated.items[0]!.finalWithKit = 310000;
    updated.items[0]!.finalPrice = 304000;
    await writeFile(`${file}.next`, JSON.stringify(updated));
    await rename(`${file}.next`, file);
    vi.mocked(Date.now).mockReturnValue(Date.parse("2026-10-13T18:00:31Z"));
    expect(await (await GET()).json()).toEqual(updated);
  });
});
