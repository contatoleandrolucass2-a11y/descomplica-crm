import "server-only";

type Environment = Readonly<Record<string, string | undefined>>;
export function getMetaAdsStatusConfiguration(
  environment: Environment = process.env,
):
  | { enabled: boolean; available: false }
  | { enabled: true; available: true; statusSecret: string } {
  const enabled = environment.META_ADS_STATUS_ENABLED === "true";
  const secret = environment.META_ADS_STATUS_SECRET;
  if (!enabled || !secret || !/^[!-~]{32,256}$/u.test(secret)) return { enabled, available: false };
  return { enabled: true, available: true, statusSecret: secret };
}

export function getMetaAdsConsoleConfiguration(
  environment: Environment = process.env,
): { available: false } | { available: true; password: string } {
  const password = environment.META_ADS_CONSOLE_PASSWORD;
  // This eight-byte RFB credential is not a Facebook account password.
  if (
    environment.META_ADS_CONSOLE_ENABLED !== "true" ||
    !password ||
    !/^[!-~]{8}$/u.test(password)
  ) {
    return { available: false };
  }
  return { available: true, password };
}
