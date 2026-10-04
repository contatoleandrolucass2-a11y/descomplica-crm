import type { Locator, Page } from "@playwright/test";
import type { assertAssociativeCommissionGeometry } from "./associative-guidance.mjs";

export {
  assertAssociativeCommissionGeometry,
  assertAssociativeSummaryGaps,
  assertAssociativeWorkspaceGaps,
} from "./associative-guidance.mjs";

export function checkAssociativeCommissionGeometry(
  commission: Locator,
): Promise<Parameters<typeof assertAssociativeCommissionGeometry>[0]>;
export function checkAssociativeSelectedGoldPaint(page: Page): Promise<void>;
