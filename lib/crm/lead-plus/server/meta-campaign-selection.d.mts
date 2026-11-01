export type CampaignSelection = { campaign_ids: string[]; version: number };
export function validateCampaignIds(ids: unknown): string[];
export function readCampaignSelection(store: {
  listResources: (kind: string) => Promise<Array<Record<string, unknown>>>;
}): Promise<CampaignSelection>;
export function saveCampaignSelection(
  store: {
    saveCampaignSelectionCAS: (ids: string[], version: number) => Promise<CampaignSelection>;
  },
  input: unknown,
  catalog: unknown,
): Promise<CampaignSelection>;
