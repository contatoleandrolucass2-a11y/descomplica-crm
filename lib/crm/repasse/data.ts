import "server-only";

import { sign } from "node:crypto";

import { z } from "zod";

import type { RepasseRecord } from "./contracts";

const REPASSE_SPREADSHEET_ID = "1v0ST25OQrtd_LUXfGnX_9AI7GqNSQghADFzrE6k1DeE";
const REPASSE_SHEET_NAME = "Table 1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_ORIGIN = "https://sheets.googleapis.com";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const REPASSE_SOURCE_TIMEOUT_MS = 8_000;
const REPASSE_SOURCE_MAX_BYTES = 200_000;
const REPASSE_MAX_ROWS = 50_000;
const FID_PATTERN = /^[0-9]{1,12}$/u;
const SOURCE_DATE_PATTERN = /\b(\d{2})\/(\d{2})\/(\d{4})\b/u;
const SOURCE_HEADERS = ["FID", "EMPREENDIMENTO", "ETAPA", "STATUS", "NOME CLIENTE", "MOTIVO"];
const LOCAL_QA_FIDS = {
  ready: "900000000001",
  conflict: "900000000002",
  unavailable: "900000000003",
} as const;

const sourceDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().max(3_600),
  token_type: z.literal("Bearer"),
});

const sheetCellSchema = z.union([z.string(), z.number(), z.boolean()]);
const sheetValuesSchema = z.object({
  valueRanges: z
    .array(
      z.object({
        range: z.string(),
        majorDimension: z.literal("ROWS").optional(),
        values: z.array(z.array(sheetCellSchema).max(6)).max(REPASSE_MAX_ROWS).optional(),
      }),
    )
    .max(2),
});

type SheetCell = z.infer<typeof sheetCellSchema>;
type SheetRow = SheetCell[];

export type RepasseSourceResult =
  | { status: "not_found"; lastUpdated: string | null }
  | { status: "conflict"; lastUpdated: string | null }
  | { status: "ready"; lastUpdated: string | null; record: RepasseRecord };

export class RepasseSourceError extends Error {
  constructor() {
    super("Repasse source unavailable.");
    this.name = "RepasseSourceError";
  }
}

let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

function cellText(row: SheetRow | undefined, index: number): string | null {
  const value = row?.[index];
  if (value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

async function readBoundedBody(response: Response): Promise<string> {
  if (!response.body) throw new RepasseSourceError();

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > REPASSE_SOURCE_MAX_BYTES) {
    throw new RepasseSourceError();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > REPASSE_SOURCE_MAX_BYTES) {
        await reader.cancel();
        throw new RepasseSourceError();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RepasseSourceError) throw error;
    throw new RepasseSourceError();
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchJson(url: URL | string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REPASSE_SOURCE_TIMEOUT_MS),
    });
  } catch {
    throw new RepasseSourceError();
  }
  if (!response.ok) throw new RepasseSourceError();

  try {
    return JSON.parse(await readBoundedBody(response)) as unknown;
  } catch (error) {
    if (error instanceof RepasseSourceError) throw error;
    throw new RepasseSourceError();
  }
}

function base64UrlJson(value: object) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

