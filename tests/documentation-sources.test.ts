import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUINTO_REGISTRATION_TABLE } from "@/lib/archive-investor/documentation-sp-policy.mjs";
// @ts-expect-error -- Standalone JavaScript CLI also exposes its pure verifier.
import { verifyDocumentationSources } from "../scripts/verify-documentation-sources.mjs";

const hashing = vi.hoisted(() => {
  const digest = vi.fn();
  const update = vi.fn(() => ({ digest }));
  return { digest, update, createHash: vi.fn(() => ({ update })) };
});
vi.mock("node:crypto", () => ({ createHash: hashing.createHash }));

// The PDF contents are synthetic; this suite tests gate behavior, not live source availability.
const registryPdf = Buffer.from("synthetic registry publication");
const expectedPdfSha256 = "3db252fc16b72058f888ee6d0702ebdb4554503c7019b975eb763c3048439835";
const exemptionHtml = `
  <table><tbody>
    <tr><th>Período</th><th>Valor</th></tr>
    <tr><td><strong>A partir de&nbsp;01/01/2026</strong></td><td>R$&nbsp;245.527,77</td></tr>
    <tr><td>De 01/01/2025 a 31/12/2025</td><td>R$ 235.485,84</td></tr>
  </tbody></table>`;
const calculationHtml = `
  <table><tbody>
    <tr><th>Período</th><th>Financiamento</th><th>Imóvel</th></tr>
    <tr><td>A partir de 01/01/2026</td><td><span>R$ 120.968,00</span></td><td>R$ 725.808,00</td></tr>
    <tr><td>De 01/01/2025 a 31/12/2025</td><td>R$ 116.161,00</td><td>R$ 696.966,00</td></tr>
  </tbody></table>`;
