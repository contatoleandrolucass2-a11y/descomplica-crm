// A remote console holds a frozen Cookie header. Only the browser may rotate
// its refresh token; server-side probes must fail closed when it expires.
export function readOnlySessionFetch(upstream: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.replace(/\/+$/u, "") === "/auth/v1/token") {
      return Response.json(
        { code: "session_expired", message: "Browser authentication required" },
        {
          status: 401,
        },
      );
    }
    return upstream(input, init);
  };
}
