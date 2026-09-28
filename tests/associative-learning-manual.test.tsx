import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestorLearningManual } from "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator";

describe("Associative learning manual", () => {
  it("renders accessible tabs with stable anchors and all contents before interaction", () => {
    const html = renderToStaticMarkup(<InvestorLearningManual associative />);
    expect(html).toContain('role="tablist"');
    for (const key of ["policy", "faq"]) {
      expect(html).toContain(`id="investor-associative-learning-${key}"`);
      expect(html).toContain(`aria-controls="investor-associative-learning-${key}"`);
      expect(html).toContain(`aria-labelledby="investor-associative-learning-${key}-tab"`);
    }
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toMatch(
      /id="investor-associative-learning-policy-tab"[^>]*aria-selected="true"[^>]*tabindex="0"/,
    );
    expect(html).toMatch(
      /id="investor-associative-learning-faq-tab"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    );
    expect(html).toMatch(/id="investor-associative-learning-faq"[^>]*hidden=""/);
    expect(html).toContain("Resumo da simulação");
    expect(html).toContain("Checklist antes de apresentar");
    expect(html).toContain("Fontes oficiais");
    expect(html.match(/<details>/g)?.length).toBeGreaterThan(10);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it.each([{ directTable: true }, {}])("keeps the other manuals unchanged: %j", (props) => {
    const html = renderToStaticMarkup(<InvestorLearningManual {...props} />);
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("investor-documentation-dialog investor-learning-dialog");
    expect(html).toContain("Fechar manual");
  });
});
