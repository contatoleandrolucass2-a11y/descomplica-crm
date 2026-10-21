import { createClient } from "@/lib/auth/supabase/server";
import {
  createForecastTemplate,
  forecastBrokerListSchema,
  forecastPeriodRecordSchema,
  forecastPeriodQuerySchema,
  forecastPeriodRpcSchema,
  forecastPeriodSaveSchema,
  forecastSnapshotSchema,
  getForecastPeriod,
  orderForecastSources,
} from "@/lib/crm/forecasts";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

const MAX_BYTES = 2_000_000;
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers: noStoreHeaders() });

export async function GET(request: Request) {
  const authorization = await authorizePageRoute("/app/gestao/previsao");
  if (!authorization.ok) return authorization.response;
  try {
    const url = new URL(request.url);
    const selection = forecastPeriodQuerySchema.safeParse({
      date: url.searchParams.get("date") ?? "",
      segment: url.searchParams.get("segment") ?? "",
      manager: url.searchParams.get("manager") || null,
    });
    if (!selection.success) return failure("invalid_selection", 400);
    const period = getForecastPeriod(selection.data.date);
    if (!period) return failure("invalid_selection", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_crm_forecast_period", {
      p_weekend_start: period.start,
      p_segment: selection.data.segment,
      p_manager_key: selection.data.manager,
    });
    if (error?.code === "28000") return failure("unauthenticated", 401);
    if (error?.code === "42501") return failure("forbidden", 403);
    if (error?.code === "22023") return failure("invalid_selection", 400);
    const result = forecastPeriodRpcSchema.safeParse(data);
    if (error || !result.success) return failure("forecast_unavailable", 503);
    const sections =
      selection.data.segment === "general" ? orderForecastSources(result.data.forecasts) : [];
    const forecast =
      selection.data.segment === "general" ? null : (result.data.forecasts[0]?.forecast ?? null);
    let brokerNames: string[] = [];
    if (selection.data.segment !== "general" && !forecast) {
      const brokersResult = await supabase.rpc("get_crm_forecast_brokers", {
        p_segment: selection.data.segment,
        p_manager_key: selection.data.manager,
      });
      if (brokersResult.error?.code === "28000") return failure("unauthenticated", 401);
      if (brokersResult.error?.code === "42501") return failure("forbidden", 403);
      if (brokersResult.error?.code === "22023") return failure("invalid_selection", 400);
      const brokers = forecastBrokerListSchema.safeParse(brokersResult.data);
      if (brokersResult.error || !brokers.success) return failure("forecast_unavailable", 503);
      brokerNames = brokers.data;
    }
    const snapshot = forecastSnapshotSchema.safeParse({
      forecast,
      sections,
      template:
        selection.data.segment === "general" || forecast
          ? null
          : createForecastTemplate(result.data.template, brokerNames),
      brokers: brokerNames,
      can_edit: selection.data.segment === "general" ? false : result.data.can_edit,
      period,
      selection: { segment: selection.data.segment, manager: selection.data.manager },
    });
    if (!snapshot.success) return failure("forecast_unavailable", 503);
    return Response.json(snapshot.data, { headers: noStoreHeaders() });
  } catch {
    return failure("forecast_unavailable", 503);
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizePageRoute("/app/gestao/previsao");
  if (!authorization.ok) return authorization.response;
  if (!authorization.context.permissions.includes("crm.settings.manage"))
    return failure("forbidden", 403);
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) return failure("invalid_origin", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return failure("invalid_content_type", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return failure("body_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) return failure("invalid_forecast", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 10_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return failure("body_too_large", 413);
      }
      chunks.push(value);
    }
    if (timedOut) return failure("request_timeout", 408);
    clearTimeout(timer);
    const parsed = forecastPeriodSaveSchema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!parsed.success) return failure("invalid_forecast", 400);
    const period = getForecastPeriod(parsed.data.date);
    if (!period) return failure("invalid_selection", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_crm_forecast_period", {
      p_document: {
        title: parsed.data.title,
        columns: parsed.data.columns,
        rows: parsed.data.rows,
      },
      p_expected_revision: parsed.data.expected_revision,
      p_weekend_start: period.start,
      p_segment: parsed.data.segment,
      p_manager_key: parsed.data.manager,
    });
    if (error?.code === "40001") return failure("revision_conflict", 409);
    if (error?.code === "28000") return failure("unauthenticated", 401);
    if (error?.code === "42501") return failure("forbidden", 403);
    if (error?.code === "22023") return failure("invalid_forecast", 400);
    const saved = forecastPeriodRecordSchema.safeParse(data);
    if (error || !saved.success) return failure("forecast_unavailable", 503);
    return Response.json(saved.data, { headers: noStoreHeaders() });
  } catch (error) {
    return failure(
      error instanceof SyntaxError ? "invalid_forecast" : "forecast_unavailable",
      error instanceof SyntaxError ? 400 : 503,
    );
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
