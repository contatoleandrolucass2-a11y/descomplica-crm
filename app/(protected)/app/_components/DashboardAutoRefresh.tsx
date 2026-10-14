"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";

const versionSchema = z
  .object({
    generatedAt: z.iso.datetime({ offset: true }).nullable(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((version) => (version.generatedAt === null) === (version.updatedAt === null));
const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_RETRY_MS = 60_000;

export function DashboardAutoRefresh({
  generatedAt,
  updatedAt,
}: {
  generatedAt: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let unauthorized = false;
    let refreshRequestedAt: number | null = null;
    let controller: AbortController | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    async function verify() {
      if (disposed || unauthorized || controller || document.hidden) return;
      clearTimeout(pollTimer);
      const request = new AbortController();
      controller = request;
      timeoutTimer = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch("/api/dashboard/status", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
          signal: request.signal,
        });
        if (disposed || request.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          unauthorized = true;
          router.refresh();
          return;
        }
        if (!response.ok) return;
        const parsed = versionSchema.safeParse(await response.json());
        if (!parsed.success || disposed || request.signal.aborted) return;
        // Compare the persisted snapshot, not a collection attempt or an ingestion receipt.
        if (parsed.data.generatedAt !== generatedAt || parsed.data.updatedAt !== updatedAt) {
          // New props acknowledge delivery. Retry after a bounded wait if refresh failed.
          if (refreshRequestedAt !== null && Date.now() - refreshRequestedAt < REFRESH_RETRY_MS) {
            return;
          }
          refreshRequestedAt = Date.now();
          router.refresh();
        }
      } catch {
        // Keep the dated snapshot visible and retry; a failed probe is not a new version.
      } finally {
        clearTimeout(timeoutTimer);
        controller = null;
        if (!disposed && !unauthorized && !document.hidden) {
          pollTimer = setTimeout(() => void verify(), POLL_INTERVAL_MS);
        }
      }
    }

    function resume() {
      if (document.hidden) {
        clearTimeout(pollTimer);
        controller?.abort();
      } else {
        void verify();
      }
    }

    void verify();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, [generatedAt, updatedAt, router]);

  return null;
}
