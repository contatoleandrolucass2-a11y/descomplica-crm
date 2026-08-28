import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, cookieSet, hasFreshRecoveryAuthenticationMethod } = vi.hoisted(() => ({
  auth: {
    verifyOtp: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    getClaims: vi.fn(),
    signOut: vi.fn(),
  },
  cookieSet: vi.fn(),
  hasFreshRecoveryAuthenticationMethod: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));

vi.mock("@/lib/auth/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));

vi.mock("@/lib/auth/mfa/assurance", () => ({
  hasFreshRecoveryAuthenticationMethod,
}));

import { GET } from "@/app/auth/callback/route";

const origin = "https://crm.example.test";
const recoveryCode = "123e4567-e89b-42d3-a456-426614174000";
const tokenHash = "a".repeat(56);

function request(query: string) {
  return new Request(`${origin}/auth/callback?${query}`);
}

describe("hosted recovery callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_ORIGIN", origin);
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "redacted" }, redirectType: "recovery" },
      error: null,
    });
    auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    hasFreshRecoveryAuthenticationMethod.mockReturnValue(true);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects ambiguous token-hash and code callbacks before contacting Auth", async () => {
    const response = await GET(
      request(`token_hash=${tokenHash}&type=recovery&code=${recoveryCode}`),
    );

    expect(response.headers.get("location")).toBe(`${origin}/esqueci-senha?status=invalid`);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("rejects an exchanged code unless Supabase marks it as recovery", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "redacted" }, redirectType: "magiclink" },
      error: null,
    });

    const response = await GET(request(`code=${recoveryCode}`));

    expect(response.headers.get("location")).toBe(`${origin}/esqueci-senha?status=invalid`);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.getClaims).not.toHaveBeenCalled();
  });

  it("accepts a hosted PKCE recovery only after redirect type and assurance agree", async () => {
    const response = await GET(request(`code=${recoveryCode}`));

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(recoveryCode);
    expect(hasFreshRecoveryAuthenticationMethod).toHaveBeenCalledWith({});
    expect(response.headers.get("location")).toBe(`${origin}/redefinir-senha`);
    expect(cookieSet).toHaveBeenCalled();
  });

  it("preserves the direct token-hash recovery contract", async () => {
    const response = await GET(request(`token_hash=${tokenHash}&type=recovery`));

    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: "recovery" });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${origin}/redefinir-senha`);
  });
});
