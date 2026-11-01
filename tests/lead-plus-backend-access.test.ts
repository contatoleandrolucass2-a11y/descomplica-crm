import { describe, expect, it } from "vitest";
import {
  operationPage,
  intersectPermissions,
  operationPermissions,
  intersectGranularPermissions,
} from "../lib/crm/lead-plus/server/access.mjs";
describe("LEAD+ canonical operation access", () => {
  it("maps each operational surface to its existing persisted page", () => {
    const cases = [
      ["/leads", "lista"],
      ["/leads/id/activities", "atividades"],
      ["/bucket", "funil"],
      ["/resources/queues", "distribuicao"],
      ["/analytics", "relatorios"],
      ["/imports", "importacao"],
      ["/integrations", "configuracoes"],
      ["/audit", "auditoria"],
    ];
    for (const [path, page] of cases)
      expect(operationPage(path!, "GET")).toBe("/app/leads/" + page);
    expect(operationPage("/demo/users", "POST")).toBeNull();
    expect(operationPage("/resources/invoices", "GET")).toBeNull();
  });
  it("intersects local permissions with host pages and never defaults to granting", () => {
    const permissions = ["leads.view", "leads.create", "reports.export", "admin.access", "unknown"];
    expect(intersectPermissions(permissions, [])).toEqual([]);
    expect(intersectPermissions(permissions, ["/app/leads/lista"])).toEqual([
      "leads.view",
      "leads.create",
    ]);
    expect(intersectPermissions(permissions, ["/app/leads/relatorios"])).toEqual([
      "reports.export",
    ]);
  });
});

it("requires canonical mutation and export grants independently from page visibility", () => {
  expect(operationPermissions("/leads", "POST")).toContain("crm.leads.create");
  expect(operationPermissions("/exports/leads", "GET")).toContain("crm.leads.reports.export");
  expect(operationPermissions("/unmapped", "PUT")).toBeNull();
  expect(
    intersectGranularPermissions(
      ["leads.view", "leads.create", "users.manage", "reports.export"],
      ["crm.leads.list.view"],
    ),
  ).toEqual(["leads.view"]);
});
