// Shared by the collector, publisher and authenticated Salesforce ingestion route.
// Other ingestion endpoints retain their own limits.
export const MAX_SALESFORCE_INGESTION_BODY_BYTES = 8 * 1024 * 1024;

// The compact local candidate also contains diagnostics, which are never published.
export const MAX_SALESFORCE_CANDIDATE_FILE_BYTES = MAX_SALESFORCE_INGESTION_BODY_BYTES + 64 * 1024;

/** Null means oversized; stream failures propagate for the route to sanitize. */
export async function readSalesforceIngestionBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SALESFORCE_INGESTION_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
