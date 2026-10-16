"use client";

import { useEffect, useMemo, useState } from "react";

const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESULT_AGE_MS = 90_000;
const ONLINE_WINDOW_MS = 120_000;

export interface UserPresence {
  status: "online" | "offline" | "unknown";
  lastSeenAt: string | null;
}

const UNKNOWN_PRESENCE: UserPresence = { status: "unknown", lastSeenAt: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parsePresence(payload: unknown, userIds: readonly string[]) {
  if (!isRecord(payload) || !Array.isArray(payload.users) || !isTimestamp(payload.observedAt)) {
    throw new Error("user_presence_payload_invalid");
  }

  const allowedIds = new Set(userIds);
  const seenIds = new Set<string>();
  const result = new Map(userIds.map((id) => [id, UNKNOWN_PRESENCE]));
  const onlineBudgets = new Map<string, number>();
  const observedAt = Date.parse(payload.observedAt);
  for (const entry of payload.users) {
    if (!isRecord(entry) || typeof entry.userId !== "string") {
      throw new Error("user_presence_payload_invalid");
    }
    if (!allowedIds.has(entry.userId)) continue;
    if (
      seenIds.has(entry.userId) ||
      typeof entry.isOnline !== "boolean" ||
      !(entry.lastSeenAt === null || isTimestamp(entry.lastSeenAt))
    ) {
      throw new Error("user_presence_payload_invalid");
    }
    const signalAge = entry.lastSeenAt === null ? null : observedAt - Date.parse(entry.lastSeenAt);
    if (
      (signalAge !== null && signalAge < 0) ||
      (entry.isOnline && (signalAge === null || signalAge >= ONLINE_WINDOW_MS))
    ) {
      throw new Error("user_presence_payload_invalid");
    }
    seenIds.add(entry.userId);
    result.set(entry.userId, {
      status: entry.isOnline ? "online" : "offline",
      lastSeenAt: entry.lastSeenAt,
    });
    if (entry.isOnline && signalAge !== null) {
      onlineBudgets.set(entry.userId, ONLINE_WINDOW_MS - signalAge);
    }
  }
  return { presence: result, onlineBudgets };
}

// This subscription updates presence only. It never reloads the route or
// remounts the permission editor, so an unsaved access draft remains intact.
export function startUserPresencePolling(
  userIds: readonly string[],
  onChange: (presence: Map<string, UserPresence>) => void,
): () => void {
  if (userIds.length === 0) return () => undefined;
  let disposed = false;
  let pending: AbortController | null = null;
  let currentPresence: Map<string, UserPresence> | null = null;
  let snapshotExpiresAt: number | null = null;
  let onlineDeadlines = new Map<string, number>();
  let requestTimer: ReturnType<typeof setTimeout> | undefined;
  let expirationTimer: ReturnType<typeof setTimeout> | undefined;

  function markUnknown() {
    if (disposed) return;
    currentPresence = null;
    snapshotExpiresAt = null;
    onlineDeadlines.clear();
    clearTimeout(expirationTimer);
    onChange(new Map(userIds.map((id) => [id, UNKNOWN_PRESENCE])));
  }

  function scheduleExpiration() {
    clearTimeout(expirationTimer);
    if (disposed || snapshotExpiresAt === null) return;
    const nextDeadline = Math.min(snapshotExpiresAt, ...onlineDeadlines.values());
    expirationTimer = setTimeout(expireIfNeeded, Math.max(0, nextDeadline - performance.now()));
  }

  function expireIfNeeded() {
    if (disposed || snapshotExpiresAt === null || currentPresence === null) return;
    const now = performance.now();
    if (now >= snapshotExpiresAt) {
      markUnknown();
      return;
    }
    let updated: Map<string, UserPresence> | null = null;
    for (const [id, deadline] of onlineDeadlines) {
      if (now < deadline) continue;
      updated ??= new Map(currentPresence);
      updated.set(id, UNKNOWN_PRESENCE);
      onlineDeadlines.delete(id);
    }
    if (updated !== null) {
      currentPresence = updated;
      onChange(updated);
    }
    scheduleExpiration();
  }

  async function refresh() {
    if (disposed || document.visibilityState !== "visible") return;
    expireIfNeeded();
    if (pending) return;
    const controller = new AbortController();
    pending = controller;
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch("/api/admin/users/presence", {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("user_presence_unavailable");
          return parsePresence(await response.json(), userIds);
        })(),
        new Promise<never>((_, reject) => {
          requestTimer = setTimeout(() => {
            controller.abort();
            reject(new Error("user_presence_timeout"));
          }, REQUEST_TIMEOUT_MS);
        }),
      ]);
      if (disposed || controller.signal.aborted) return;
      // Server timestamps define the remaining online window. Local monotonic
      // time only measures elapsed time; client clock skew cannot extend it.
      const receivedAt = performance.now();
      currentPresence = result.presence;
      snapshotExpiresAt = receivedAt + MAX_RESULT_AGE_MS;
      onlineDeadlines = new Map(
        [...result.onlineBudgets].map(([id, remaining]) => [id, receivedAt + remaining]),
      );
      onChange(currentPresence);
      scheduleExpiration();
    } catch {
      if (!disposed) markUnknown();
    } finally {
      clearTimeout(requestTimer);
      if (pending === controller) pending = null;
    }
  }

  const onVisible = () => {
    if (document.visibilityState === "visible") void refresh();
  };
  const onResume = () => void refresh();
  const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onResume);
  window.addEventListener("online", onResume);
  void refresh();

  return () => {
    disposed = true;
    pending?.abort();
    clearInterval(interval);
    clearTimeout(requestTimer);
    clearTimeout(expirationTimer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onResume);
    window.removeEventListener("online", onResume);
  };
}

export function useUserPresence(userIds: readonly string[]): ReadonlyMap<string, UserPresence> {
  const idsKey = JSON.stringify([...new Set(userIds)].sort());
  const ids = useMemo(() => JSON.parse(idsKey) as string[], [idsKey]);
  const [snapshot, setSnapshot] = useState(() => ({
    idsKey,
    presence: new Map<string, UserPresence>(),
  }));

  useEffect(
    () => startUserPresencePolling(ids, (presence) => setSnapshot({ idsKey, presence })),
    [ids, idsKey],
  );

  return useMemo(
    () =>
      new Map(
        ids.map((id) => [
          id,
          (snapshot.idsKey === idsKey ? snapshot.presence.get(id) : undefined) ?? UNKNOWN_PRESENCE,
        ]),
      ),
    [ids, idsKey, snapshot],
  );
}
