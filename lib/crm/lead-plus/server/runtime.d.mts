export function membershipSession(
  users: Array<Record<string, unknown>>,
  identity: {
    id: string;
    email: string;
    token: string;
    authorizedPages?: string[];
    canonicalPermissions?: string[];
  },
): unknown;
export function handleLeadPlus(
  request: Request,
  path: string,
  identity: {
    id: string;
    email: string;
    token: string;
    authorizedPages?: string[];
    canonicalPermissions?: string[];
  },
  dependencies?: Record<string, unknown>,
): Promise<Response>;
export function getLeadPlusStore(): unknown;
export function tickLeadPlus(): Promise<void>;
export function handleMetaWebhook(
  request: Request,
  dependencies?: Record<string, unknown>,
): Promise<Response>;

export function handleWhatsAppWebhook(request: Request, dependencies?: Record<string, unknown>): Promise<Response>;
