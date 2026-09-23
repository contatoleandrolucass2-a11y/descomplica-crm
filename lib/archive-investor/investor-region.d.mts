export interface InvestorRegionItem {
  region?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  postalCode?: string | null;
}

export function resolveInvestorRegion(item: InvestorRegionItem): string;
