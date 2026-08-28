import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRoute: vi.fn(),
  createClient: vi.fn(),
  createPrivilegedClient: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/privileged", () => ({
  createPrivilegedClient: mocks.createPrivilegedClient,
}));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/supabase/middleware", () => ({ updateSession: mocks.updateSession }));
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));

import { SalesforceRefreshButton } from "@/app/(protected)/app/_components/SalesforceRefreshButton";
import { POST as ingest } from "@/app/api/ingest/salesforce/route";
import { POST as refresh } from "@/app/api/refresh/salesforce/route";
import { proxy } from "@/proxy";

const endpoint = "https://crm.example.com";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Salesforce capability flags", () => {
  it("keeps both capabilities fail-closed when explicitly disabled", async () => {
    vi.stubEnv("SALESFORCE_INGEST_ENABLED", "false");
    vi.stubEnv("SALESFORCE_REFRESH_ENABLED", "false");
    const externalFetch = vi.fn();
    vi.stubGlobal("fetch", externalFetch);

    const ingestResponse = await ingest(new Request(`${endpoint}/api/ingest/salesforce`));
    const refreshResponse = await refresh(new Request(`${endpoint}/api/refresh/salesforce`));

    expect(ingestResponse.status).toBe(404);
    await expect(ingestResponse.json()).resolves.toEqual({ error: "ingestion_unavailable" });
    expect(refreshResponse.status).toBe(404);
    await expect(refreshResponse.json()).resolves.toEqual({ error: "refresh_unavailable" });
    expect(externalFetch).not.toHaveBeenCalled();
    expect(mocks.authorizeRoute).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("short-circuits disabled Salesforce endpoints before session refresh", async () => {
    vi.stubEnv("SALESFORCE_INGEST_ENABLED", "false");
    vi.stubEnv("SALESFORCE_REFRESH_ENABLED", "false");

    const ingestResponse = await proxy(
      new NextRequest(`${endpoint}/api/ingest/salesforce`, { method: "POST" }),
    );
    const refreshResponse = await proxy(
      new NextRequest(`${endpoint}/api/refresh/salesforce`, { method: "POST" }),
    );

    expect(ingestResponse.status).toBe(404);
    expect(refreshResponse.status).toBe(404);
    expect(ingestResponse.headers.get("cache-control")).toBe("no-store");
    expect(refreshResponse.headers.get("cache-control")).toBe("no-store");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("keeps enabled but incomplete Salesforce endpoints unavailable at the proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SALESFORCE_INGEST_ENABLED", "true");
    vi.stubEnv("SALESFORCE_INGEST_SECRET", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SALESFORCE_REFRESH_ENABLED", "true");
    vi.stubEnv("SALESFORCE_REFRESH_URL", "");
    vi.stubEnv("SALESFORCE_REFRESH_SECRET", "");

    const ingestResponse = await proxy(
      new NextRequest(`${endpoint}/api/ingest/salesforce`, { method: "POST" }),
    );
    const refreshResponse = await proxy(
      new NextRequest(`${endpoint}/api/refresh/salesforce`, { method: "POST" }),
    );

    expect(ingestResponse.status).toBe(503);
    expect(refreshResponse.status).toBe(503);
    expect(ingestResponse.headers.get("cache-control")).toBe("no-store");
    expect(refreshResponse.headers.get("cache-control")).toBe("no-store");
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it.each([
    { ingestSecret: "", supabaseSecret: `sb_secret_${"s".repeat(24)}` },
    { ingestSecret: "i".repeat(32), supabaseSecret: "" },
  ])("rejects enabled ingestion without every required secret", async (configuration) => {
    vi.stubEnv("SALESFORCE_INGEST_ENABLED", "true");
    vi.stubEnv("SALESFORCE_INGEST_SECRET", configuration.ingestSecret);
    vi.stubEnv("SUPABASE_SECRET_KEY", configuration.supabaseSecret);

    const response = await ingest(new Request(`${endpoint}/api/ingest/salesforce`));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "ingestion_unavailable" });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("keeps bearer authentication when ingestion is configured", async () => {
    vi.stubEnv("SALESFORCE_INGEST_ENABLED", "true");
    vi.stubEnv("SALESFORCE_INGEST_SECRET", "i".repeat(32));
    vi.stubEnv("SUPABASE_SECRET_KEY", `sb_secret_${"s".repeat(24)}`);

    const response = await ingest(
      new Request(`${endpoint}/api/ingest/salesforce`, {
        headers: { authorization: `Bearer ${"x".repeat(32)}` },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it.each([
    { refreshUrl: "", refreshSecret: "r".repeat(32) },
    { refreshUrl: "https://automation.example/refresh", refreshSecret: "" },
    { refreshUrl: "http://automation.example/refresh", refreshSecret: "r".repeat(32) },
  ])("rejects enabled refresh with incomplete or unsafe configuration", async (configuration) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SALESFORCE_REFRESH_ENABLED", "true");
    vi.stubEnv("SALESFORCE_REFRESH_URL", configuration.refreshUrl);
    vi.stubEnv("SALESFORCE_REFRESH_SECRET", configuration.refreshSecret);
    const externalFetch = vi.fn();
    vi.stubGlobal("fetch", externalFetch);

    const response = await refresh(new Request(`${endpoint}/api/refresh/salesforce`));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "refresh_unavailable" });
    expect(externalFetch).not.toHaveBeenCalled();
    expect(mocks.authorizeRoute).not.toHaveBeenCalled();
  });

  it("keeps route authorization when refresh is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SALESFORCE_REFRESH_ENABLED", "true");
    vi.stubEnv("SALESFORCE_REFRESH_URL", "https://automation.example/refresh");
    vi.stubEnv("SALESFORCE_REFRESH_SECRET", "r".repeat(32));
    const denied = Response.json({ error: "unauthorized" }, { status: 401 });
    mocks.authorizeRoute.mockResolvedValueOnce({ ok: false, response: denied });
    const externalFetch = vi.fn();
    vi.stubGlobal("fetch", externalFetch);

    const response = await refresh(new Request(`${endpoint}/api/refresh/salesforce`));

    expect(response).toBe(denied);
    expect(mocks.authorizeRoute).toHaveBeenCalledWith("crm.salesforce.refresh");
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it("renders a neutral unavailable state instead of an active refresh action", () => {
    const markup = renderToStaticMarkup(
      createElement(SalesforceRefreshButton, { available: false }),
    );

    expect(markup).toContain("disabled");
    expect(markup).toContain("Atualização indisponível");
    expect(markup).toContain("Recurso indisponível neste ambiente.");
    expect(markup).not.toContain("Atualizar Salesforce");
  });
});
