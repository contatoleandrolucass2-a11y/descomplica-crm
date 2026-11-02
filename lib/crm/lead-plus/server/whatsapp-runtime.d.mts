export function whatsappCapabilities(
  session: Record<string, unknown>,
  identity: Record<string, unknown>,
  viewedIdentity?: Record<string, unknown>,
): Record<string, boolean>;
export function whatsappScope(
  session: Record<string, unknown>,
  users: Array<Record<string, unknown>>,
  env?: NodeJS.ProcessEnv,
): Record<string, unknown>;
export function handleWhatsAppRequest(
  request: Request,
  path: string,
  context: Record<string, unknown>,
): Promise<Response>;
export function receiveWhatsAppWebhook(
  request: Request,
  context: Record<string, unknown>,
): Promise<Response>;
export function tickWhatsApp(store: Record<string, unknown>): Promise<void>;
