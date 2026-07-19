import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collaboratorDashboards } from "@/db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

const COMPLETE_REPORT_EMAIL = "relatorio-completo@descomplicapro.com.br";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
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
