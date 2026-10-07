import { describe, expect, it } from "vitest";

// @ts-expect-error -- QA module is JavaScript without a declaration file.
import { isExpectedInventoryUnavailableConsoleError } from "../scripts/qa/associative-calculation-continuity.mjs";

const origin = "http://127.0.0.1:3000";
const expectedText =
  "Failed to load resource: the server responded with a status of 503 (Service Unavailable)";

const message = ({
  type = "error",
  url = `${origin}/api/inventory`,
  text = expectedText,
} = {}) => ({
  type: () => type,
  location: () => ({ url }),
  text: () => text,
});

describe("Associative synthetic unavailable response", () => {
  it("recognizes only the exact browser error for the injected response", () => {
    expect(isExpectedInventoryUnavailableConsoleError(message(), origin)).toBe(true);
  });

  it.each([
    { type: "warning" },
    { url: `${origin}/api/inventory/snapshot` },
    { url: `${origin}/api/inventory?other=true` },
    { url: "https://external.invalid/api/inventory" },
    { url: "" },
    { text: "Uncaught TypeError: inventory failed" },
    { text: expectedText.replace("503", "500") },
    { text: expectedText.replace("503", "401") },
    { text: "Failed to fetch" },
    { text: `${expectedText} unexpected detail` },
  ])("does not exempt unrelated browser errors: %j", (changes) => {
    expect(isExpectedInventoryUnavailableConsoleError(message(changes), origin)).toBe(false);
  });
});
