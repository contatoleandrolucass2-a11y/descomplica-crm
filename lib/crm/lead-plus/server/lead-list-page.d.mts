export type LeadPageContext = {
  ownerIds: string[] | null;
  actorId: string;
  filters: {
    q: string;
    owner: string;
    status: "all" | "active" | "archived";
    category: "todo" | "visits" | "future" | "favorites" | "all";
  };
  limit: number;
  fingerprint: string;
  asOf: string;
  after: { created: string; id: string } | null;
};
export function leadPageRequest(
  searchParams: URLSearchParams,
  scope: { ownerIds: string[] | null; actorId: string },
  now?: Date,
): LeadPageContext;
export function nextLeadCursor(
  context: LeadPageContext,
  last: { cursor_created_at: string; id: string },
): string;
