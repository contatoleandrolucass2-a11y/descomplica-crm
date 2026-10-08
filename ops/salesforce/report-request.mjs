import { setTimeout as delay } from "node:timers/promises";

const MESSAGES = {
  SALESFORCE_AUTH_REQUIRED: "Salesforce authentication required; complete manual login and MFA",
  SALESFORCE_HTTP_ERROR: "Salesforce request rejected",
  SALESFORCE_NETWORK_ERROR: "Salesforce network request failed",
  SALESFORCE_TIMEOUT: "Salesforce request timed out",
  SALESFORCE_INVALID_RESPONSE: "Salesforce returned an invalid response",
  SALESFORCE_REPORT_ERROR: "Salesforce report execution failed",
  SALESFORCE_INCOMPLETE_REPORT: "Salesforce report is incomplete",
  SALESFORCE_INVALID_REPORT: "Salesforce report integrity validation failed",
  SALESFORCE_EXPORT_LOCKED: "Salesforce export lock already exists; export skipped",
  SALESFORCE_LOCK_OWNERSHIP: "Salesforce export lock ownership changed; lock preserved",
  SALESFORCE_LOCK_ERROR: "Salesforce export lock operation failed",
  SALESFORCE_EXPORT_FAILED: "Salesforce candidate export failed",
  SALESFORCE_CANCELLED: "Salesforce export cancelled",
  SALESFORCE_EXPORT_CONFIG: "absolute output path required",
  publication_failed: "Salesforce publication failed",
};

export class SalesforceCollectionError extends Error {
  constructor(code, status) {
    super(MESSAGES[code] ?? MESSAGES.SALESFORCE_INVALID_RESPONSE);
    this.name = "SalesforceCollectionError";
    this.code = Object.hasOwn(MESSAGES, code) ? code : "SALESFORCE_INVALID_RESPONSE";
    if (Number.isInteger(status) && status >= 100 && status <= 599) this.status = status;
  }
}

export class SalesforceAuthenticationError extends SalesforceCollectionError {
  constructor() {
    super("SALESFORCE_AUTH_REQUIRED");
    this.name = "SalesforceAuthenticationError";
  }
}

export function throwIfSalesforceAborted(signal) {
  if (!signal?.aborted) return;
  throw new SalesforceCollectionError(
    signal.reason instanceof SalesforceCollectionError &&
      signal.reason.code === "SALESFORCE_TIMEOUT"
      ? "SALESFORCE_TIMEOUT"
      : "SALESFORCE_CANCELLED",
  );
}

export async function withSalesforceSignal(operation, signal) {
  throwIfSalesforceAborted(signal);
  if (!signal) return operation();
  let aborted;
  const cancelled = new Promise((_, reject) => {
    aborted = () => {
      try {
        throwIfSalesforceAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener("abort", aborted, { once: true });
  });
  try {
    return await Promise.race([operation(), cancelled]);
  } finally {
    signal.removeEventListener("abort", aborted);
  }
}

// Only fixed messages and codes can reach logs, never remote bodies or native fetch errors.
export function safeSalesforceError(error) {
  const code = error instanceof SalesforceCollectionError ? error.code : "SALESFORCE_EXPORT_FAILED";
  return {
    code,
    error: MESSAGES[code] ?? "Salesforce candidate export failed",
    ...(error instanceof SalesforceCollectionError && error.status ? { status: error.status } : {}),
  };
}

function retryDelay(response, attempt, now) {
  const header = response?.headers.get("retry-after");
  if (!header) return 500 * 2 ** attempt;
  if (/^\d+(?:\.\d+)?$/.test(header.trim())) return Number(header) * 1_000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now()) : 500 * 2 ** attempt;
}

export function createSalesforceRequest(sessionId, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? delay;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxAttempts = 3;
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw new SalesforceAuthenticationError();
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new SalesforceCollectionError("SALESFORCE_TIMEOUT");
  }

  return async (url, { method = "GET", body, deadline = Infinity } = {}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      throwIfSalesforceAborted(options.signal);
      const remaining = Math.min(timeoutMs, deadline - now());
      if (remaining <= 0) throw new SalesforceCollectionError("SALESFORCE_TIMEOUT");
      const controller = new AbortController();
      let timer;
      let response;
      let failure;
      let retryable = false;
      try {
        const expired = new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new SalesforceCollectionError("SALESFORCE_TIMEOUT"));
          }, remaining);
        });
        const operation = async () => {
          response = await fetchImpl(url, {
            method,
            headers: { Authorization: `Bearer ${sessionId}`, "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            redirect: "manual",
            signal: options.signal
              ? AbortSignal.any([controller.signal, options.signal])
              : controller.signal,
          });
          if (response.status === 401 || (response.status >= 300 && response.status < 400)) {
            void response.body?.cancel().catch(() => {});
            throw new SalesforceAuthenticationError();
          }
          if (!response.ok && (response.status === 429 || response.status >= 500)) {
            retryable = true;
            void response.body?.cancel().catch(() => {});
            throw new SalesforceCollectionError("SALESFORCE_HTTP_ERROR", response.status);
          }
          let value;
          try {
            value = await response.json();
          } catch (error) {
            if (error instanceof SyntaxError) {
              throw new SalesforceCollectionError("SALESFORCE_INVALID_RESPONSE");
            }
            throw error;
          }
          const errors = Array.isArray(value) ? value : [value];
          if (errors.some((entry) => entry?.errorCode === "INVALID_SESSION_ID")) {
            throw new SalesforceAuthenticationError();
          }
          if (!response.ok) {
            throw new SalesforceCollectionError("SALESFORCE_HTTP_ERROR", response.status);
          }
          if (!value || typeof value !== "object" || Array.isArray(value) || value.errorCode) {
            throw new SalesforceCollectionError("SALESFORCE_INVALID_RESPONSE");
          }
          return value;
        };
        return await withSalesforceSignal(
          () => Promise.race([operation(), expired]),
          options.signal,
        );
      } catch (error) {
        throwIfSalesforceAborted(options.signal);
        if (error instanceof SalesforceCollectionError) {
          failure = error;
          retryable ||= error.code === "SALESFORCE_TIMEOUT";
        } else {
          failure = new SalesforceCollectionError(
            controller.signal.aborted ? "SALESFORCE_TIMEOUT" : "SALESFORCE_NETWORK_ERROR",
          );
          retryable = true;
        }
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      // Starting an asynchronous instance is not idempotent, even after a network timeout.
      if (method !== "GET" || !retryable || attempt === maxAttempts - 1) throw failure;
      const waitMs = retryDelay(response, attempt, now);
      if (waitMs > 30_000 || now() + waitMs >= deadline) throw failure;
      await withSalesforceSignal(
        () => sleep(waitMs, undefined, { signal: options.signal }),
        options.signal,
      );
    }
  };
}
