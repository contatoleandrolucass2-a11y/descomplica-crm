import { describe, expect, it } from "vitest";
// @ts-expect-error CI script executed directly by Node.
import * as leadScope from "../scripts/ci/lead-pagination-scope.mjs";

const { classifyLeadPaginationImpact, classifyLeadPaginationPaths } = leadScope;

describe("isolated lead pagination SQL impact", () => {
  it.each([
    "lib/crm/lead-plus/server/postgres.mjs",
    "lib/crm/lead-plus/client/useLeadList.ts",
    "tests/lead-plus-pagination.postgres.mjs",
    "lib/authorization/enforce.ts",
    "pnpm-lock.yaml",
  ])("requires SQL evidence for %s", (file) => {
    expect(classifyLeadPaginationPaths([file])).toMatchObject({
      required: true,
      dependencies: [file],
    });
  });
  it("does not repeat operational SQL for a known shell or appointments CSS change", () => {
    expect(
      classifyLeadPaginationPaths([
        "app/(protected)/layout.tsx",
        "app/(protected)/app/etapas/_components/AppointmentsDashboard.module.css",
      ]),
    ).toMatchObject({ required: false });
  });
  it("consumes the shared candidate diff without consulting a second checkout", () => {
    const options = {
      event: "pull_request",
      base: "a".repeat(40),
      head: "b".repeat(40),
      cwd: "/not-a-repository",
    };
    const rawDiff = JSON.stringify({
      ...options,
      status: "ready",
      paths: ["docs/knowledge/ATUALIZACOES.md"],
    });
    expect(classifyLeadPaginationImpact({ ...options, rawDiff })).toMatchObject({
      required: false,
    });
    expect(
      classifyLeadPaginationImpact({ ...options, head: "c".repeat(40), rawDiff }),
    ).toMatchObject({ required: true, reason: "invalid-shared-diff" });
  });
  it("fails closed for unknown paths, invalid plans and unavailable history", () => {
    expect(
      classifyLeadPaginationImpact({
        rawDiff: JSON.stringify({
          event: null,
          base: null,
          head: null,
          status: "ready",
          paths: ["docs/knowledge/NOTE.md"],
        }),
      }),
    ).toMatchObject({ required: true, reason: "invalid-shared-diff" });
    expect(classifyLeadPaginationPaths(["new-runtime/unknown.mjs"])).toMatchObject({
      required: true,
    });
    expect(classifyLeadPaginationImpact({ rawDiff: "malformed" })).toMatchObject({
      required: true,
    });
    expect(classifyLeadPaginationImpact({ event: "push" })).toMatchObject({ required: true });
  });
});
