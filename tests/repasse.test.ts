import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupRepasseByFid, RepasseSourceError } from "@/lib/crm/repasse/data";

const expectedHeaders = ["FID", "EMPREENDIMENTO", "ETAPA", "STATUS", "NOME CLIENTE", "MOTIVO"];

function csvResponse(rows: Array<Array<string | number>>, init?: ResponseInit) {
  const body = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8" },
    ...init,
  });
}

function configureSource(options?: {
  fidRows?: Array<Array<string | number>>;
  recordRows?: Array<Array<string | number>>;
  verificationFidRows?: Array<Array<string | number>>;
  headers?: string[];
  responseBody?: string;
  responseContentType?: string;
}) {
  let fidReadCount = 0;
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://docs.google.com");
    expect(url.pathname).toBe(
      "/spreadsheets/d/1v0ST25OQrtd_LUXfGnX_9AI7GqNSQghADFzrE6k1DeE/gviz/tq",
    );
    expect(url.searchParams.get("tqx")).toBe("out:csv");
    expect(url.searchParams.get("gid")).toBe("798117742");
    expect(url.searchParams.get("headers")).toBe("0");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", redirect: "error" });
    const headers = new Headers(init?.headers);
    expect(headers.get("accept")).toBe("text/csv");
    expect(headers.has("authorization")).toBe(false);

    if (options?.responseBody !== undefined) {
      return Promise.resolve(
        new Response(options.responseBody, {
          status: 200,
          headers: { "content-type": options.responseContentType ?? "text/csv" },
        }),
      );
    }

    const range = url.searchParams.get("range");
    if (range === "A1:F2") {
      return Promise.resolve(
        csvResponse([
          [
            "Relatório CCA - Assinatura - DATA DA ÚLTIMA ATUALIZAÇÃO: 06/10/2026",
            "",
            "",
            "",
            "",
            "",
          ],
          options?.headers ?? expectedHeaders,
        ]),
      );
    }
    if (range === "A3:A") {
      fidReadCount += 1;
      const rows =
        fidReadCount > 1
          ? (options?.verificationFidRows ?? options?.fidRows ?? [])
          : (options?.fidRows ?? []);
      return Promise.resolve(csvResponse(rows));
    }
    expect(range).toMatch(/^A\d+:F\d+$/u);
    return Promise.resolve(csvResponse(options?.recordRows ?? []));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("consulta protegida de repasse", () => {
  it("consulta somente a linha do FID exato e projeta CSV formatado", async () => {
    const fetchMock = configureSource({
      fidRows: [[123456]],
      recordRows: [
        [
          123456,
          "Residencial, Exemplo",
          "Assinatura de contrato",
          "Repassado",
          'Cliente "Sintético"',
          "Repasse concluído.\nDocumentação validada.",
        ],
      ],
    });

    await expect(lookupRepasseByFid("123456")).resolves.toEqual({
      status: "ready",
      lastUpdated: "06/10/2026",
      record: {
        empreendimento: "Residencial, Exemplo",
        etapa: "Assinatura de contrato",
        status: "Repassado",
        nomeCliente: 'Cliente "Sintético"',
        motivo: "Repasse concluído.\nDocumentação validada.",
      },
    });
    expect(
      fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("range")),
    ).toEqual(["A1:F2", "A3:A", "A3:A", "A3:F3"]);
  });

  it("distingue FID inexistente de duplicidade sem carregar colunas pessoais", async () => {
    let fetchMock = configureSource();
    await expect(lookupRepasseByFid("123456")).resolves.toEqual({
      status: "not_found",
      lastUpdated: "06/10/2026",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          new URL(String(input)).searchParams.get("range")?.includes(":F") &&
          new URL(String(input)).searchParams.get("range") !== "A1:F2",
      ),
    ).toBe(false);

    vi.unstubAllGlobals();
    fetchMock = configureSource({ fidRows: [[123456], [123456]] });
    await expect(lookupRepasseByFid("123456")).resolves.toEqual({
      status: "conflict",
      lastUpdated: "06/10/2026",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("rejeita resposta pública que não seja CSV", async () => {
    configureSource({
      responseBody: "<html>indisponível</html>",
      responseContentType: "text/html",
    });

    await expect(lookupRepasseByFid("123456")).rejects.toBeInstanceOf(RepasseSourceError);
  });

  it("rejeita CSV malformado e resposta acima do limite", async () => {
    configureSource({
      responseBody: '"campo sem fechamento',
    });
    await expect(lookupRepasseByFid("123456")).rejects.toBeInstanceOf(RepasseSourceError);

    vi.unstubAllGlobals();
    configureSource({
      responseBody: "x".repeat(200_001),
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
    const source = readFileSync(new URL("../lib/crm/repasse/data.ts", import.meta.url), "utf8");

    expect(page).toContain('await enforcePermission("crm.partnerships.view")');
    expect(page).toContain('getProtectedPageGate("/app/repasse")?.releaseEnabled');
    expect(action).toContain('await requirePermission("crm.partnerships.view")');
    expect(action).toContain("gate?.releaseEnabled !== true");
    expect(source).toContain('GOOGLE_SHEETS_PUBLIC_ORIGIN = "https://docs.google.com"');
    expect(source).toContain('url.searchParams.set("headers", "0")');
    expect(source).not.toContain("REPASSE_GOOGLE_");
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