async function requestAccessToken() {
  const email = process.env.REPASSE_GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const encodedPrivateKey = process.env.REPASSE_GOOGLE_PRIVATE_KEY_BASE64?.trim();
  if (!email || !encodedPrivateKey || encodedPrivateKey.length > 32_768) {
    throw new RepasseSourceError();
  }

  let privateKey: string;
  try {
    privateKey = Buffer.from(encodedPrivateKey, "base64").toString("utf8").trim();
  } catch {
    throw new RepasseSourceError();
  }
  if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) throw new RepasseSourceError();

  const issuedAt = Math.floor(Date.now() / 1_000);
  const unsignedToken = [
    base64UrlJson({ alg: "RS256", typ: "JWT" }),
    base64UrlJson({
      iss: email,
      scope: GOOGLE_SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3_600,
    }),
  ].join(".");

  let signature: string;
  try {
    signature = sign("RSA-SHA256", Buffer.from(unsignedToken), privateKey).toString("base64url");
  } catch {
    throw new RepasseSourceError();
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${unsignedToken}.${signature}`,
  });
  const parsed = tokenResponseSchema.safeParse(
    await fetchJson(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
  if (!parsed.success) throw new RepasseSourceError();

  tokenCache = {
    value: parsed.data.access_token,
    expiresAt: Date.now() + parsed.data.expires_in * 1_000,
  };
  return tokenCache.value;
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt - Date.now() > 60_000) return tokenCache.value;
  tokenInFlight ??= requestAccessToken().finally(() => {
    tokenInFlight = null;
  });
  return tokenInFlight;
}

function buildValuesUrl(ranges: string[]) {
  const url = new URL(
    `/v4/spreadsheets/${REPASSE_SPREADSHEET_ID}/values:batchGet`,
    GOOGLE_SHEETS_ORIGIN,
  );
  for (const range of ranges) url.searchParams.append("ranges", `'${REPASSE_SHEET_NAME}'!${range}`);
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  return url;
}

async function readRanges(ranges: string[]) {
  const token = await getAccessToken();
  const parsed = sheetValuesSchema.safeParse(
    await fetchJson(buildValuesUrl(ranges), {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }),
  );
  if (!parsed.success || parsed.data.valueRanges.length !== ranges.length) {
    throw new RepasseSourceError();
  }
  return parsed.data.valueRanges.map((range) => range.values ?? []);
}

function parseLastUpdated(row: SheetRow | undefined): string | null {
  const match = cellText(row, 0)?.match(SOURCE_DATE_PATTERN);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return sourceDateFormatter.format(date);
}

function validateSourceHeaders(row: SheetRow | undefined) {
  const headers = SOURCE_HEADERS.map((_, index) => cellText(row, index));
  if (headers.some((header, index) => header !== SOURCE_HEADERS[index])) {
    throw new RepasseSourceError();
  }
}

function parseRecord(row: SheetRow | undefined): RepasseRecord {
  return {
    empreendimento: cellText(row, 1),
    etapa: cellText(row, 2),
    status: cellText(row, 3),
    nomeCliente: cellText(row, 4),
    motivo: cellText(row, 5),
  };
}

function isLoopbackUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

function localVisualQaResult(fid: string): RepasseSourceResult | null {
  if (
    process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA !== "true" ||
    !isLoopbackUrl(process.env.APP_ORIGIN) ||
    !isLoopbackUrl(process.env.SUPABASE_URL)
  ) {
    return null;
  }
  if (fid === LOCAL_QA_FIDS.unavailable) throw new RepasseSourceError();
  if (fid === LOCAL_QA_FIDS.conflict) return { status: "conflict", lastUpdated: "06/10/2026" };
  if (fid !== LOCAL_QA_FIDS.ready) return { status: "not_found", lastUpdated: "06/10/2026" };
  return {
    status: "ready",
    lastUpdated: "06/10/2026",
    record: {
      empreendimento: "Residencial Sintético",
      etapa: "Assinatura de contrato",
      status: "Repassado",
      nomeCliente: "Cliente Sintético",
      motivo: "Repasse concluído em ambiente local de QA.",
    },
  };
}

export async function lookupRepasseByFid(fid: string): Promise<RepasseSourceResult> {
  if (!FID_PATTERN.test(fid)) throw new RepasseSourceError();
  const qaResult = localVisualQaResult(fid);
  if (qaResult) return qaResult;

  const [metadataRows, fidRows] = await readRanges(["A1:F2", "A3:A"]);
  validateSourceHeaders(metadataRows?.[1]);
  const lastUpdated = parseLastUpdated(metadataRows?.[0]);
  const matchingRowNumbers = (fidRows ?? []).flatMap((row, index) =>
    cellText(row, 0) === fid ? [index + 3] : [],
  );

  if (matchingRowNumbers.length === 0) return { status: "not_found", lastUpdated };
  if (matchingRowNumbers.length !== 1) return { status: "conflict", lastUpdated };

  const rowNumber = matchingRowNumbers[0]!;
  const [verificationFidRows, recordRows] = await readRanges([
    "A3:A",
    `A${rowNumber}:F${rowNumber}`,
  ]);
  const verifiedMatches = (verificationFidRows ?? []).flatMap((row, index) =>
    cellText(row, 0) === fid ? [index + 3] : [],
  );
  if (
    verifiedMatches.length !== 1 ||
    verifiedMatches[0] !== rowNumber ||
    recordRows?.length !== 1 ||
    cellText(recordRows[0], 0) !== fid
  ) {
    throw new RepasseSourceError();
  }
  return { status: "ready", lastUpdated, record: parseRecord(recordRows[0]) };
}
