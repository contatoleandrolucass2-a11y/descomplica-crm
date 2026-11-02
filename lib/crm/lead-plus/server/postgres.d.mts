export function postgresStore(pool: unknown): {
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
  analyticsHistory(ids: string[]): Promise<{ activities: unknown[]; events: unknown[] }>;
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
