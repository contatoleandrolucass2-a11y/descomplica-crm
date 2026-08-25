import "server-only";

import { safeExternalUrl } from "./api";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function explicitLocalQaMode(configured: URL): boolean {
  if (process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA !== "true") return false;
  const supabase = safeExternalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, false);
  return (
    configured.protocol === "http:" &&
    LOOPBACK_HOSTS.has(configured.hostname) &&
    Boolean(supabase && LOOPBACK_HOSTS.has(supabase.hostname))
  );
}

export function getApplicationOrigin(): URL | null {
  const configured = safeExternalUrl(process.env.APP_ORIGIN, false);
  if (!configured || configured.pathname !== "/" || configured.search || configured.hash)
    return null;
  if (
    process.env.NODE_ENV === "production" &&
    configured.protocol !== "https:" &&
    !explicitLocalQaMode(configured)
  ) {
    return null;
  }
  return new URL(configured.origin);
}

export function getApplicationUrl(pathname: `/${string}`): URL | null {
  const origin = getApplicationOrigin();
  if (!origin || pathname.startsWith("//")) return null;
  const destination = new URL(pathname, origin);
  return destination.origin === origin.origin ? destination : null;
}
