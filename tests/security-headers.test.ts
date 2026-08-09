import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "../lib/security/headers";

describe("security headers regression", () => {
  it("keeps the production CSP and transport protections", () => {
    const headers = new Headers();

    applySecurityHeaders(headers, { isProd: true });

    const csp = headers.get("Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Permissions-Policy")).toContain("payment=()");
  });

  it("keeps local development usable without weakening cache ownership", () => {
    const headers = new Headers({ "Cache-Control": "private, no-store" });

    applySecurityHeaders(headers, { isProd: false });

    const csp = headers.get("Content-Security-Policy")!;
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });
});
