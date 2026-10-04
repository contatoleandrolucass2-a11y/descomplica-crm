import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type Rule = {
  selector: string;
  parent: { name?: string; params?: string };
  nodes: { prop?: string; value?: string; important?: boolean }[];
};
const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
  parse: (source: string) => { walkRules: (callback: (rule: Rule) => void) => void };
};
const source = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
    import.meta.url,
  ),
  "utf8",
);
const rules: Rule[] = [];
parse(source).walkRules((rule) => rules.push(rule));
const values = (rule: Rule) =>
  Object.fromEntries(
    rule.nodes.filter((node) => node.prop).map(({ prop, value }) => [prop!, value]),
  );
const scope = ".investor-page-shell.investor-associative-table-page";

describe("Associative decorative effects boundaries", () => {
  it("sweeps the entire pending area behind content without intercepting input", () => {
    const animated = rules.filter((rule) =>
      values(rule).animation?.startsWith("associative-pending-shine "),
    );
    expect(animated).toHaveLength(4);
    for (const rule of animated) {
      expect(rule.selector).toContain(scope);
      const style = values(rule);
      expect(style.animation).toBe("associative-pending-shine 4.5s ease-in-out infinite");
      expect(style["background-size"]).toBe("280% 100%");
      expect(style.background ?? style["background-image"]).toBe(
        "var(--associative-pending-sheen)",
      );
      if (rule.selector.includes("::after") && !rule.selector.includes("question.current")) {
        expect(style["pointer-events"]).toBe("none");
        expect(style["z-index"]).toBe("0");
      }
    }
  });

  it("keeps rejection separate at three seconds", () => {
    const rejection = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-rejection-shine "),
    );
    expect(rejection?.selector).toContain("footer.rejected::after");
    expect(values(rejection!).animation).toBe(
      "associative-rejection-shine 3s ease-in-out infinite",
    );
  });

  it("gives enabled buttons and radio labels a masked rim without changing geometry", () => {
    const active = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-specular-orbit "),
    );
    expect(active?.selector).toContain(scope);
    for (const state of [
      ":hover",
      ":focus-visible",
      ":has(input:focus-visible)",
      ":not(:disabled)",
      ':not([aria-disabled="true"])',
      ":not(:has(input:disabled))",
    ])
      expect(active?.selector).toContain(state);
    const rim = rules.find((rule) => values(rule)["mask-composite"] === "exclude");
    expect(rim?.selector).toContain(scope);
    expect(values(rim!)).toMatchObject({
      position: "absolute",
      inset: "0",
      "pointer-events": "none",
      opacity: "0",
    });
    expect(values(rim!).transform).toBeUndefined();
    expect(values(rim!).scale).toBeUndefined();
  });

  it("disables decorative motion while retaining a visible keyboard focus", () => {
    const reduced = rules.filter(
      (rule) => rule.parent.params === "(prefers-reduced-motion: reduce)",
    );
    const pending = reduced.find(
      (rule) =>
        rule.selector.startsWith(scope) && rule.selector.includes("question.current::after"),
    );
    expect(values(pending!)).toMatchObject({ animation: "none", "background-image": "none" });
    const specular = reduced.find(
      (rule) =>
        rule.selector.startsWith(scope) &&
        rule.selector.includes("payment-actions-bar") &&
        rule.selector.endsWith("::before"),
    );
    expect(values(specular!).animation).toBe("none");
    const label = rules.find(
      (rule) =>
        rule.selector ===
        `${scope} .investor-associative-compact-account li:has(input:focus-visible) .investor-direct-step-name strong`,
    );
    expect(values(label!)).toMatchObject({
      "text-decoration": "none",
      "font-weight": "700",
      color: "var(--inv-color-accent)",
    });
    expect(label?.nodes.find((node) => node.prop === "font-weight")?.important).toBe(true);
  });
});
