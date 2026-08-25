import "server-only";

export type SupabaseRuntimeConfiguration = Readonly<{
  publishableKey: string;
  url: string;
}>;

type SupabaseRuntimeEnvironment = Readonly<{
  [name: string]: string | undefined;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_URL?: string;
}>;

function validSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/" || url.pathname === "")
    );
  } catch {
    return false;
  }
}

function validPublishableKey(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{20,2048}$/.test(value);
}

/**
 * Reads Supabase's public API contract only at server runtime.
 *
 * These values are intentionally not named NEXT_PUBLIC_*: Next.js freezes
 * that namespace into browser bundles during `next build`, which prevents one
 * immutable image from being promoted between environments. Browser clients
 * must receive this already-validated public pair explicitly from a Server
 * Component if a future feature genuinely needs direct browser access.
 */
export function getSupabaseRuntimeConfiguration(
  environment: SupabaseRuntimeEnvironment = process.env,
): SupabaseRuntimeConfiguration {
  const url = environment.SUPABASE_URL?.trim();
  const publishableKey = environment.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!validSupabaseUrl(url) || !validPublishableKey(publishableKey)) {
    throw new Error("Supabase runtime configuration is unavailable.");
  }

  return { url, publishableKey };
}
