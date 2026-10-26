import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/meta-ads/canvas-profiles/route";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.client }));

const userId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const cardId = "33333333-3333-4333-8333-333333333333";
const state = {
  activeId: profileId,
  defaultId: profileId,
  items: [
    {
      id: profileId,
      name: "Padrão",
      cards: [
        {
          id: cardId,
          metric: "spend",
          type: "bars",
          period: "month",
          span: 4,
          height: 384,
          group: "campaign",
          start: "2026-10-01",
          end: "2026-10-26",
          campaignIds: null,
        },
      ],
    },
  ],
};
const record = {
  scope: "macro",
  state,
  revision: 1,
  updated_at: "2026-10-26T19:00:00.000Z",
};

function putRequest(value: unknown, headers: Record<string, string> = {}) {
  return new Request("https://crm.test/api/meta-ads/canvas-profiles", {
    method: "PUT",
    headers: { origin: "https://crm.test", "content-type": "application/json", ...headers },
    body: typeof value === "string" ? value : JSON.stringify(value),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://crm.test");
  mocks.authorize.mockResolvedValue({ ok: true, context: { userId } });
});
afterEach(() => vi.unstubAllEnvs());

describe("Meta Ads canvas profile API", () => {
  it("loads only the authenticated user's requested scope", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: record, error: null });
    mocks.client.mockResolvedValue({ rpc });
    const response = await GET(
      new Request("https://crm.test/api/meta-ads/canvas-profiles?scope=macro"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile: record });
    expect(rpc).toHaveBeenCalledWith("get_meta_ads_canvas_profile", { p_scope: "macro" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("saves validated state under the authenticated user and rejects foreign origins", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: record, error: null });
    mocks.client.mockResolvedValue({ rpc });
    const response = await PUT(putRequest({ scope: "macro", state }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("save_meta_ads_canvas_profile", {
      p_scope: "macro",
      p_state: state,
    });
    const denied = await PUT(
      putRequest({ scope: "macro", state }, { origin: "https://foreign.test" }),
    );
    expect(denied.status).toBe(403);
  });

  it.each([
    ["invalid scope", { scope: "other", state }],
    ["missing default profile", { scope: "macro", state: { ...state, defaultId: cardId } }],
    [
      "custom period without dates",
      {
        scope: "macro",
        state: {
          ...state,
          items: [
            {
              ...state.items[0]!,
              cards: [{ ...state.items[0]!.cards[0], period: "custom", start: undefined }],
            },
          ],
        },
      },
    ],
    [
      "oversized card",
      {
        scope: "macro",
        state: {
          ...state,
          items: [{ ...state.items[0]!, cards: [{ ...state.items[0]!.cards[0], height: 999 }] }],
        },
      },
    ],
  ])("rejects %s", async (_label, body) => {
    const response = await PUT(putRequest(body));
    expect(response.status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("defines an owner-only, MFA-gated RLS table", () => {
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/20261026191505_meta_ads_canvas_profiles.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("user_id = (select auth.uid())");
    expect(migration).toContain("private.current_session_satisfies_mfa()");
    expect(migration).toContain("create function public.get_meta_ads_canvas_profile");
    expect(migration).toContain("create function public.save_meta_ads_canvas_profile");
    expect(migration).not.toContain("grant select, insert, update, delete");
    expect(migration).not.toContain("grant all");
  });
});
