import "server-only";

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { salesforceInventorySchema } from "./inventory-contract";

let cached: { path: string; body: string; until: number } | null = null;
let pending: { path: string; result: Promise<string> } | null = null;

export function hasSalesforceInventory() {
  return Boolean(process.env.SALESFORCE_INVENTORY_PATH?.trim());
}

export async function readSalesforceInventory(): Promise<string> {
  const configured = process.env.SALESFORCE_INVENTORY_PATH?.trim();
  if (!configured || !path.isAbsolute(configured)) throw new Error("inventory_path_invalid");
  if (cached?.path === configured && cached.until > Date.now()) return cached.body;
  if (pending?.path === configured) return pending.result;
  const result = (async () => {
    const handle = await open(configured, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.size > 8 * 1024 * 1024 || metadata.size === 0) {
        throw new Error("inventory_file_invalid");
      }
      const contents = await handle.readFile({
        encoding: "utf8",
        signal: AbortSignal.timeout(20_000),
      });
      const payload = salesforceInventorySchema.parse(JSON.parse(contents));
      if (Date.parse(payload.generatedAt) > Date.now() + 5_000)
        throw new Error("inventory_date_invalid");
      const body = JSON.stringify(payload);
      cached = { path: configured, body, until: Date.now() + 30_000 };
      return body;
    } finally {
      await handle.close();
    }
  })();
  pending = { path: configured, result };
  try {
    return await result;
  } finally {
    if (pending?.result === result) pending = null;
  }
}
