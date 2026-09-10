import { describe, expect, it } from "vitest";
// @ts-expect-error — módulo de regras compartilhado com o componente legado em JavaScript.
import * as associativeDocumentationAdapter from "@/lib/archive-investor/associative-documentation-adapter.mjs";

const { resolveAssociativeAppraisal } = associativeDocumentationAdapter;

describe("resolveAssociativeAppraisal", () => {
  it("sempre prioriza a avaliação oficial da unidade", () => {
    expect(resolveAssociativeAppraisal(340_000, 999_999)).toBe(340_000);
  });

  it("aceita preenchimento manual somente quando a fonte oficial não traz avaliação", () => {
    expect(resolveAssociativeAppraisal(null, 350_000)).toBe(350_000);
    expect(resolveAssociativeAppraisal(0, 350_000)).toBe(350_000);
  });

  it("não aceita valores ausentes, inválidos ou negativos", () => {
    expect(resolveAssociativeAppraisal(undefined, undefined)).toBe(0);
    expect(resolveAssociativeAppraisal(Number.NaN, "inválido")).toBe(0);
    expect(resolveAssociativeAppraisal(-1, -2)).toBe(0);
  });
});
