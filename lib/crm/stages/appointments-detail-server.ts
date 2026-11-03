import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { analyzeAppointments, saoPauloDate } from "./appointments";
import type { AppointmentFilters } from "./appointments";
import type { AppointmentsReadModel } from "./data";
import {
  APPOINTMENT_DETAIL_PAGE_SIZE,
  appointmentDetailQueryKey,
  type AppointmentDetailPage,
  type AppointmentDetailQuery,
  type AppointmentDetailResult,
} from "./appointments-detail-contract";

const label = z.string().max(200);
export const appointmentDetailQuerySchema = z
  .object({
    view: z.enum(["all", "with_canal_imob", "without_canal_imob"]),
    month: z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/u),
    year: z.string().regex(/^(?!0000)\d{4}$/u),
    calendarDate: z.iso.date(),
    subset: z.literal("overdue").optional(),
    filters: z
      .object({
        createdDate: z.iso.date().optional(),
        createdDates: z.array(z.iso.date()).max(500).optional(),
        periodStart: z.iso.date().optional(),
        periodEnd: z.iso.date().optional(),
        week: z.number().int().min(1).max(6).optional(),
        channel: z.union([z.literal(0), z.literal(1)]).optional(),
        regionalManager: label.optional(),
        manager: label.optional(),
        owner: label.optional(),
        company: label.optional(),
        accountRanking: label.optional(),
      })
      .strict()
      // The engine uses exact optional properties; remove validated undefined keys.
      .transform(
        (filters) =>
          Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value !== undefined),
          ) as AppointmentFilters,
      ),
  })
  .strict();
export const appointmentDetailRequestSchema = z
  .object({
    query: appointmentDetailQuerySchema,
    snapshot: z.string().regex(/^[a-f0-9]{64}$/u),
    cursor: z.string().max(512).nullable().optional(),
    all: z.literal(true).optional(),
  })
  .strict()
  .refine((request) => !request.all || request.cursor == null, {
    message: "A complete read cannot contain a cursor.",
    path: ["cursor"],
  });
const digest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? Object.fromEntries(
              Object.keys(entry)
                .sort()
                .map((key) => [key, entry[key]]),
            )
          : entry,
      ),
    )
    .digest("hex");

export function appointmentSnapshotIdentity(model: AppointmentsReadModel): string {
  return digest(model);
}

export function fullAppointmentDetails(
  model: AppointmentsReadModel,
  query: AppointmentDetailQuery,
) {
  if (!model.analysis) return null;
  const reading = analyzeAppointments(model.analysis, {
    month: query.month,
    year: query.year,
    calendarDate: query.calendarDate,
    filters: query.filters,
    brokerRoster: model.brokerRoster,
    goalsByMonth: model.goalsByMonth,
  });
  if (reading.coverage === "unavailable" || reading.details === null) return null;
  // Filter the complete authorized snapshot before pagination and CSV export.
  // scheduledAt is Salesforce ActivityDateTime: the planned appointment date/time.
  // attendedAt is the actual visit date and is normally null for an unvisited row.
  // Missing planned dates never fall back to creation or actual attendance dates.
  return query.subset === "overdue"
    ? reading.details.filter(
        (row) =>
          !row.visitPerformed &&
          row.scheduledAt !== null &&
          saoPauloDate(row.scheduledAt) < query.calendarDate,
      )
    : reading.details;
}

class AppointmentDetailsUnavailableError extends Error {
  constructor() {
    super("Appointment details unavailable.");
  }
}

function encodeCursor(snapshot: string, query: AppointmentDetailQuery, offset: number) {
  return Buffer.from(
    JSON.stringify({ snapshot, query: digest(appointmentDetailQueryKey(query)), offset }),
  ).toString("base64url");
}

export function appointmentDetailPage(
  model: AppointmentsReadModel,
  query: AppointmentDetailQuery,
  cursor?: string | null,
  all = false,
): AppointmentDetailPage {
  if (all && cursor != null) throw new Error("A complete read cannot contain a cursor.");
  const rows = fullAppointmentDetails(model, query);
  if (rows === null) throw new AppointmentDetailsUnavailableError();
  const snapshot = appointmentSnapshotIdentity(model);
  let offset = 0;
  if (cursor) {
    const decoded = z
      .object({
        snapshot: z.literal(snapshot),
        query: z.literal(digest(appointmentDetailQueryKey(query))),
        offset: z.number().int().min(0).max(20_000),
      })
      .strict()
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    offset = decoded.offset;
  }
  const total = rows.length;
  if (offset > total) throw new Error("Invalid detail cursor.");
  return {
    status: "ready",
    snapshot,
    total,
    offset,
    rows: all ? rows : rows.slice(offset, offset + APPOINTMENT_DETAIL_PAGE_SIZE),
    previousCursor:
      offset > 0
        ? encodeCursor(snapshot, query, Math.max(0, offset - APPOINTMENT_DETAIL_PAGE_SIZE))
        : null,
    nextCursor:
      !all && offset + APPOINTMENT_DETAIL_PAGE_SIZE < total
        ? encodeCursor(snapshot, query, offset + APPOINTMENT_DETAIL_PAGE_SIZE)
        : null,
  };
}

/** An uncovered initial calendar month is a source state, never an SSR failure. */
export function initialAppointmentDetailPage(
  model: AppointmentsReadModel,
  query: AppointmentDetailQuery,
): AppointmentDetailResult {
  try {
    return appointmentDetailPage(model, query);
  } catch (error) {
    if (error instanceof AppointmentDetailsUnavailableError) return { status: "unavailable" };
    throw error;
  }
}

export function appointmentDetailsCsv(
  model: AppointmentsReadModel,
  query: AppointmentDetailQuery,
): { csv: string; total: number } {
  const rows = fullAppointmentDetails(model, query);
  if (rows === null) throw new AppointmentDetailsUnavailableError();
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const values = rows.map((row) => [
    row.createdAt,
    row.daysSinceAppointment,
    row.scheduledAt,
    row.attendedAt,
    row.visitPerformed ? "Sim" : "Não",
    row.regionalManager,
    row.salesManager,
    row.owner,
    row.accountName,
    row.accountRanking,
  ]);
  const header = [
    "Data de criação",
    "Dias",
    "Horário agendado",
    "Comparecimento",
    "Visita realizada",
    "Gerente regional",
    "Gerente de vendas",
    "Corretor",
    "Conta",
    "Ranking",
  ];
  return {
    csv: [header, ...values].map((row) => row.map(cell).join(",")).join("\r\n"),
    total: rows.length,
  };
}
