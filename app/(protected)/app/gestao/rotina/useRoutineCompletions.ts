"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  routineCompletionSnapshotSchema,
  type RoutineCompletion,
  type RoutineCompletionSave,
  type RoutineCompletionSnapshot,
} from "@/lib/crm/routine-completions";

type CurrentSnapshot = { data: RoutineCompletionSnapshot; expiresAt: number };
const endpoint = "/api/routines/completions";
const unavailable =
  "Não foi possível confirmar suas conclusões no CRM. Recarregue e tente novamente.";
const conflictMessage =
  "A semana ou o texto da atividade mudou. Recarregue a rotina do CRM antes de marcar novamente.";

function sameActivity(left: RoutineCompletion, right: RoutineCompletion) {
  return (
    left.role_key === right.role_key &&
    left.row_index === right.row_index &&
    left.day === right.day &&
    left.activity_text === right.activity_text
  );
}

export function useRoutineCompletions() {
  const [snapshot, setSnapshot] = useState<CurrentSnapshot | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const current = useRef<CurrentSnapshot | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const operation = useRef<{ cancel: () => void } | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiredWeek = useRef<string | null>(null);
  const conflictRef = useRef(false);

  const request = useCallback(async function requestSnapshot(
    mutation?: RoutineCompletionSave,
    replace = false,
  ) {
    if (!mounted.current || (operation.current && !replace)) return;
    const ticket = ++generation.current;
    operation.current?.cancel();
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const interrupted = new Promise<never>((_, reject) => {
      operation.current = {
        cancel: () => {
          controller.abort();
          reject(new Error("cancelled"));
        },
      };
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("timeout"));
      }, 20_000);
    });
    setPending(true);
    try {
      const result = await Promise.race([
        (async () => {
          const response = await fetch(endpoint, {
            method: mutation ? "PUT" : "GET",
            cache: "no-store",
            signal: controller.signal,
            ...(mutation
              ? {
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(mutation),
                }
              : {}),
          });
          if (response.status === 409) return { conflict: true as const };
          if (!response.ok) throw new Error("unavailable");
          return { data: routineCompletionSnapshotSchema.parse(await response.json()) };
        })(),
        interrupted,
      ]);
      if (!mounted.current || ticket !== generation.current) return;
      if ("conflict" in result) {
        conflictRef.current = true;
        setConflict(true);
        throw new Error("conflict");
      }
      const receivedAt = performance.now();
      const data = result.data;
      const previous = current.current;
      if (previous && receivedAt >= previous.expiresAt) {
        expiredWeek.current = previous.data.week_start;
      }
      // Anchor to receipt, never reset early by subtracting the request duration.
      const remaining = Date.parse(data.resets_at) - Date.parse(data.server_now);
      if (
        remaining <= 0 ||
        (expiredWeek.current && data.week_start <= expiredWeek.current) ||
        (previous && data.week_start < previous.data.week_start) ||
        (mutation && data.week_start !== mutation.expected_week_start)
      ) {
        throw new Error("expired");
      }
      const next = { data, expiresAt: receivedAt + remaining };
      current.current = next;
      setSnapshot(next);
      setError(conflictRef.current ? conflictMessage : null);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        expiredWeek.current = data.week_start;
        current.current = null;
        setSnapshot(null);
        void requestSnapshot(undefined, true);
      }, remaining);
    } catch {
      if (!mounted.current || ticket !== generation.current) return;
      const previous = current.current;
      if (previous && performance.now() >= previous.expiresAt) {
        expiredWeek.current = previous.data.week_start;
      }
      if (conflictRef.current || (previous && performance.now() >= previous.expiresAt)) {
        current.current = null;
        setSnapshot(null);
      }
      setError(conflictRef.current ? conflictMessage : unavailable);
    } finally {
      clearTimeout(timeout!);
      if (mounted.current && ticket === generation.current) {
        operation.current = null;
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void request();
    const refresh = () => {
      const previous = current.current;
      if (previous && performance.now() >= previous.expiresAt) {
        expiredWeek.current = previous.data.week_start;
        current.current = null;
        setSnapshot(null);
        void request(undefined, true);
      } else if (document.visibilityState === "visible") {
        void request();
      }
    };
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted.current = false;
      generation.current += 1;
      operation.current?.cancel();
      operation.current = null;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [request]);

  function reload() {
    conflictRef.current = false;
    setConflict(false);
    void request(undefined, true);
  }

  function toggle(activity: RoutineCompletion, completed: boolean) {
    const value = current.current;
    if (!value || operation.current || conflictRef.current) return;
    if (performance.now() >= value.expiresAt) {
      expiredWeek.current = value.data.week_start;
      current.current = null;
      setSnapshot(null);
      void request(undefined, true);
      return;
    }
    void request({ ...activity, completed, expected_week_start: value.data.week_start });
  }

  return {
    pending,
    error,
    conflict,
    reload,
    toggle,
    ready: snapshot !== null && !conflict && !error,
    isCompleted: (activity: RoutineCompletion) =>
      snapshot?.data.completions.some((completion) => sameActivity(completion, activity)) ?? false,
  };
}
