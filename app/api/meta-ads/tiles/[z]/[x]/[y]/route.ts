import { authorizePageRoute } from "@/lib/security/route-auth";
import { noStoreHeaders } from "@/lib/security/api";

export const runtime = "nodejs";

// Fixed public cartography endpoint. Never forwards CRM credentials or arbitrary URLs.
export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const authorization = await authorizePageRoute("/app/meta-ads");
  if (!authorization.ok) return authorization.response;
  const params = await context.params;
  const values = [params.z, params.x, params.y];
  const z = Number(params.z),
    x = Number(params.x),
    y = Number(params.y);
  if (
    values.some((value) => !/^\d{1,6}$/.test(value)) ||
    z < 8 ||
    z > 19 ||
    x >= 2 ** z ||
    y >= 2 ** z
  ) {
    return new Response(null, { status: 400, headers: noStoreHeaders() });
  }
  try {
    const response = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: {
        "User-Agent": "DescomplicaCRM/1.0 (+https://crm.descomplicapro.com.br)",
        Referer: "https://crm.descomplicapro.com.br/",
      },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 604800 },
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png"))
      throw new Error("tile unavailable");
    const body = await response.arrayBuffer();
    if (body.byteLength > 1_000_000) throw new Error("tile too large");
    return new Response(body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, max-age=604800",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 502, headers: noStoreHeaders() });
  }
}
