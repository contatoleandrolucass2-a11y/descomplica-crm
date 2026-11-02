export function postgresStore(pool: unknown): {
  leadPage(context: import("./lead-list-page.mjs").LeadPageContext): Promise<{
    data: Record<string, unknown>[];
    total: number;
    counts: Record<string, number>;
    filters: import("./lead-list-page.mjs").LeadPageContext["filters"];
    next_transition_at: string | null;
    snapshot: string;
    next_cursor: string | null;
    server_time: string;
  }>;
  leads(options?: {
    ownerIds?: string[] | null;
    summary?: boolean;
  }): Promise<Record<string, unknown>[]>;
  dashboard(options?: { ownerIds?: string[] | null }): Promise<{
    total: number;
    active: number;
    archived: number;
    stages: { name: string; count: number; value: number }[];
    sources: { name: string; leads: number; convertidos: number }[];
  }>;
  analyticsHistory(
    ids: string[],
    options?: { eventIds?: string[] },
  ): Promise<{ activities: unknown[]; events: unknown[] }>;
  saveCampaignSelectionCAS(
    ids: string[],
    version: number,
  ): Promise<{ campaign_ids: string[]; version: number }>;
  createMetaLead(
    input: Record<string, unknown>,
    key: string,
    owners: Set<string>,
  ): Promise<unknown>;
  ignoreMeta(id: string, code?: string): Promise<unknown>;
};
