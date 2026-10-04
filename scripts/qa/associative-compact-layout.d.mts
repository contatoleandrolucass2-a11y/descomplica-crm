import type { Locator, Page } from "@playwright/test";
import type { AssociativeCommissionGeometry } from "./associative-guidance.mjs";

export {
  assertAssociativeCommissionGeometry,
  assertAssociativeSummaryGaps,
  assertAssociativeWorkspaceGaps,
} from "./associative-guidance.mjs";

export function checkAssociativeCommissionGeometry(
  commission: Locator,
): Promise<AssociativeCommissionGeometry>;
export function checkAssociativeSelectedGoldPaint(page: Page): Promise<void>;
