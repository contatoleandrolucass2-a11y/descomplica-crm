"use client";
import dynamic from "next/dynamic";
const Workspace = dynamic(() => import("@/lib/crm/lead-plus/client/EmbeddedWorkspace"), {
  ssr: false,
  loading: () => <p role="status">Abrindo DESCOMPLICA LEAD…</p>,
});
export function LeadPlusClient({ initialScreen }: { initialScreen: string }) {
  return <Workspace initialScreen={initialScreen} />;
}
