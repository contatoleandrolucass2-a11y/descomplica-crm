import "server-only";

type Environment = Readonly<Record<string, string | undefined>>;

export type MetaAdsApiConfiguration =
  | { enabled: boolean; available: false }
  | {
      enabled: true;
      available: true;
      accessToken: string;
      accountId: string;
      apiVersion: string;
    };

export function getMetaAdsApiConfiguration(
  environment: Environment = process.env,
): MetaAdsApiConfiguration {
  const enabled = environment.META_ADS_API_ENABLED === "true";
  const accessToken = environment.META_ADS_ACCESS_TOKEN;
  const accountId = environment.META_ADS_ACCOUNT_ID;
  const apiVersion = environment.META_ADS_API_VERSION || "v26.0";
  if (
    !enabled ||
    !accessToken ||
    !/^[!-~]{40,4096}$/u.test(accessToken) ||
    !accountId ||
    !/^\d{6,32}$/u.test(accountId) ||
    !/^v\d+\.\d+$/u.test(apiVersion)
  ) {
    return { enabled, available: false };
  }
  return { enabled: true, available: true, accessToken, accountId, apiVersion };
}

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
