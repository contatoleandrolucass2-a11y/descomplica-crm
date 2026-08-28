import "server-only";

import { readFile, stat } from "node:fs/promises";

import { applySecurityHeaders } from "@/lib/security/headers";
import { authorizeRoute, type RouteAuthorizationResult } from "@/lib/security/route-auth";

import { inventorySourceEnvelopeSchema, reconcileInventoryItems } from "./contract";

const MAX_SOURCE_BYTES = 2_000_000;
const SOURCE_TIMEOUT_MS = 8_000;

type InventoryEnvironment = {
  [key: string]: string | undefined;
  CRM_INVENTORY_RUNTIME_MODE?: string;
  CRM_INVENTORY_SOURCE_URL?: string;
  CRM_INVENTORY_SOURCE_AUTH_FILE?: string;
};

type InventoryConfiguration =
  | { available: false }
  | { available: true; sourceUrl: URL; authFile: string };

export type InventoryHandlerDependencies = {
  authorize: typeof authorizeRoute;
  configuration: () => InventoryConfiguration;
  fetchSource: typeof fetch;
  readAuth: (path: string) => Promise<string>;
};

function noStoreHeaders(request: Request): Headers {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
  });
  applySecurityHeaders(headers, {
    isProd: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:",
  });
  return headers;
}

function json(request: Request, body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: noStoreHeaders(request) });
}

function authorizationResponse(request: Request, result: RouteAuthorizationResult): Response {
  if (result.ok) return json(request, { error: "forbidden" }, 403);
  return new Response(result.response.body, {
    status: result.response.status,
    headers: noStoreHeaders(request),
  });
}

function getInventoryConfiguration(
  environment: InventoryEnvironment = process.env,
): InventoryConfiguration {
  if (environment.CRM_INVENTORY_RUNTIME_MODE?.trim() !== "active") {
    return { available: false };
  }
  const authFile = environment.CRM_INVENTORY_SOURCE_AUTH_FILE?.trim();
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(environment.CRM_INVENTORY_SOURCE_URL ?? "");
  } catch {
    return { available: false };
  }
  if (
    sourceUrl.protocol !== "https:" ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.hostname === "descomplicapro.com.br" ||
    !authFile?.startsWith("/")
  ) {
    return { available: false };
  }
  return { available: true, sourceUrl, authFile };
}

async function readRootOnlyAuth(path: string): Promise<string> {
  const metadata = await stat(path);
  if (
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o640 ||
    !metadata.isFile()
  ) {
    throw new Error("inventory_auth_file_not_root_only");
  }
  const value = (await readFile(path, "utf8")).trim();
  if (!value || value.length > 8_192 || /[\r\n]/.test(value)) {
    throw new Error("inventory_auth_file_invalid");
  }
  return value;
}

const defaultDependencies: InventoryHandlerDependencies = {
  authorize: authorizeRoute,
  configuration: getInventoryConfiguration,
  fetchSource: fetch,
  readAuth: readRootOnlyAuth,
};

export async function handleInventoryGet(
  request: Request,
  dependencies: InventoryHandlerDependencies = defaultDependencies,
): Promise<Response> {
  const authorization = await dependencies.authorize("crm.simulators.view");
  if (!authorization.ok) return authorizationResponse(request, authorization);
  if (authorization.context.roleKey !== "master") {
    return json(request, { error: "forbidden" }, 403);
  }
  if (new URL(request.url).search) return json(request, { error: "invalid_query" }, 400);

  const configuration = dependencies.configuration();
  if (!configuration.available) {
    return json(request, { error: "inventory_unavailable" }, 503);
  }

  try {
    const authorizationHeader = await dependencies.readAuth(configuration.authFile);
    const response = await dependencies.fetchSource(configuration.sourceUrl, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: authorizationHeader,
      },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    });
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (!response.ok || (contentLength > 0 && contentLength > MAX_SOURCE_BYTES)) {
      return json(request, { error: "inventory_unavailable" }, 503);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SOURCE_BYTES) {
      return json(request, { error: "inventory_unavailable" }, 503);
    }
    const parsed = inventorySourceEnvelopeSchema.safeParse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (!parsed.success) return json(request, { error: "inventory_unavailable" }, 503);
    const items = reconcileInventoryItems(parsed.data.items);
    return json(
      request,
      {
        schemaVersion: 1,
        state: items.length > 0 ? "available" : "empty",
        updatedAt: items.reduce(
          (oldest, item) => (!oldest || item.updatedAt < oldest ? item.updatedAt : oldest),
          "",
        ),
        items,
      },
      200,
    );
  } catch {
    return json(request, { error: "inventory_unavailable" }, 503);
  }
}
