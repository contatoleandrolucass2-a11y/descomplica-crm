import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { validateMetaAdsRange } from "@/lib/crm/meta-ads/marketing-api";

const model = vm.runInNewContext(
  readFileSync("public/descomplica-ads-compact/data-model.js", "utf8") + ";AdsData",
);
const rows = [
  {
    date: "2026-10-01",
    accountId: "1",
    campaignId: "2",
    campaign: "Campanha <script>",
    adsetId: "3",
    adset: "Conjunto",
    adId: "4",
    ad: "Anúncio",
    destination: "whatsapp",
    status: "active",
    spend: 100,
    conversions: 5,
    clicks: 20,
    impressions: 1000,
    qualifiedLeads: null,
  },
  {
    date: "2026-10-02",
    accountId: "1",
    campaignId: "2",
    campaign: "Campanha <script>",
    adsetId: "3",
    adset: "Conjunto",
    adId: "5",
    ad: "Outro",
    destination: "whatsapp",
    status: "active",
    spend: 20,
    conversions: 1,
    clicks: 5,
    impressions: 500,
    qualifiedLeads: 1,
  },
  {
    date: "2026-09-30",
    accountId: "1",
    campaignId: "6",
    campaign: "Formulário",
    destination: "form",
    status: "paused",
    spend: 50,
    conversions: 10,
    clicks: 100,
    impressions: 2000,
  },
];
const state = { account: "all", destination: "whatsapp", status: "all" };
describe("compact real-data model", () => {
  it("separates destinations and dates and computes ratios from weighted totals", () => {
    const selected = model.filter(rows, state, { start: "2026-10-01", end: "2026-10-02" });
    const a = model.aggregate(selected);
    expect(a).toMatchObject({
      spend: 120,
      leads: 6,
      cpl: 20,
      cpc: 4.8,
      qualified: null,
      opens: null,
    });
    expect(a.ctr).toBeCloseTo((25 / 1500) * 100);
    expect(a.geo).toEqual([null, null, null, null, null]);
  });
  it("uses observed daily rows and preserves missing cost rather than invented interpolation", () => {
    const entity = model.groups(rows)[0];
    expect(entity.name).toBe("Campanha &lt;script&gt;");
    expect(model.daily(rows, entity, { start: "2026-10-01", end: "2026-10-03" })).toEqual([
      5, 1, 0,
    ]);
    expect(model.daily(rows, entity, { start: "2026-10-01", end: "2026-10-03" }, true)).toEqual([
      20,
      20,
      null,
    ]);
    expect(model.groups(rows, "ad").map((e: { id: string }) => e.id)).toEqual(["4", "5"]);
  });
  it("keeps zero-result costs undefined", () => {
    expect(model.aggregate([])).toMatchObject({ spend: 0, leads: 0, cpl: null, ctr: null });
  });
  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-10-02", "2026-10-01"],
    ["2020-01-01", "2026-10-01"],
    ["2026-01-01", null],
  ])("rejects invalid or oversized range %s", (start, end) => {
    expect(() => validateMetaAdsRange(start, end)).toThrow();
  });
  it("accepts leap dates and inclusive comparison ranges", () => {
    expect(validateMetaAdsRange("2024-02-29", "2024-03-01")).toEqual({
      start: "2024-02-29",
      end: "2024-03-01",
    });
    expect(validateMetaAdsRange(null, null)).toBeUndefined();
  });
});
