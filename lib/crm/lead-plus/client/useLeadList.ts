import { useCallback, useEffect, useRef, useState } from "react";
import { api, LeadApiError, type Lead } from "./api";

export type LeadListFilters = {
  q: string;
  owner: string;
  status: string;
  category: string;
};
export type LeadListPage = {
  data: Lead[];
  total: number;
  counts: Record<string, number>;
  filters: LeadListFilters;
  snapshot: string;
  next_cursor: string | null;
  server_time: string;
  next_transition_at?: string | null;
};
type Result = { key: string; data: LeadListPage | null; loadingMore: boolean; error: string };

/** Refresh the pages actually opened as one cursor chain; never mix filter/scope snapshots. */
export function useLeadList(filters: LeadListFilters, enabled = true) {
  const path = "/leads?" + new URLSearchParams({ ...filters, limit: "50" }).toString();
  const [result, setResult] = useState<Result | null>(null);
  const operations = useRef<{ refresh: () => Promise<void>; more: () => Promise<void> } | null>(
    null,
  );
  const refresh = useCallback(async () => {
    await operations.current?.refresh();
  }, []);
  const loadMore = useCallback(async () => {
    await operations.current?.more();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true,
      running = false,
      refreshAgain = false,
      depth = 1;
    let current: LeadListPage | null = null;
    const fail = (error: unknown) => {
      if (error instanceof LeadApiError && error.status >= 400 && error.status < 500)
        current = null;
      if (active)
        setResult({
          key: path,
          data: current,
          loadingMore: false,
          error: error instanceof Error ? error.message : String(error),
        });
    };
    const read = (cursor?: string) =>
      api<LeadListPage>(path + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
    const append = (first: LeadListPage, next: LeadListPage): LeadListPage => {
      const identities = new Set(first.data.map((row) => row.id));
      if (first.snapshot !== next.snapshot || next.data.some((row) => identities.has(row.id)))
        throw new Error("A lista mudou durante a leitura. Atualize os dados antes de continuar.");
      return { ...next, data: [...first.data, ...next.data] };
    };
    const finish = () => {
      running = false;
      if (active && refreshAgain) {
        refreshAgain = false;
        void reload();
      }
    };
    const reload = async () => {
      if (running) {
        refreshAgain = true;
        return;
      }
      running = true;
      try {
        let next = await read(),
          pages = 1;
        while (active && pages < depth && next.next_cursor) {
          next = append(next, await read(next.next_cursor));
          pages += 1;
        }
        if (active) {
          current = next;
          depth = pages;
          setResult({ key: path, data: current, loadingMore: false, error: "" });
        }
      } catch (error) {
        fail(error);
      } finally {
        finish();
      }
    };
    const more = async () => {
      if (running || !current?.next_cursor) return;
      running = true;
      if (active) setResult({ key: path, data: current, loadingMore: true, error: "" });
      try {
        const next = append(current, await read(current.next_cursor));
        if (active) {
          current = next;
          depth += 1;
          setResult({ key: path, data: current, loadingMore: false, error: "" });
        }
      } catch (error) {
        fail(error);
      } finally {
        finish();
      }
    };
    const actions = { refresh: reload, more };
    operations.current = actions;
    void reload();
    const poll = () => {
      if (!document.hidden) void reload();
    };
    const interval = setInterval(poll, 10000);
    window.addEventListener("crm-update", poll);
    window.addEventListener("focus", poll);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("crm-update", poll);
      window.removeEventListener("focus", poll);
      if (operations.current === actions) operations.current = null;
    };
  }, [path, enabled]);

  const matching = enabled && result?.key === path ? result : null;
  return {
    data: matching?.data ?? null,
    error: matching?.error ?? "",
    loading: enabled && matching === null,
    loadingMore: matching?.loadingMore ?? false,
    refresh,
    loadMore,
  };
}
