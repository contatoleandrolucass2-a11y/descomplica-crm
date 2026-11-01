import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
let client: typeof import("../lib/crm/lead-plus/client/api");
const fetcher = vi.fn<typeof fetch>();
beforeAll(async () => {
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("window", new EventTarget());
  client = await import("../lib/crm/lead-plus/client/api");
});
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  client.setLeadViewAs("");
});
afterAll(() => vi.unstubAllGlobals());

describe("LEAD+ visualização por sessão do ator", () => {
  it("encaminha apenas o ID de visualização e remove o cabeçalho ao retornar", async () => {
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
    client.setLeadViewAs("target-user");
    await client.api("/leads");
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-lead-view-as")).toBe("target-user");
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    client.setLeadViewAs("");
    await client.api("/session");
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).has("x-lead-view-as")).toBe(false);
  });
  it("descarta uma resposta iniciada antes da troca de usuário", async () => {
    let deliver!: (response: Response) => void;
    fetcher.mockReturnValue(
      new Promise((resolve) => {
        deliver = resolve;
      }),
    );
    const pending = client.api("/leads");
    client.setLeadViewAs("new-target");
    deliver(new Response(JSON.stringify({ data: [{ name: "old response" }] })));
    await expect(pending).rejects.toThrow("visualização do usuário foi alterada");
  });
  it("não envia uma alteração se o usuário muda durante a obtenção do CSRF", async () => {
    let deliver!: (response: Response) => void;
    fetcher.mockReturnValue(
      new Promise((resolve) => {
        deliver = resolve;
      }),
    );
    const pending = client.api("/crm-users/link", "POST", { auth_user_id: "target" });
    client.setLeadViewAs("new-target");
    deliver(new Response(JSON.stringify({ csrf: "old-scope" })));
    await expect(pending).rejects.toThrow("visualização do usuário foi alterada");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("mantém o status409 para tratar conflito sem exibir falso sucesso", async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ csrf: "scope" })));
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "version_conflict" }), { status: 409 }),
    );
    await expect(
      client.api("/integrations/facebook/campaigns", "PUT", { campaign_ids: [], version: 2 }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