const publishedMoney = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quintoRows = QUINTO_REGISTRATION_TABLE.map(([start, total], index, rows) => {
  const range =
    index === rows.length - 1
      ? ["acima de", publishedMoney(start - 0.01)]
      : [publishedMoney(start), "até", publishedMoney(rows[index + 1]![0] - 0.01)];
  return [`row${index}`, ...range, ...Array<string>(7).fill("0,00"), publishedMoney(total)];
});
function quintoPublication(rows = quintoRows) {
  return `<p>Data da vigência: 08/jan/2026</p><table><tbody><tr><th>Total</th></tr>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}
const quintoHtml = quintoPublication();
const input = { exemptionHtml, calculationHtml, registryPdf, quintoHtml, today: "2026-10-10" };
const fetch = vi.fn(() => {
  throw new Error("Network is forbidden in source-verifier unit tests");
});

beforeEach(() => {
  vi.clearAllMocks();
  hashing.digest.mockReturnValue(expectedPdfSha256);
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("documentation source verification gate", () => {
  it("parses current table rows with nested tags and nonbreaking whitespace", () => {
    expect(() => verifyDocumentationSources(input)).not.toThrow();
    expect(hashing.createHash).toHaveBeenCalledExactlyOnceWith("sha256");
    expect(hashing.update).toHaveBeenCalledExactlyOnceWith(registryPdf);
    expect(hashing.digest).toHaveBeenCalledExactlyOnceWith("hex");
  });

  it.each(["2026-01-01", "2026-12-31"])("accepts the policy boundary %s", (today) => {
    expect(() => verifyDocumentationSources({ ...input, today })).not.toThrow();
  });

  it.each(["2025-12-31", "2027-01-01"])("blocks dates outside verified policy %s", (today) => {
    expect(() => verifyDocumentationSources({ ...input, today })).toThrow(/Vigência vencida/);
    expect(hashing.createHash).not.toHaveBeenCalled();
  });

  it("blocks changed exemption limits", () => {
    expect(() =>
      verifyDocumentationSources({
        ...input,
        exemptionHtml: exemptionHtml.replace("245.527,77", "245.527,78"),
      }),
    ).toThrow(/limite publicado de isenção mudou/);
  });

  it("rejects a larger value containing the expected exemption as a substring", () => {
    expect(() =>
      verifyDocumentationSources({
        ...input,
        exemptionHtml: exemptionHtml.replace("245.527,77", "1.245.527,77"),
      }),
    ).toThrow(/limite publicado de isenção mudou/);
    expect(hashing.createHash).not.toHaveBeenCalled();
  });

  it.each([
    ["120.968,00", "120.968,01"],
    ["725.808,00", "725.808,01"],
  ])("blocks a changed calculation limit %s", (before, after) => {
    expect(() =>
      verifyDocumentationSources({
        ...input,
        calculationHtml: calculationHtml.replace(before, after),
      }),
    ).toThrow(/limites publicados de ITBI mudaram/);
  });

  it.each(["exemptionHtml", "calculationHtml"] as const)(
    "rejects a new effective year even if the old row remains in %s",
    (field) => {
      const updated = input[field].replace(
        "<tbody>",
        "<tbody><tr><td>A partir de 01/01/2027</td><td>Nova tabela</td></tr>",
      );
      expect(() => verifyDocumentationSources({ ...input, [field]: updated })).toThrow(
        /vigência publicada/,
      );
    },
  );

  it.each(["exemptionHtml", "calculationHtml"] as const)(
    "rejects missing tables instead of accepting values in unrelated prose: %s",
    (field) => {
      expect(() =>
        verifyDocumentationSources({
          ...input,
          [field]: "<p>A partir de 01/01/2026 R$ 245.527,77 R$ 120.968,00 R$ 725.808,00</p>",
        }),
      ).toThrow(/vigência publicada/);
    },
  );

  it("blocks a changed PDF hash while preserving matching ITBI tables", () => {
    hashing.digest.mockReturnValue("0".repeat(64));
    expect(() => verifyDocumentationSources(input)).toThrow(/publicação ARISP mudou/);
    expect(hashing.update).toHaveBeenCalledExactlyOnceWith(registryPdf);
  });

  it("requires the 5th registry publication even when all other sources match", () => {
    const missing: Partial<typeof input> = { ...input };
    delete missing.quintoHtml;
    expect(() => verifyDocumentationSources(missing)).toThrow(/5º RI não foi fornecida/);
  });

  it("rejects a changed 5th registry effective date", () => {
    expect(() =>
      verifyDocumentationSources({
        ...input,
        quintoHtml: quintoHtml.replace("08/jan/2026", "08/jan/2027"),
      }),
    ).toThrow(/vigência publicada do 5º RI mudou/);
  });

  it.each([
    [0, 1, "0,02", /Início da faixa 1/],
    [0, 3, "2.306,01", /Fim da faixa 1/],
    [0, 11, "260,40", /Total da faixa 1/],
    [47, 2, "142.154.000,01", /Início da faixa 48/],
    [47, 10, "234.138,13", /Total da faixa 48/],
  ] as const)("rejects changed 5th registry row %s cell %s", (row, cell, value, error) => {
    const changed = structuredClone(quintoRows);
    changed[row]![cell] = value;
    expect(() =>
      verifyDocumentationSources({ ...input, quintoHtml: quintoPublication(changed) }),
    ).toThrow(error);
  });

  it.each([
    { count: 47, rows: quintoRows.slice(0, -1) },
    { count: 49, rows: [...quintoRows, quintoRows[0]!] },
  ])("rejects $count registry brackets instead of exactly 48", ({ rows }) => {
    expect(() =>
      verifyDocumentationSources({ ...input, quintoHtml: quintoPublication(rows) }),
    ).toThrow(/48 faixas/);
  });

  it("does not accept a matching later table when the first published table changed", () => {
    expect(() =>
      verifyDocumentationSources({
        ...input,
        quintoHtml: `<table><tr><th>Outra tabela</th></tr></table>${quintoHtml}`,
      }),
    ).toThrow(/48 faixas/);
  });
});
