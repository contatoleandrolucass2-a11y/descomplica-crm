import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone QA module runs directly with Node.
import * as visualRouteScope from "../scripts/qa/visual-route-scope.mjs";

const { authenticatedVisualRoutes, selectVisualRoutes } = visualRouteScope;

describe("authenticated visual route selection", () => {
  it("uses every protected route when no focused scope is provided", () => {
    expect(selectVisualRoutes()).toEqual(authenticatedVisualRoutes);
    expect(selectVisualRoutes()).not.toBe(authenticatedVisualRoutes);
  });

  it("keeps canonical order for a valid focused scope", () => {
    expect(selectVisualRoutes(JSON.stringify(["/app/ranking", "/app"]))).toEqual([
      "/app",
      "/app/ranking",
    ]);
  });

  it.each(["not-json", "[]", JSON.stringify(["/unknown"]), JSON.stringify(["/app", "/app"])])(
    "fails closed for invalid focused scope %s",
    (raw) => {
      expect(() => selectVisualRoutes(raw)).toThrow(/QA_VISUAL_ROUTES/);
    },
  );
});
