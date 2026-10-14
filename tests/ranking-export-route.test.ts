import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPrivilegedClient: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/privileged", () => ({
  createPrivilegedClient: mocks.createPrivilegedClient,
}));

import { GET } from "@/app/api/export/ranking/route";

const endpoint = "https://crm.example.test/api/export/ranking";
const secret = "ranking_export_secret_123456789012";

function request(token = secret) {
  return new Request(endpoint, { headers: { authorization: `Bearer ${token}` } });
}

function queryResult<T>(data: T, error: unknown = null) {
  return Promise.resolve({ data, error });
}

function configureSupabase(input: {
  snapshot?: Record<string, unknown> | null;
  participants?: Array<Record<string, unknown>>;
  snapshotError?: unknown;
  participantsError?: unknown;
}) {
  const snapshotEq = vi.fn(() =>
    Object.assign(
      {},
      {
        maybeSingle: () => queryResult(input.snapshot ?? null, input.snapshotError ?? null),
      },
    ),
  );
  const participantsEq = vi.fn(() =>
    queryResult(input.participants ?? [], input.participantsError ?? null),
  );
  const selectSnapshot = vi.fn(() => ({ eq: snapshotEq }));
  const selectParticipants = vi.fn(() => ({ eq: participantsEq }));
  const from = vi.fn((table: string) => {
    if (table === "crm_ranking_snapshots") return { select: selectSnapshot };
    if (table === "crm_ranking_participants") return { select: selectParticipants };
    throw new Error(`unexpected table ${table}`);
  });

  mocks.createPrivilegedClient.mockReturnValue({ from });
  return { from, snapshotEq, participantsEq };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("ranking export route", () => {
  it("stays unavailable until an export secret is configured", async () => {
    vi.stubEnv("RANKING_EXPORT_SECRET", "");

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "export_unavailable" });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("rejects invalid bearer tokens before reading ranking tables", async () => {
    vi.stubEnv("RANKING_EXPORT_SECRET", secret);

    const response = await GET(request("wrong_secret_12345678901234567890"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("exports the sanitized ranking snapshot for Qlik REST ingestion", async () => {
    vi.stubEnv("RANKING_EXPORT_SECRET", secret);
    const queries = configureSupabase({
      snapshot: {
        id: 42,
        reference_date: "2026-08-07",
        generated_at: "2026-08-07T04:04:00.000Z",
        timezone: "America/Sao_Paulo",
        source: "Salesforce",
        roulette_available: false,
      },
      participants: [
        {
          period_key: "month",
          broker_key: "talita-alves",
          broker_name: "Talita Alves",
          manager_name: "Wellington Messias",
          roulette: "0",
          roulette_saturday: 0,
          roulette_sunday: 0,
          schedule: 10,
          visit: 5,
          approved_folder: 2,
          sale: 1,
        },
      ],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(queries.snapshotEq).toHaveBeenCalledWith("snapshot_key", "global");
    expect(queries.participantsEq).toHaveBeenCalledWith("snapshot_id", 42);
    expect(body).toMatchObject({
      schemaVersion: 1,
      snapshot: {
        referenceDate: "2026-08-07",
        generatedAt: "2026-08-07T04:04:00.000Z",
        timezone: "America/Sao_Paulo",
        source: "Salesforce",
        rouletteAvailable: false,
      },
      participants: [
        {
          periodKey: "month",
          brokerKey: "talita-alves",
          brokerName: "Talita Alves",
          managerName: "Wellington Messias",
          roulette: 0,
          schedule: 10,
          visit: 5,
          approvedFolder: 2,
          sale: 1,
        },
      ],
    });
    expect(body.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns an empty export when no ranking snapshot exists", async () => {
    vi.stubEnv("RANKING_EXPORT_SECRET", secret);
    configureSupabase({ snapshot: null });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      snapshot: null,
      participants: [],
    });
  });

  it("sanitizes database failures", async () => {
    vi.stubEnv("RANKING_EXPORT_SECRET", secret);
    configureSupabase({ snapshot: null, snapshotError: { message: "private sql detail" } });

    const response = await GET(request());
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toBe('{"error":"export_unavailable"}');
    expect(serialized).not.toContain("private sql detail");
  });
});
