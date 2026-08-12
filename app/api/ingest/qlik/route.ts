import { handleQlikRelayPost } from "@/lib/crm/qlik/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleQlikRelayPost(request);
}
