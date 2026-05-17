// HTTP security headers — defense-in-depth at the edge.
//
// Applied from the root proxy (proxy.ts) on every matched response.
// Mutates the response Headers object in place so the caller does
// not need to rebuild the response. Pure function: no I/O, no
// network, no env reads. The caller decides whether to send the
// production-grade variant by passing options.isProd, which keeps
// this module testable and free of environment coupling.
//
// Why a separate module:
//   - Keeps proxy.ts focused on session refresh + a single one-line
//     call. The policy itself lives here so it can be audited and
//     evolved in isolation.
//   - AUTH_SECURITY.md > HTTP Security Headers designates the proxy
//     layer as the enforcement point. This module is the policy
//     definition the proxy enforces.
//
// Why dev/prod split:
//   - Turbopack uses eval-based HMR and WebSocket transport in dev.
//     The dev CSP must allow 'unsafe-eval' and ws:/wss: or local
//     development breaks. Production strips both.
//   - HSTS and upgrade-insecure-requests are production-only because
//     issuing them from a non-TLS environment would poison browser
//     caches against plain-HTTP access. The caller is expected to
//     gate options.isProd on BOTH NODE_ENV === "production" AND a
//     real HTTPS request, so a local prod build over HTTP does not
//     trip the production branch.
//
// Known relaxations (will be hardened in a dedicated milestone):
//   - 'unsafe-inline' is allowed for script-src and style-src in
//     prod because Next.js 16 injects framework hydration script
//     tags inline and Tailwind v4 emits inline style tags.
//     Migrating to per-request CSP nonces requires Next.js config
//     changes that are out of scope here.
//
// HSTS:
//   - Header value is "max-age=31536000; includeSubDomains".
//   - The "preload" token is intentionally absent from the value.
//     Preload is a near-irreversible domain-wide commitment
//     (submission to the Chromium preload list) that requires a
//     separate security review. This comment exists to document
//     why preload is omitted; the comment must not be confused
//     with the actual header value, which contains no "preload".
//
// Cache headers contract:
//   - This module does NOT set Cache-Control, Expires, or Pragma.
//     Those anti-cache headers are owned by the @supabase/ssr
//     helper (lib/auth/supabase/middleware.ts) and must reach the
//     browser untouched. Adding cache-related headers here would
//     create a silent conflict with the SSR helper contract.

const SUPABASE_HTTPS = "https://*.supabase.co";
const SUPABASE_WSS = "wss://*.supabase.co";

const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

function buildCsp(isProd: boolean): string {
  const scriptSrc = isProd
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  const styleSrc = ["'self'", "'unsafe-inline'"];

  const connectSrc = isProd
    ? ["'self'", SUPABASE_HTTPS, SUPABASE_WSS]
    : ["'self'", "ws:", "wss:", SUPABASE_HTTPS, SUPABASE_WSS];

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
  ];

  if (isProd) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function applySecurityHeaders(headers: Headers, options: { isProd: boolean }): void {
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("Content-Security-Policy", buildCsp(options.isProd));

  if (options.isProd) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}
