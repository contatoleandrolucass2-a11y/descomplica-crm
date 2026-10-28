import { usefulLinksPages } from "@/lib/crm/useful-links/content";
import { usefulLinksDocumentSchema, usefulLinksPageKey } from "@/lib/crm/useful-links/document";
import { getUsefulLinksDocument, saveUsefulLinksDocument } from "@/lib/crm/useful-links/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 524_288;
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: noStoreHeaders() });

function pageForSlug(slug: string) {
  return usefulLinksPages.find((page) => page.slug === slug) ?? null;
}

function canEdit(roleKey: string) {
  return roleKey === "admin" || roleKey === "master";
}

function rpcFailure(code?: string | null) {
  if (code === "40001") return failure("revision_conflict", 409);
  if (code === "42501") return failure("forbidden", 403);
  if (code === "22023") return failure("invalid_document", 400);
  return failure("useful_links_unavailable", 503);
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pageForSlug(slug);
  if (!page) return failure("not_found", 404);
  const authorization = await authorizePageRoute(`/app/links-uteis/${slug}`);
  if (!authorization.ok) return authorization.response;
  try {
    const result = await getUsefulLinksDocument(usefulLinksPageKey(slug));
    if (result.error) return rpcFailure(result.error.code);
    return Response.json(
      { document: result.data, canEdit: canEdit(authorization.context.roleKey) },
      { headers: noStoreHeaders() },
    );
  } catch {
    return failure("useful_links_unavailable", 503);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pageForSlug(slug);
  if (!page) return failure("not_found", 404);
  const authorization = await authorizePageRoute(`/app/links-uteis/${slug}`);
  if (!authorization.ok) return authorization.response;
  if (!canEdit(authorization.context.roleKey)) return failure("forbidden", 403);
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) return failure("invalid_origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return failure("invalid_content_type", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return failure("body_too_large", 413);
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BYTES) return failure("body_too_large", 413);
    const body: unknown = JSON.parse(rawBody);
    const parsed = usefulLinksDocumentSchema.safeParse(body);
    if (!parsed.success || parsed.data.pageKey !== usefulLinksPageKey(slug))
      return failure("invalid_document", 400);
    const result = await saveUsefulLinksDocument(parsed.data);
    if (result.error || !result.data) return rpcFailure(result.error?.code);
    return Response.json({ document: result.data }, { headers: noStoreHeaders() });
  } catch (error) {
    return failure(
      error instanceof SyntaxError ? "invalid_document" : "useful_links_unavailable",
      error instanceof SyntaxError ? 400 : 503,
    );
  }
}
