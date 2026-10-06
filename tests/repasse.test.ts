import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lookupRepasseByFid, RepasseSourceError } from "@/lib/crm/repasse/data";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
const serviceAccountPrivateKey = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const expectedHeaders = ["FID", "EMPREENDIMENTO", "ETAPA", "STATUS", "NOME CLIENTE", "MOTIVO"];

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function configureSource(options?: {
  fidRows?: Array<Array<string | number>>;
  recordRows?: Array<Array<string | number>>;
  verificationFidRows?: Array<Array<string | number>>;
  headers?: string[];
}) {
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(init).toMatchObject({ cache: "no-store", redirect: "error" });

    if (url.origin === "https://oauth2.googleapis.com") {
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).not.toContain(serviceAccountPrivateKey);
      return Promise.resolve(
        jsonResponse({
          access_token: "synthetic-access-token",
          expires_in: 3_600,
          token_type: "Bearer",
        }),
      );
    }

    expect(url.origin).toBe("https://sheets.googleapis.com");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer synthetic-access-token" });
    const ranges = url.searchParams.getAll("ranges");
    if (ranges[0] === "'Table 1'!A1:F2") {
      expect(ranges).toEqual(["'Table 1'!A1:F2", "'Table 1'!A3:A"]);
      return Promise.resolve(
        jsonResponse({
          valueRanges: [
            {
              range: "'Table 1'!A1:F2",
              majorDimension: "ROWS",
              values: [
                ["Relatório CCA - Assinatura - DATA DA ÚLTIMA ATUALIZAÇÃO: 06/10/2026"],
                options?.headers ?? expectedHeaders,
              ],
            },
            {
              range: "'Table 1'!A3:A",
              majorDimension: "ROWS",
              values: options?.fidRows ?? [],
            },
          ],
        }),
      );
    }

    expect(ranges).toEqual(["'Table 1'!A3:A", "'Table 1'!A3:F3"]);
    return Promise.resolve(
      jsonResponse({
        valueRanges: [
          {
            range: "'Table 1'!A3:A",
            majorDimension: "ROWS",
            values: options?.verificationFidRows ?? options?.fidRows ?? [],
          },
          {
            range: "'Table 1'!A3:F3",
            majorDimension: "ROWS",
            values: options?.recordRows ?? [],
          },
        ],
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("REPASSE_GOOGLE_SERVICE_ACCOUNT_EMAIL", "repasse-reader@example.invalid");
  vi.stubEnv(
    "REPASSE_GOOGLE_PRIVATE_KEY_BASE64",
    Buffer.from(serviceAccountPrivateKey).toString("base64"),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("consulta protegida de repasse", () => {
  it("consulta somente a linha do FID exato e projeta o registro mínimo", async () => {
    const fetchMock = configureSource({
      fidRows: [[123456]],
      recordRows: [
        [
          123456,
          "Residencial Exemplo",
          "Assinatura de contrato",
          "Repassado",
          "Cliente Sintético",
          "Repasse concluído.",
        ],
      ],
    });

    await expect(lookupRepasseByFid("123456")).resolves.toEqual({
      status: "ready",
      lastUpdated: "06/10/2026",
      record: {
        empreendimento: "Residencial Exemplo",
        etapa: "Assinatura de contrato",
        status: "Repassado",
        nomeCliente: "Cliente Sintético",
        motivo: "Repasse concluído.",
      },
    });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("A3%3AF3"))).toBe(true);
  });

  it("distingue FID inexistente de duplicidade sem carregar colunas pessoais", async () => {
    let fetchMock = configureSource();
    await expect(lookupRepasseByFid("123456")).resolves.toEqual({
      status: "not_found",
      lastUpdated: "06/10/2026",
    });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("A3%3AF3"))).toBe(false);

    vi.unstubAllGlobals();
    fetchMock = configureSource({ fidRows: [[123456], [123456]] });
    await expect(lookupRepasseByFid("123456")).resolves.toEqual({
      status: "conflict",
      lastUpdated: "06/10/2026",
    });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("A3%3AF3"))).toBe(false);
  });

  it("rejeita entrada fora do contrato antes de acessar a fonte", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupRepasseByFid("123456 or 1=1")).rejects.toBeInstanceOf(RepasseSourceError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa fixture sintética somente com aplicação e Supabase simultaneamente em loopback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AUTH_LOCAL_INSECURE_LOOPBACK_QA", "true");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");

    await expect(lookupRepasseByFid("900000000001")).resolves.toMatchObject({
      status: "ready",
      record: { nomeCliente: "Cliente Sintético" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha fechado quando o cabeçalho da planilha muda", async () => {
    configureSource({
      fidRows: [[123456]],
      headers: ["FID", "ETAPA", "EMPREENDIMENTO", "STATUS", "NOME CLIENTE", "MOTIVO"],
    });

    await expect(lookupRepasseByFid("123456")).rejects.toBeInstanceOf(RepasseSourceError);
  });

  it("revalida unicidade e FID antes de associar as colunas pessoais", async () => {
    configureSource({
      fidRows: [[123456]],
      verificationFidRows: [[654321]],
      recordRows: [[654321, "Outro", "Etapa", "Pendente", "Outro cliente", "Outro motivo"]],
    });

    await expect(lookupRepasseByFid("123456")).rejects.toBeInstanceOf(RepasseSourceError);
  });

  it("mantém autorização, marca da assessoria e estados acessíveis na página", () => {
    const page = readFileSync(
      new URL("../app/(protected)/app/repasse/page.tsx", import.meta.url),
      "utf8",
    );
    const component = readFileSync(
      new URL("../app/(protected)/app/repasse/RepasseLookup.tsx", import.meta.url),
      "utf8",
    );
    const action = readFileSync(
      new URL("../app/(protected)/app/repasse/actions.ts", import.meta.url),
      "utf8",
    );

    expect(page).toContain('await enforcePermission("crm.partnerships.view")');
    expect(page).toContain('getProtectedPageGate("/app/repasse")?.releaseEnabled');
    expect(action).toContain('await requirePermission("crm.partnerships.view")');
    expect(action).toContain("gate?.releaseEnabled !== true");
    expect(component).toContain("M.A.P DE CAMPOS SOLUÇÕES");
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("aria-invalid={invalid}");
    const qa = readFileSync(new URL("../scripts/qa/repasse.mjs", import.meta.url), "utf8");
    for (const viewport of [
      "375, height: 812",
      "768, height: 1024",
      "1024, height: 768",
      "1440, height: 900",
    ]) {
      expect(qa).toContain(viewport);
    }
    for (const theme of ['"light"', '"balanced"', '"dark"']) expect(qa).toContain(theme);
    expect(qa).toContain('withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])');
    expect(qa).toContain("await document.fonts.ready");
    expect(qa).toContain("stableSamples >= 2");
    expect(qa).toContain("requestAnimationFrame(sample)");
    expect(qa).toContain("document.documentElement.scrollWidth > innerWidth + 1");
  });
});
