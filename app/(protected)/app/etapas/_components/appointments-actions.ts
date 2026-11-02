"use server";

import { forbidden } from "next/navigation";
import { ZodError } from "zod";
import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getAuthorizedDashboardViews } from "@/lib/authorization/dashboard-views";
import { loadAppointmentsReadModel } from "@/lib/crm/stages/data";
import {
  appointmentDetailPage,
  appointmentDetailsCsv,
  appointmentDetailRequestSchema,
  appointmentSnapshotIdentity,
} from "@/lib/crm/stages/appointments-detail-server";
import type {
  AppointmentDetailResult,
  AppointmentExportResult,
} from "@/lib/crm/stages/appointments-detail-contract";

async function authorizedRequest(input: unknown) {
  const actor = await enforcePageAccess("/app/etapas/agendamentos");
  const parsed = appointmentDetailRequestSchema.safeParse(input);
  if (!parsed.success) return null;
  if (!getAuthorizedDashboardViews(actor.permissions).includes(parsed.data.query.view)) forbidden();
  return parsed.data;
}

export async function readAppointmentDetailsAction(
  input: unknown,
): Promise<AppointmentDetailResult> {
  const request = await authorizedRequest(input);
  if (!request) return { status: "invalid_request" };
  try {
    const model = await loadAppointmentsReadModel(request.query.view);
    if (appointmentSnapshotIdentity(model) !== request.snapshot)
      return { status: "snapshot_changed" };
    return appointmentDetailPage(model, request.query, request.cursor);
  } catch (error) {
    return {
      status:
        error instanceof ZodError || error instanceof SyntaxError
          ? "invalid_request"
          : "unavailable",
    };
  }
}

export async function exportAppointmentDetailsAction(
  input: unknown,
): Promise<AppointmentExportResult> {
  const request = await authorizedRequest(input);
  if (!request || request.cursor) return { status: "invalid_request" };
  try {
    const model = await loadAppointmentsReadModel(request.query.view);
    if (appointmentSnapshotIdentity(model) !== request.snapshot)
      return { status: "snapshot_changed" };
    return { status: "ready", ...appointmentDetailsCsv(model, request.query) };
  } catch {
    return { status: "unavailable" };
  }
}
