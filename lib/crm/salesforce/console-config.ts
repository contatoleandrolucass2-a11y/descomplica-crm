import "server-only";

type ConsoleEnvironment = Readonly<Record<string, string | undefined>>;

export function getSalesforceConsoleConfiguration(
  environment: ConsoleEnvironment = process.env,
): { available: false } | { available: true; password: string } {
  const password = environment.SALESFORCE_CONSOLE_PASSWORD;
  // RFB password authentication uses eight bytes. This is NOT a Salesforce password.
  if (
    environment.SALESFORCE_CONSOLE_ENABLED !== "true" ||
    !password ||
    !/^[!-~]{8}$/u.test(password)
  ) {
    return { available: false };
  }
  return { available: true, password };
}
