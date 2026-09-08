import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const defaultSnapshotSha256 = "f31e6fe6a8dac204e767744903a6ae957f9bd526ed190e8cdf193c3479e61b24";
let validatedSnapshot: string | null = null;

function resolveSnapshotPath(): string {
  const configuredPath = process.env.INVESTOR_INVENTORY_SNAPSHOT_PATH?.trim();
  if (!configuredPath || !path.isAbsolute(configuredPath)) {
    throw new Error("inventory_snapshot_path_invalid");
  }
  return configuredPath;
}

async function readValidatedSnapshot(): Promise<string> {
  if (validatedSnapshot !== null) return validatedSnapshot;

  const contents = await readFile(/* turbopackIgnore: true */ resolveSnapshotPath(), "utf8");
  const snapshotSha256 = createHash("sha256").update(contents).digest("hex");
  const expectedSha256 =
    process.env.INVESTOR_INVENTORY_SNAPSHOT_SHA256?.trim() || defaultSnapshotSha256;
  const parsed = JSON.parse(contents) as {
    source?: unknown;
    count?: unknown;
    items?: Array<{ id?: unknown }>;
  };
  if (
    snapshotSha256 !== expectedSha256 ||
    parsed.source !== "ESTOQUE SPC.xlsx" ||
    parsed.count !== 3301 ||
    !Array.isArray(parsed.items) ||
    parsed.items.length !== parsed.count ||
    new Set(parsed.items.map((item) => item?.id)).size !== parsed.count
  ) {
    throw new Error("inventory_snapshot_invalid");
  }

  validatedSnapshot = JSON.stringify({
    ...parsed,
    sourceKind: "versioned-snapshot",
    snapshotReferenceDate:
      process.env.INVESTOR_INVENTORY_SNAPSHOT_REFERENCE_DATE?.trim() || "2026-09-05",
    snapshotSha256,
  });
  return validatedSnapshot;
}

export async function GET() {
  const authorization = await authorizeRoute("crm.simulators.view");
  if (!authorization.ok) return authorization.response;

  try {
    const snapshot = await readValidatedSnapshot();
    return new Response(snapshot, {
      headers: noStoreHeaders({ "content-type": "application/json; charset=utf-8" }),
    });
  } catch {
    return Response.json(
      { error: "inventory_snapshot_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
