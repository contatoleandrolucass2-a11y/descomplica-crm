import { handleMetaWebhook } from "@/lib/crm/lead-plus/server/runtime.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleMetaWebhook;
export const POST = handleMetaWebhook;
