import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  inventoryIdentityKey,
  uniqueInventoryReferences,
} from "@/lib/archive-investor/inventory-reference";
import { eligibleIntermediaryIndexes } from "@/lib/archive-investor/intermediary-fields";

const unit = (identifier: string | null, appraisal = 300000) => ({
  businessUnit: "Riva",
  project: "Projeto sintetico",
  identifier,
  appraisal,
});

describe("unambiguous inventory enrichment", () => {
  it.each([null, "", "   "])("does not match missing identifier %s", (identifier) => {
    const current = unit(identifier);
    expect(inventoryIdentityKey(current)).toBeNull();
    expect(uniqueInventoryReferences([current], [unit(identifier, 600000)]).size).toBe(0);
  });

  it("rejects duplicate identities in either source", () => {
    const current = unit("A-101");
    expect(uniqueInventoryReferences([current], [current, unit("A-101", 600000)]).size).toBe(0);
    expect(uniqueInventoryReferences([current, current], [unit("A-101", 600000)]).size).toBe(0);
  });

  it("keeps a single exact unit reference", () => {
    const current = unit("A-101");
    const reference = unit("A-101", 350000);
    expect(
      uniqueInventoryReferences([current], [reference]).get(inventoryIdentityKey(current)!),
    ).toBe(reference);
  });

  it("does not collide when names contain delimiters", () => {
    const first = { ...unit("A-101"), project: "Projeto|A" };
    const second = { ...unit("A|A-101"), project: "Projeto" };
    expect(inventoryIdentityKey(first)).not.toBe(inventoryIdentityKey(second));
    expect(uniqueInventoryReferences([first], [second]).size).toBe(0);
  });
});

describe("annual input indexes", () => {
  const payments = Array.from({ length: 5 }, (_, index) => ({ date: `${2026 + index}-12-15` }));
  it("keeps the eligible next-year slot after December 15", () => {
    expect(
      eligibleIntermediaryIndexes({
        annualMode: true,
        payments,
        baseDate: "2026-12-16",
        completionDate: "2027-12-15",
        inputLimit: 1,
      }),
    ).toEqual([1]);
  });
  it("includes the exact base and completion dates", () => {
    expect(
      eligibleIntermediaryIndexes({
        annualMode: true,
        payments,
        baseDate: "2026-12-15",
        completionDate: "2027-12-15",
        inputLimit: 2,
      }),
    ).toEqual([0, 1]);
  });
  it("has no eligible annual before the next December 15", () => {
    expect(
      eligibleIntermediaryIndexes({
        annualMode: true,
        payments,
        baseDate: "2026-12-16",
        completionDate: "2027-12-14",
        inputLimit: 0,
      }),
    ).toEqual([]);
  });
  it("preserves ordinary intermediary indexing", () => {
    expect(
      eligibleIntermediaryIndexes({
        annualMode: false,
        payments,
        baseDate: "2026-12-16",
        completionDate: "2027-12-14",
        inputLimit: 3,
      }),
    ).toEqual([0, 1, 2]);
  });
  it("does not expose dates without a valid date range", () => {
    expect(
      eligibleIntermediaryIndexes({
        annualMode: true,
        payments,
        baseDate: "",
        completionDate: "",
        inputLimit: 5,
      }),
    ).toEqual([]);
  });
});

it("wires field errors and eligible indexes into the rendered proposal", async () => {
  const source = await readFile(
    "app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
    "utf8",
  );
  expect(source).toContain(
    "proposalValid={result.ok && Boolean(result.custom.decreasing?.ok) && !associativeProposalError}",
  );
  expect(source).toContain("uniqueInventoryReferences(items, reference)");
  expect(source).toContain(
    "allowedIntermediaryIndexes.find((index) => !visibleIntermediaryIndexes.includes(index))",
  );
  expect(source).toContain('allowedIntermediaryIndexes.includes(index) ? value : "0"');
  expect(source).toContain("linearApproval.checks.some");
  expect(source).toContain("decreasingApproval.checks.some");
  expect(source).toContain('approved: valid && candidateApproval.status === "approved"');
  expect(source).not.toMatch(/row\.(?:linearValue|decreasingValue) > row\.limit/u);
  expect(source).toContain(
    "if (directTable || annualMode) return;\n    const limit = result.context.maxInstallments;",
  );
});
