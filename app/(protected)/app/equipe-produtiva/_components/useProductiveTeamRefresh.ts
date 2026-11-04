"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 30 * 60_000;

/** Re-read the authorized page; keep the current filters and client component state. */
export function useProductiveTeamRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    function verify() {
      clearTimeout(timer);
      if (document.hidden) return;
      const elapsed = Date.now() - lastRefreshAt;
      if (elapsed >= REFRESH_INTERVAL_MS) {
        lastRefreshAt = Date.now();
        router.refresh();
      }
      timer = setTimeout(verify, Math.max(1, REFRESH_INTERVAL_MS - (Date.now() - lastRefreshAt)));
    }

    verify();
    document.addEventListener("visibilitychange", verify);
    window.addEventListener("focus", verify);
    window.addEventListener("online", verify);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", verify);
      window.removeEventListener("focus", verify);
      window.removeEventListener("online", verify);
    };
  }, [router]);
}

export function ProductiveTeamAutoRefresh() {
  useProductiveTeamRefresh();
  return null;
}
