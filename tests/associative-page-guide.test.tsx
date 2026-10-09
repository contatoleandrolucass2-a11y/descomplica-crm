import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AssociativePageGuide } from "@/app/(protected)/app/simulacao/_components/archive-investor/AssociativePageGuide";
import { ASSOCIATIVE_PAGE_GUIDE_STEPS } from "@/app/(protected)/app/simulacao/_components/archive-investor/associative-page-guide-content";

describe("Associative page guide", () => {
  it("starts closed and never changes the proposal during rendering", () => {
    const onStart = vi.fn();
    const html = renderToStaticMarkup(
      <AssociativePageGuide rootRef={createRef<HTMLDivElement>()} onStart={onStart} />,
    );
    expect(html).toContain("Guia passo a passo");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('class="investor-guided-start"');
    expect(html).not.toContain('role="dialog"');
    expect(onStart).not.toHaveBeenCalled();
  });

  it("covers the stock, each financial input, results and the final actions", () => {
    expect(ASSOCIATIVE_PAGE_GUIDE_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "help",
      "filters",
      "sort",
      "inventory",
      "property",
      "missing-facts",
      "income",
      "modality",
      "first-property",
      "sale-discount",
      "financing",
      "subsidy",
      "fgts",
      "housing-check",
      "entry",
      "signals",
      "annuals",
      "balances",
      "installment-count",
      "dates",
      "ranking",
      "approval",
      "release",
      "adjustments",
      "linear",
      "decreasing",
      "schedule",
      "ready-proposal",
      "remuneration",
      "documentation",
      "manual",
      "documents",
      "print",
      "platforms",
      "finish",
    ]);
    for (const step of ASSOCIATIVE_PAGE_GUIDE_STEPS) {
      expect(step.title.trim()).not.toBe("");
      expect(step.description.trim()).not.toBe("");
      expect(step.selector.trim()).not.toBe("");
    }
  });

  it("does not promise bank approval, invent missing facts or send a proposal", () => {
    const descriptions = ASSOCIATIVE_PAGE_GUIDE_STEPS.map((step) => step.description).join(" ");
    expect(descriptions).toContain("nem muda valores");
    expect(descriptions).toContain("Use somente valores oficiais");
    expect(descriptions).toContain("não é aprovação bancária");
    expect(descriptions).toContain("não envia dados nem registra uma venda");
    expect(descriptions).toContain("uma única vez");
    expect(descriptions).toContain("término já é pós-obra");
  });
});
