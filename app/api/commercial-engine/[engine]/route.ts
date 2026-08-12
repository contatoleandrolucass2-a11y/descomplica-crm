import { handleCommercialEnginePost } from "@/lib/crm/commercial-engine/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ engine: string }> }) {
  const { engine } = await context.params;
  return handleCommercialEnginePost(request, engine);
}
