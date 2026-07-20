import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { collaboratorDashboards } from "@/db/schema";

const COMPLETE_REPORT_EMAIL = "relatorio-completo@descomplicapro.com.br";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runtime = env as unknown as RuntimeEnv;
    const baseUrl = runtime.SUPABASE_URL?.trim();
    const apiKey = runtime.SUPABASE_ANON_KEY?.trim();
    if (baseUrl && apiKey) {
      const response = await fetch(
        `${baseUrl}/rest/v1/sf_relatorio_resumo?select=generated_at&snapshot_key=eq.full&limit=1`,
        { headers: { apikey: apiKey, authorization: `Bearer ${apiKey}` }, cache: "no-store" },
      );
      if (response.ok) {
        const rows = (await response.json()) as Array<{ generated_at?: string }>;
        return Response.json(
          { generatedAt: rows[0]?.generated_at ?? null },
          { headers: { "cache-control": "no-store" } },
        );
      }
    }

    const [record] = await getDb()
      .select({ generatedAt: collaboratorDashboards.generatedAt })
      .from(collaboratorDashboards)
      .where(eq(collaboratorDashboards.email, COMPLETE_REPORT_EMAIL))
      .limit(1);

    return Response.json(
      { generatedAt: record?.generatedAt ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "database_unavailable" }, { status: 503 });
  }
}
