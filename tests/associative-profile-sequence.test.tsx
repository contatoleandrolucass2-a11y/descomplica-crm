import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React, { type ReactElement, type ReactNode } from "react";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type Modality = "MCMV" | "SBPE";
type Decision = {
  effectiveModality: Modality | null;
  forced: boolean;
  reasonCodes: string[];
  mcmvRangeLabel: string | null;
};
const { evaluateFinancingModality, moneyToCents } = createRequire(import.meta.url)(
  "../lib/archive-investor/financing-modality-rules.mjs",
) as {
  evaluateFinancingModality: (input: {
    familyIncomeCents: number | null;
    propertyValueCents: number;
    firstProperty: string | null;
    manualPreference: Modality | null;
  }) => Decision;
  moneyToCents: (value: string) => number | null;
};

const source = ts.createSourceFile(
  "InvestorCalculator.tsx",
  readFileSync(
    new URL(
      "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const functions = new Map<string, string>();
const expressions = new Map<string, string>();
const visit = (node: ts.Node) => {
  if (ts.isFunctionDeclaration(node) && node.name)
    functions.set(node.name.text, node.getText(source));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
    expressions.set(node.name.text, node.initializer.getText(source));
  ts.forEachChild(node, visit);
};
visit(source);

const compiledSources = new Map<string, string>();
function compile<T>(code: string, dependencies: Record<string, unknown>): T {
  let compiled = compiledSources.get(code);
  if (!compiled) {
    compiled = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.None,
      },
    }).outputText;
    compiledSources.set(code, compiled);
  }
  return new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies)) as T;
}

function load<T>(name: string, dependencies: Record<string, unknown> = {}): T {
  const declaration = functions.get(name);
  if (!declaration) throw new Error(`Missing production function: ${name}`);
  return compile<T>(`${declaration}\nreturn ${name};`, dependencies);
}

function expression<T>(name: string, dependencies: Record<string, unknown>): T {
  const value = expressions.get(name);
  if (!value) throw new Error(`Missing production expression: ${name}`);
  return compile<T>(`return (${value});`, dependencies);
}

type Element = ReactElement<Record<string, unknown>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

