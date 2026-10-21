import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchIntegrationEvidence,
  getIntegrationServiceStatuses,
} from "@/lib/crm/integrations/service-status";

const checkedAt = "2026-10-13T14:00:00.000Z";
const completedAt = "2026-10-13T13:59:00.000Z";
const fetchMock = vi.fn();
function response(ingestion: { status: string | null; completedAt: string | null }) {
  return {
    generatedAt: completedAt,
    ingestion,
    refresh: { status: null, requestedAt: null },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(checkedAt);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("integration service evidence", () => {
  it("confirms a dated ingestion and a separate authenticated read", async () => {
    fetchMock.mockResolvedValue(Response.json(response({ status: "succeeded", completedAt })));
    const signal = new AbortController().signal;
    const evidence = await fetchIntegrationEvidence(signal);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/status", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    expect(getIntegrationServiceStatuses(evidence)).toMatchObject({
      n8n: {
        state: "confirmed",
        label: "Ingestão confirmada",
        timestamp: completedAt,
        note: "Disponibilidade atual não verificada.",
      },
      supabase: { label: "Leitura confirmada", timestamp: checkedAt },
    });
    expect(evidence?.generatedAt).toBe(completedAt);
  });

  it("keeps an old receipt historical instead of claiming ongoing n8n availability", async () => {
    const oldReceipt = "2026-08-01T12:00:00.000Z";
    fetchMock.mockResolvedValue(
      Response.json(response({ status: "succeeded", completedAt: oldReceipt })),
    );
    const statuses = getIntegrationServiceStatuses(
      await fetchIntegrationEvidence(new AbortController().signal),
    );
    expect(statuses.n8n).toMatchObject({
      label: "Ingestão confirmada",
      timestamp: oldReceipt,
      note: "Disponibilidade atual não verificada.",
    });
    expect(statuses.supabase.timestamp).toBe(checkedAt);
    expect(JSON.stringify(statuses)).not.toMatch(/Conectado|Online/);
  });

  it.each([
    { status: null, completedAt: null },
    { status: "running", completedAt: null },
    { status: "succeeded", completedAt: null },
  ])("does not infer delivery from a successful database probe (%s)", async (ingestion) => {
    fetchMock.mockResolvedValue(Response.json(response(ingestion)));
    const statuses = getIntegrationServiceStatuses(
      await fetchIntegrationEvidence(new AbortController().signal),
    );
    expect(statuses.n8n).toMatchObject({ state: "unverified", timestamp: null });
    expect(statuses.supabase.state).toBe("confirmed");
  });

  it("distinguishes failed ingestion from a successful Supabase read", async () => {
    fetchMock.mockResolvedValue(Response.json(response({ status: "failed", completedAt })));
    const statuses = getIntegrationServiceStatuses(
      await fetchIntegrationEvidence(new AbortController().signal),
    );
    expect(statuses.n8n).toMatchObject({
      label: "Última ingestão falhou",
      state: "unavailable",
      timestamp: completedAt,
    });
    expect(statuses.supabase.state).toBe("confirmed");
  });

  it.each([401, 403, 503])("leaves both services unverified after HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(Response.json({ error: "unavailable" }, { status }));
    const evidence = await fetchIntegrationEvidence(new AbortController().signal);
    expect(evidence).toBeNull();
    const statuses = getIntegrationServiceStatuses(evidence);
    expect(statuses.n8n.state).toBe("unverified");
    expect(statuses.supabase).toMatchObject({ state: "unverified", timestamp: null });
  });

  it.each([
    {},
    { status: "ok", version: "synthetic-health" },
    { lastPublishedAt: completedAt },
    response({ status: "success", completedAt }),
    response({ status: "succeeded", completedAt: "invalid-date" }),
    response({ status: "succeeded", completedAt: "2026-10-14T00:00:00.000Z" }),
  ])("rejects absent, unrelated or malformed evidence (%s)", async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    expect(await fetchIntegrationEvidence(new AbortController().signal)).toBeNull();
  });

  it("clears a prior success when the next read fails", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(response({ status: "succeeded", completedAt })));
    fetchMock.mockRejectedValueOnce(new Error("synthetic network failure"));
    const signal = new AbortController().signal;
    expect(await fetchIntegrationEvidence(signal)).not.toBeNull();
    expect(await fetchIntegrationEvidence(signal)).toBeNull();
  });

  it("discards an aborted response", async () => {
    fetchMock.mockResolvedValue(Response.json(response({ status: "succeeded", completedAt })));
    const controller = new AbortController();
    controller.abort();
    expect(await fetchIntegrationEvidence(controller.signal)).toBeNull();
  });
});
