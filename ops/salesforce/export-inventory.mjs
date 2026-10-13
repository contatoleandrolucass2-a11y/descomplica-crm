import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

import { refreshSalesforceSession, safeCdpEndpoint } from "./browser-session.mjs";
import { acquireExportLock } from "./export-lock.mjs";
import { resolveCandidateOutputPath, writeCandidateAtomically } from "./export-candidate.mjs";
import { publishInventory } from "./publish-inventory.mjs";
import { collectInventory } from "./collect-inventory.mjs";
import {
  safeSalesforceError,
  SalesforceCollectionError,
  withSalesforceSignal,
} from "./report-request.mjs";

// Manual CLI writes a private candidate. The scheduler explicitly enables publication.
export async function exportInventory(environment = process.env, options = {}) {
  const configuredOutput = environment.SALESFORCE_INVENTORY_OUTPUT?.trim();
  const commercialOutput = resolveCandidateOutputPath(environment);
  if (!configuredOutput || !path.isAbsolute(configuredOutput)) {
    throw new SalesforceCollectionError("SALESFORCE_EXPORT_CONFIG");
  }
  const output = path.normalize(configuredOutput);
  if (
    output === commercialOutput ||
    output === `${commercialOutput}.lock` ||
    !output.endsWith(".json")
  )
    throw new SalesforceCollectionError("SALESFORCE_EXPORT_CONFIG");
  if (
    options.publish === true &&
    (commercialOutput !== "/var/lib/descomplica-salesforce/candidate.json" ||
      output !== "/var/lib/descomplica-salesforce/inventory-candidate.json")
  )
    throw new SalesforceCollectionError("SALESFORCE_EXPORT_CONFIG");
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(5 * 60_000)])
    : AbortSignal.timeout(5 * 60_000);
  let browser, release;
  try {
    release = await acquireExportLock(commercialOutput);
    browser = await chromium.connectOverCDP(safeCdpEndpoint(environment.SALESFORCE_CDP_URL), {
      timeout: 10_000,
    });
    const sessionId = await withSalesforceSignal(
      () => refreshSalesforceSession(browser.contexts()[0]),
      signal,
    );
    const candidate = await collectInventory(sessionId, { ...options, signal });
    await writeCandidateAtomically(output, candidate, undefined, signal);
    if (options.publish === true) {
      const publication = await publishInventory(candidate, { signal });
      options.onPublished?.(publication);
    }
    return candidate;
  } finally {
    try {
      if (browser)
        await withSalesforceSignal(() => browser.close(), AbortSignal.timeout(4_000)).catch(
          () => {},
        );
    } finally {
      await release?.();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  exportInventory(process.env, { signal: controller.signal })
    .then((candidate) => {
      console.log(
        JSON.stringify({
          message: "inventory candidate collected; not published",
          generatedAt: candidate.generatedAt,
          sourceRows: candidate.sourceRows,
          count: candidate.count,
          projectCount: candidate.projectCount,
          duplicateRows: candidate.duplicateRows,
        }),
      );
    })
    .catch((error) => {
      console.log(JSON.stringify(safeSalesforceError(error)));
      process.exitCode = 1;
    });
}
