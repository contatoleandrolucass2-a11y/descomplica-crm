import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ held: "", enforce: vi.fn() }));
vi.mock("@/lib/authorization/enforce", () => ({ enforceAnyPermission: mocks.enforce }));
import AppLayout from "@/app/(protected)/app/layout";

beforeEach(() => {
  mocks.enforce.mockImplementation(async (permissions: readonly string[]) => {
    if (!permissions.includes(mocks.held)) throw new Error("FORBIDDEN");
  });
});

describe("independent commercial page entry", () => {
  it.each([
    "crm.management.routine.view",
    "crm.management.forecast.view",
    "crm.management.view",
    "crm.stage.sales.view",
    "crm.settings.goals.view",
    "crm.repasse.view",
  ])("allows a single page permission through the shared layout: %s", async (permission) => {
    mocks.held = permission;
    expect(await AppLayout({ children: "Authorized page" })).toBe("Authorized page");
  });

  it("still rejects a user without a commercial page permission", async () => {
    mocks.held = "pages.view";
    await expect(AppLayout({ children: "Denied page" })).rejects.toThrow("FORBIDDEN");
  });
});
