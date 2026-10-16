import { handleQlikV2Post } from "@/lib/crm/qlik/handler-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleQlikV2Post(request);
}
