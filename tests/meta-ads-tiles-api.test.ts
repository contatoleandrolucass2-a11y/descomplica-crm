import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
import { GET } from "@/app/api/meta-ads/tiles/[z]/[x]/[y]/route";
const fetcher = vi.fn();
const request = new Request("https://crm.example/api/meta-ads/tiles/10/20/30");
const context = (z = "10", x = "20", y = "30") => ({ params: Promise.resolve({ z, x, y }) });
beforeEach(() => {
  mocks.authorize.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
describe("authenticated cartography proxy", () => {
  it.each([401, 403])("preserves denial %s without contacting provider", async (status) => {
    mocks.authorize.mockResolvedValue({ ok: false, response: new Response(null, { status }) });
    expect((await GET(request, context())).status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ["7", "0", "0"],
    ["20", "0", "0"],
    ["10", "1024", "0"],
    ["10", "-1", "0"],
    ["10", "https://evil.example", "0"],
  ])("rejects invalid tile coordinates", async (z, x, y) => {
    expect((await GET(request, context(z, x, y))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requests only a fixed public host without forwarding user credentials", async () => {
    fetcher.mockResolvedValue(
      new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } }),
    );
    const response = await GET(request, context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=604800");
    expect(fetcher).toHaveBeenCalledWith(
      "https://tile.openstreetmap.org/10/20/30.png",
      expect.objectContaining({ redirect: "error", next: { revalidate: 604800 } }),
    );
    expect(new Headers(fetcher.mock.calls[0]![1].headers).has("cookie")).toBe(false);
  });
  it("rejects non-image upstream payloads", async () => {
    fetcher.mockResolvedValue(
      new Response("<html>private error</html>", { headers: { "content-type": "text/html" } }),
    );
    const response = await GET(request, context());
    expect(response.status).toBe(502);
    expect(await response.text()).toBe("");
  });
});
