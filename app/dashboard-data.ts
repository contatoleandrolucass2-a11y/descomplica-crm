import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { collaboratorDashboards } from "@/db/schema";
import { demoDashboard } from "./demo-data";
import type { DashboardPayload } from "./types";

const COMPLETE_REPORT_EMAIL = "relatorio-completo@descomplicapro.com.br";

type SupabaseRuntime = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

async function loadSupabaseDashboard(): Promise<DashboardPayload | null> {
  const runtime = env as unknown as SupabaseRuntime;
  const baseUrl = runtime.SUPABASE_URL?.trim();
  const apiKey = runtime.SUPABASE_ANON_KEY?.trim();
  if (!baseUrl || !apiKey) return null;

  const response = await fetch(
    `${baseUrl}/rest/v1/sf_relatorio_resumo?select=payload,generated_at,reference_date&snapshot_key=eq.full&limit=1`,
    {
      headers: {
        apikey: apiKey,
        authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ payload?: DashboardPayload }>;
  const payload = rows[0]?.payload;
  return payload?.views ? payload : null;
}

async function isLocalPreview() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function loadDashboardPageData(_returnTo: string) {
  const localPreview = await isLocalPreview();
  const user = {
    email: "relatorio-completo@descomplicapro.com.br",
    displayName: "Equipe Descomplica",
    fullName: "Equipe Descomplica",
  };

  let dashboard: DashboardPayload | null = null;
  let dataStatus: "live" | "demo" | "waiting" = "waiting";

  if (localPreview) {
    dashboard = demoDashboard;
    dataStatus = "demo";
  } else {
    try {
      dashboard = await loadSupabaseDashboard();
      if (dashboard) {
        dataStatus = "live";
      }
    } catch {
      dataStatus = "waiting";
    }

    if (!dashboard) {
      try {
        const [record] = await getDb()
          .select()
          .from(collaboratorDashboards)
          .where(eq(collaboratorDashboards.email, COMPLETE_REPORT_EMAIL))
          .limit(1);
        if (record) {
          dashboard = JSON.parse(record.payloadJson) as DashboardPayload;
          dataStatus = "live";
        }
      } catch {
        dataStatus = "waiting";
      }
    }
  }

  return {
    dashboard,
    dataStatus,
    signedInEmail: user.email,
    signedInName: user.fullName ?? user.displayName,
  };
}
