"use client";

import { useState } from "react";

type State = "idle" | "loading" | "started" | "already_running" | "rate_limited" | "error";

const MESSAGES: Record<State, string> = {
  idle: "",
  loading: "Solicitando atualização…",
  started: "Atualização solicitada. Os dados serão renovados após a ingestão.",
  already_running: "Já existe uma atualização em andamento.",
  rate_limited: "Aguarde um minuto antes de solicitar novamente.",
  error: "Não foi possível solicitar a atualização agora.",
};

export function SalesforceRefreshButton({ available }: { available: boolean }) {
  const [state, setState] = useState<State>("idle");

  if (!available) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 opacity-80"
        >
          Atualização indisponível
        </button>
        <span className="max-w-xs text-xs text-slate-300">
          Recurso indisponível neste ambiente.
        </span>
      </div>
    );
  }

  async function refresh() {
    setState("loading");
    try {
      const response = await fetch("/api/refresh/salesforce", {
        method: "POST",
        headers: { accept: "application/json" },
      });
      const body = (await response.json()) as { status?: string; error?: string };
      if (response.ok) {
        setState(body.status === "already_running" ? "already_running" : "started");
      } else if (response.status === 409) {
        setState("already_running");
      } else if (response.status === 429) {
        setState("rate_limited");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={refresh}
        disabled={state === "loading"}
        className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
      >
        Atualizar Salesforce
      </button>
      <span aria-live="polite" className="max-w-xs text-xs text-slate-300">
        {MESSAGES[state]}
      </span>
    </div>
  );
}
