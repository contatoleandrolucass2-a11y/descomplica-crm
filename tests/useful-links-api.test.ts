import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/useful-links/[slug]/route";
import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { createDefaultUsefulLinksDocument } from "@/lib/crm/useful-links/document";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), get: vi.fn(), save: vi.fn() }));

vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/crm/useful-links/server", () => ({
  getUsefulLinksDocument: mocks.get,
  saveUsefulLinksDocument: mocks.save,
}));

const page = usefulLinksPages.find(({ slug }) => slug === "grupos-whatsapp")!;
const document = createDefaultUsefulLinksDocument(page);
const context = { params: Promise.resolve({ slug: page.slug }) };

function request(method: string, value?: unknown, origin = "https://crm.test") {
  return new Request(`https://crm.test/api/useful-links/${page.slug}`, {
    method,
    headers: value === undefined ? { origin } : { origin, "content-type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://crm.test");
  mocks.authorize.mockResolvedValue({ ok: true, context: { roleKey: "master" } });
  mocks.get.mockResolvedValue({ data: null, error: null });
  mocks.save.mockResolvedValue({ data: { ...document, revision: 1 }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("API de conteúdo compartilhado de Links Úteis", () => {
  it("permite leitura da página e informa edição apenas a administradores", async () => {
    mocks.authorize.mockResolvedValueOnce({ ok: true, context: { roleKey: "broker_house" } });
    const response = await GET(request("GET"), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ document: null, canEdit: false });
    expect(mocks.authorize).toHaveBeenCalledWith("/app/links-uteis/grupos-whatsapp");
  });

  it("salva documento validado com revisão otimista", async () => {
    const response = await PUT(request("PUT", document), context);
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(document);
    expect(await response.json()).toEqual({ document: { ...document, revision: 1 } });
  });

  it("nega escrita a leitores e origem externa antes da persistência", async () => {
    mocks.authorize.mockResolvedValueOnce({ ok: true, context: { roleKey: "broker_house" } });
    expect((await PUT(request("PUT", document), context)).status).toBe(403);
    mocks.authorize.mockResolvedValueOnce({ ok: true, context: { roleKey: "master" } });
    expect((await PUT(request("PUT", document, "https://foreign.test"), context)).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejeita documento de outra página e conflito sem vazar diagnóstico", async () => {
    expect(
      (
        await PUT(
          request("PUT", { ...document, pageKey: "crm.useful_links.relacionamento" }),
          context,
        )
      ).status,
    ).toBe(400);
    mocks.save.mockResolvedValueOnce({ data: null, error: { code: "40001", message: "private" } });
    const conflict = await PUT(request("PUT", document), context);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "revision_conflict" });
  });

  it("limita o corpo real mesmo sem confiar no content-length", async () => {
    const oversized = new Request(`https://crm.test/api/useful-links/${page.slug}`, {
      method: "PUT",
      headers: {
        origin: "https://crm.test",
        "content-type": "application/json",
        "content-length": "1",
      },
      body: "ã".repeat(300_000),
    });
    const response = await PUT(oversized, context);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "body_too_large" });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
