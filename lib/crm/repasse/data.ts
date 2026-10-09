import "server-only";

import type {
  RepasseBoardColumn,
  RepasseBoardRecord,
  RepasseOverview,
  RepasseRecord,
} from "./contracts";

const REPASSE_SPREADSHEET_ID = "1v0ST25OQrtd_LUXfGnX_9AI7GqNSQghADFzrE6k1DeE";
const REPASSE_SHEET_GID = "798117742";
const GOOGLE_SHEETS_PUBLIC_ORIGIN = "https://docs.google.com";
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

type SheetRow = string[];

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

function cellText(row: SheetRow | undefined, index: number): string | null {
  const value = row?.[index];
  if (value === undefined) return null;
  const text = value.trim();
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
        void reader.cancel().catch(() => undefined);
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

async function fetchCsv(url: URL) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/csv" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REPASSE_SOURCE_TIMEOUT_MS),
    });
  } catch {
    throw new RepasseSourceError();
  }
  if (!response.ok) throw new RepasseSourceError();
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/csv")) {
    throw new RepasseSourceError();
  }

  return readBoundedBody(response);
}

function buildPublicRangeUrl(range: string) {
  const url = new URL(
    `/spreadsheets/d/${REPASSE_SPREADSHEET_ID}/gviz/tq`,
    GOOGLE_SHEETS_PUBLIC_ORIGIN,
  );
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("gid", REPASSE_SHEET_GID);
  url.searchParams.set("headers", "0");
  url.searchParams.set("range", range);
  return url;
}

function parseCsv(sourceText: string, maximumColumns: number): SheetRow[] {
  const source = sourceText.startsWith("\uFEFF") ? sourceText.slice(1) : sourceText;
  if (source === "") return [];
  if (source.includes("\0")) throw new RepasseSourceError();

  const rows: SheetRow[] = [];
  let row: SheetRow = [];
  let field = "";
  let state: "start" | "unquoted" | "quoted" | "after_quote" = "start";

  const pushField = () => {
    row.push(field);
    if (row.length > maximumColumns) throw new RepasseSourceError();
    field = "";
    state = "start";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    if (rows.length > REPASSE_MAX_ROWS) throw new RepasseSourceError();
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (state === "quoted") {
      if (character !== '"') {
        field += character;
        continue;
      }
      if (source[index + 1] === '"') {
        field += '"';
        index += 1;
        continue;
      }
      state = "after_quote";
      continue;
    }

    if (character === ",") {
      pushField();
      continue;
    }
    if (character === "\r" || character === "\n") {
      pushRow();
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      continue;
    }
    if (state === "after_quote") throw new RepasseSourceError();
    if (character === '"') {
      if (state !== "start") throw new RepasseSourceError();
      state = "quoted";
      continue;
    }
    field += character;
    state = "unquoted";
  }

  if (state === "quoted") throw new RepasseSourceError();
  if (!source.endsWith("\n") && !source.endsWith("\r")) pushRow();
  return rows;
}

