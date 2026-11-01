export function postgresStore(pool: unknown): {
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
