import { useCallback, useEffect, useState } from "react";
export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  product: string;
  negotiation_type?: string;
  attribution?: Record<string, string>;
  source: string;
  stage: number;
  archived: boolean;
  owner_id: string;
  owner: string;
  value: number;
  version: number;
  created_at: string;
  bucket_available_at?: string;
  bucket_started_at?: string;
  bucket_deadline_at?: string;
  owner_team?: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  team: string;
  active: boolean;
  version: number;
};
export type Resource = {
  id: string;
  row?: string[];
  version: number;
  [key: string]: unknown;
};
export const stages = [
  "Novos leads",
  "Em atendimento",
  "Visita agendada",
  "Visita realizada",
  "Proposta criada",
  "Negócio fechado",
];
const sourceLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  csv: "Planilha",
  manual: "Cadastro manual",
  webhook: "Integrações",
  c2s: "Importação externa",
};
export const sourceLabel = (source: string) => sourceLabels[source] || source;
let csrf = "";
const apiBase = "/app/leads/backend";
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("c2s-local-updates") : null;
channel?.addEventListener("message", () => window.dispatchEvent(new Event("crm-update")));
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
  idempotency?: string,
): Promise<T> {
  if (method !== "GET" && !csrf) {
    const session = await fetch(apiBase + "/session").then((r) => r.json());
    csrf = session.csrf;
  }
  const response = await fetch(apiBase + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-C2S-CSRF": csrf } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("auth-expired"));
    if (response.status === 403) csrf = "";
    throw new Error(
      result.error +
        (result.fields
          ? " " +
            result.fields
              .map((f: { field: string; message: string }) => f.field + ": " + f.message)
              .join("; ")
          : ""),
    );
  }
  if (result.csrf) csrf = result.csrf;
  if (method !== "GET") {
    window.dispatchEvent(new Event("crm-update"));
    channel?.postMessage("refresh");
  }
  return result;
}
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let active = true,
      running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const d = await api<T>(path);
        if (active) {
          setData(d);
          setError("");
        }
      } catch (e) {
        if (active) setError(String(e instanceof Error ? e.message : e));
      } finally {
        running = false;
        if (active) setLoading(false);
      }
    };
    void run();
    const poll = () => {
      if (!document.hidden) void run();
    };
    const interval = setInterval(poll, 10000);
    window.addEventListener("crm-update", poll);
    window.addEventListener("focus", poll);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("crm-update", poll);
      window.removeEventListener("focus", poll);
    };
  }, [path]);
  return { data, error, loading, refresh };
}