async function readRange(range: string, maximumColumns: number) {
  return parseCsv(await fetchCsv(buildPublicRangeUrl(range)), maximumColumns);
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

function normalizeStatus(value: string | null) {
  return (
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .trim()
      .toUpperCase() ?? ""
  );
}

function boardColumn(status: string | null): RepasseBoardColumn {
  const normalized = normalizeStatus(status);
  if (/\b(?:DESIST\w*|DESISIT\w*|DISTRAT\w*)\b/u.test(normalized)) return "distrato";
  if (/^REPASSAD[AO]S?$/u.test(normalized)) return "repassado";
  if (/\b(?:MAIS|ACIMA)\s+DE\s+20\s+DIAS\b/u.test(normalized)) {
    return "mais_de_20_dias";
  }
  const duration = normalized.match(/\b(\d{1,4})\s+DIAS\b/u);
  if (duration && Number(duration[1]) > 20) return "mais_de_20_dias";
  return "pendencia";
}

function parseBoardRecord(row: SheetRow, sourceRow: number): RepasseBoardRecord | null {
  if (row.every((_, index) => cellText(row, index) === null)) return null;
  const status = cellText(row, 3);
  return {
    sourceRow,
    fid: cellText(row, 0),
    empreendimento: cellText(row, 1),
    etapa: cellText(row, 2),
    status,
    nomeCliente: cellText(row, 4),
    column: boardColumn(status),
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

function localVisualQaOverview(): RepasseOverview | null {
  if (
    process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA !== "true" ||
    !isLoopbackUrl(process.env.APP_ORIGIN) ||
    !isLoopbackUrl(process.env.SUPABASE_URL)
  ) {
    return null;
  }

  const records = [
    [
      "900000000001",
      "Residencial Sintético",
      "Assinatura de contrato",
      "Repassado",
      "Cliente Sintético 01",
    ],
    ["900000000004", "Parque Modelo", "Montagem de pasta", "Repassado", "Cliente Sintético 02"],
    [
      "900000000005",
      "Residencial Sintético",
      "Análise de crédito",
      "Em análise",
      "Cliente Sintético 03",
    ],
    [
      "900000000006",
      "Parque Modelo",
      "Assinatura de contrato",
      "Aguardando PJ",
      "Cliente Sintético 04",
    ],
    [
      "900000000007",
      "Residencial Sintético",
      "Assinatura de contrato",
      "26 dias sem repasse",
      "Cliente Sintético 05",
    ],
    ["900000000008", "Parque Modelo", "Montagem de pasta", "31 dias", "Cliente Sintético 06"],
    [
      "900000000009",
      "Residencial Sintético",
      "Assinatura não realizada",
      "Desistência",
      "Cliente Sintético 07",
    ],
    ["900000000010", "Parque Modelo", "Negociação financeira", "Distrato", "Cliente Sintético 08"],
  ];

  return {
    lastUpdated: "06/10/2026",
    records: records.flatMap((row, index) => {
      const record = parseBoardRecord(row, index + 3);
      return record ? [record] : [];
    }),
  };
}

export async function listRepasseOverview(): Promise<RepasseOverview> {
  const qaOverview = localVisualQaOverview();
  if (qaOverview) return qaOverview;

  const [metadataRows, boardRows] = await Promise.all([
    readRange("A1:F2", 6),
    readRange("A3:E", 5),
  ]);
  validateSourceHeaders(metadataRows[1]);
  return {
    lastUpdated: parseLastUpdated(metadataRows[0]),
    records: boardRows.flatMap((row, index) => {
      const record = parseBoardRecord(row, index + 3);
      return record ? [record] : [];
    }),
  };
}

export async function lookupRepasseByFid(fid: string): Promise<RepasseSourceResult> {
  if (!FID_PATTERN.test(fid)) throw new RepasseSourceError();
  const qaResult = localVisualQaResult(fid);
  if (qaResult) return qaResult;

  const [metadataRows, fidRows] = await Promise.all([readRange("A1:F2", 6), readRange("A3:A", 1)]);
  validateSourceHeaders(metadataRows[1]);
  const lastUpdated = parseLastUpdated(metadataRows[0]);
  const matchingRowNumbers = fidRows.flatMap((row, index) =>
    cellText(row, 0) === fid ? [index + 3] : [],
  );

  if (matchingRowNumbers.length === 0) return { status: "not_found", lastUpdated };
  if (matchingRowNumbers.length !== 1) return { status: "conflict", lastUpdated };

  const rowNumber = matchingRowNumbers[0]!;
  const [verificationFidRows, recordRows] = await Promise.all([
    readRange("A3:A", 1),
    readRange(`A${rowNumber}:F${rowNumber}`, 6),
  ]);
  const verifiedMatches = verificationFidRows.flatMap((row, index) =>
    cellText(row, 0) === fid ? [index + 3] : [],
  );
  if (
    verifiedMatches.length !== 1 ||
    verifiedMatches[0] !== rowNumber ||
    recordRows.length !== 1 ||
    cellText(recordRows[0], 0) !== fid
  ) {
    throw new RepasseSourceError();
  }
  return { status: "ready", lastUpdated, record: parseRecord(recordRows[0]) };
}