// Execute the actual internal panel and handlers, without loading inventory/network or duplicating UI gates.
function harness() {
  const state = {
    income: "",
    preference: null as Modality | null,
    confirmed: false,
    firstProperty: "",
    rank: "",
  };
  let blockedAttempt = false;
  const currencyInputNumber = load<(value: string) => number>("currencyInputNumber");
  const render = () => {
    const decision = evaluateFinancingModality({
      familyIncomeCents: moneyToCents(state.income),
      propertyValueCents: 23_000_000,
      firstProperty: state.firstProperty || null,
      manualPreference: state.preference,
    });
    const incomeReady = expression<boolean>("associativeIncomeReady", {
      currencyInputNumber,
      income: state.income,
    });
    const modalityReady = expression<boolean>("associativeFinancingModalityReady", {
      associativeIncomeReady: incomeReady,
      associativeModalityConfirmed: state.confirmed,
      associativeFinancingModality: decision.effectiveModality ?? "",
    });
    const dependencies = {
      income: state.income,
      moneyToCents,
      currencyInputNumber,
      associativeIncomeReady: incomeReady,
      associativeFinancingModalityReady: modalityReady,
      associativeFinancingDecision: decision,
      associativeManualModalityPreference: state.preference,
      updateIncome: (value: string) => {
        state.income = value;
      },
      setAssociativeManualModalityPreference: (value: Modality | null) => {
        state.preference = value;
      },
      setAssociativeModalityConfirmed: (value: boolean) => {
        state.confirmed = value;
      },
      setAssociativeFirstProperty: (value: string) => {
        state.firstProperty = value;
      },
      setAssociativeApprovalTier: (value: string) => {
        state.rank = value;
      },
      window: { setTimeout: vi.fn() },
    };
    const actions = {
      income: load<(value: string) => void>("updateAssociativeIncome", dependencies),
      modality: load<(value: string) => void>("updateAssociativeModality", dependencies),
      firstProperty: load<(value: string) => void>("updateAssociativeFirstProperty", dependencies),
    };
    const Panel = load<(props: Record<string, unknown>) => ReactNode>(
      "AssociativeQualificationPanel",
      {
        React,
        currencyInputNumber,
        useState: () => [
          blockedAttempt,
          (value: boolean) => {
            blockedAttempt = value;
          },
        ],
        municipalHousingBand: load("municipalHousingBand"),
        municipalHousingPriceLimit: load("municipalHousingPriceLimit"),
        associativeModalityMessage: load("associativeModalityMessage"),
        money: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
        InvestorInfoHint: "span",
        MoneyInput: "input",
        ASSOCIATIVE_PROFILE_HELP: { income: {}, modality: {}, firstProperty: {} },
      },
    );
    const nodes = elements(
      Panel({
        income: state.income,
        modality: decision.effectiveModality ?? "",
        modalityConfirmed: state.confirmed,
        modalityDecision: decision,
        firstProperty: state.firstProperty,
        guided: false,
        sectionRef: null,
        incomeInputRef: null,
        onIncomeChange: actions.income,
        onModalityChange: actions.modality,
        onFirstPropertyChange: actions.firstProperty,
      }),
    );
    return { nodes, actions, decision };
  };
  const changeIncome = (value: string) => {
    const input = render().nodes.find(
      (node) => node.type === "input" && node.props.label === "Renda Familiar",
    );
    (input?.props.onChange as (value: string) => void)(value);
  };
  const confirm = (value: Modality) => {
    const button = render().nodes.find(
      (node) =>
        node.type === "button" &&
        React.Children.toArray(node.props.children as ReactNode)[0] === value,
    );
    (button?.props.onClick as () => void)();
  };
  const firstProperty = (value: string) => {
    const input = render().nodes.find(
      (node) => node.type === "input" && node.props.type === "radio" && node.props.value === value,
    );
    expect(input?.props.disabled).toBe(false);
    (input?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value },
    });
  };
  const step = (expected: number | null) => {
    const nodes = render().nodes;
    const cards = nodes.filter((node) =>
      String(node.props.className).split(/\s/u).includes("investor-associative-question"),
    );
    expect(cards).toHaveLength(3);
    expect(cards.filter((card) => card.props["aria-current"] === "step")).toHaveLength(
      expected === null ? 0 : 1,
    );
    expect(
      cards.filter((card) => String(card.props.className).split(/\s/u).includes("current")),
    ).toHaveLength(expected === null ? 0 : 1);
    if (expected !== null) expect(cards[expected - 1]?.props["aria-current"]).toBe("step");
    const radios = nodes.filter((node) => node.type === "input" && node.props.type === "radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) expect(radio.props.disabled).toBe(expected === 1 || expected === 2);
  };
  return { state, render, changeIncome, confirm, firstProperty, step };
}

describe("Associativo profile confirmation sequence", () => {
  it.each(["8000.00", "14000.00"])(
    "never skips modality confirmation with automatic income decision %s",
    (income) => {
      const profile = harness();
      profile.step(1);
      profile.confirm("SBPE");
      profile.step(1);
      expect(profile.state.confirmed).toBe(false);
      profile.changeIncome(income);
      expect(profile.render().decision.effectiveModality).toBeTruthy();
      profile.step(2);
      profile.render().actions.firstProperty("SIM");
      expect(profile.state.firstProperty).toBe("");
      profile.step(2);
      profile.confirm("SBPE");
      profile.step(3);
      profile.firstProperty("SIM");
      profile.step(null);
    },
  );

  it("does not confirm unavailable MCMV when the engine forces SBPE", () => {
    const profile = harness();
    profile.changeIncome("14000.00");
    expect(profile.render().decision.forced).toBe(true);
    profile.confirm("MCMV");
    profile.step(2);
    expect(profile.state.confirmed).toBe(false);
    expect(profile.state.preference).toBeNull();
    profile.confirm("SBPE");
    profile.step(3);
  });

  it("resets confirmation, first property and ranking only when the income amount changes", () => {
    const profile = harness();
    profile.changeIncome("8000.00");
    profile.confirm("SBPE");
    profile.firstProperty("SIM");
    profile.state.rank = "gold";
    profile.changeIncome("8.000,00");
    profile.step(null);
    expect(profile.state.rank).toBe("gold");
    expect(profile.state.preference).toBe("SBPE");
    profile.changeIncome("8000.01");
    profile.step(2);
    expect(profile.state).toMatchObject({
      confirmed: false,
      preference: null,
      firstProperty: "",
      rank: "",
    });
    profile.confirm("SBPE");
    profile.step(3);
    profile.firstProperty("SIM");
    profile.changeIncome("");
    profile.step(1);
    expect(profile.state).toMatchObject({
      confirmed: false,
      preference: null,
      firstProperty: "",
      rank: "",
    });
  });
});
