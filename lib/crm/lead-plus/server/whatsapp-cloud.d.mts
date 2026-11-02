export type WhatsAppAccount = {
  id: string;
  organization_id: string;
  waba_id: string;
  phone_number_id: string;
  enabled: boolean;
};
export type WhatsAppEvent = {
  provider_event_key: string;
  organization_id: string;
  account_id: string;
  waba_id: string;
  phone_number_id: string;
  kind: "message" | "status";
  timestamp: string;
  whatsapp_message_id: string;
  from?: string;
  contact_name?: string;
  type?: string;
  content?: Record<string, string>;
  media_id?: string | null;
  referral?: Record<string, string> | null;
  status?: "sent" | "delivered" | "read" | "failed";
  recipient_id?: string;
  error_code?: number | null;
};
export type WhatsAppTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: Array<{ type: string; text?: string; format?: string }>;
};
export type WhatsAppOutboundInput =
  | { type: "text"; text: string }
  | { type: "image" | "document" | "audio"; media_id: string; caption?: string; filename?: string }
  | { type: "template"; template: { name: string; language: string; parameters?: string[] } };
export const WHATSAPP_MAX_MEDIA_BYTES: number;
export function validWhatsAppSignature(
  raw: string | Uint8Array,
  signature: string | null,
  secret: string,
): boolean;
export function verifyWhatsAppChallenge(
  params: URLSearchParams | Record<string, string>,
  verifyToken: string,
): string;
export function encryptWhatsAppCredential(value: string, key: string, context?: string): string;
export function decryptWhatsAppCredential(envelope: string, key: string, context?: string): string;
export function parseWhatsAppWebhook(
  payload: unknown,
  accounts: WhatsAppAccount[],
): WhatsAppEvent[];
export function isWhatsAppServiceWindowOpen(
  lastCustomerMessageAt: string | null | undefined,
  now?: number | Date,
): boolean;
export function normalizeWhatsAppOutbound(
  input: unknown,
  options?: {
    lastCustomerMessageAt?: string | null;
    now?: number | Date;
    templates?: WhatsAppTemplate[];
  },
): Record<string, unknown>;
export function validateWhatsAppMedia(media: {
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
}): { type: string; limit: number; mimeType: string; filename: string };
export function createWhatsAppCloudClient(options: {
  token: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
}): {
  numberStatus(phoneId: string, wabaId?: string): Promise<Record<string, string>>;
  templates(wabaId: string): Promise<WhatsAppTemplate[]>;
  send(
    phoneId: string,
    to: string,
    message: Record<string, unknown>,
  ): Promise<{ whatsapp_message_id: string }>;
  uploadMedia(
    phoneId: string,
    media: { bytes: Uint8Array; mimeType: string; filename?: string },
  ): Promise<{ media_id: string; type: string; mime_type: string; filename: string; size: number }>;
  downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime_type: string; size: number }>;
};
