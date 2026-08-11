import { defineConfig } from "@playwright/test";

const fallbackOrigin = "http://127.0.0.1:4173";
const baseURL = process.env.QA_E2E_ORIGIN ?? fallbackOrigin;
const homologationOrigin = "https://homolog.descomplicapro.com.br";
const remoteHomologation = process.env.QA_E2E_REMOTE_HOMOLOGATION === "true";

if (
  process.env.QA_E2E_REMOTE_HOMOLOGATION !== undefined &&
  !["true", "false"].includes(process.env.QA_E2E_REMOTE_HOMOLOGATION)
) {
  throw new Error("QA_E2E_REMOTE_HOMOLOGATION accepts only true or false.");
}

let httpCredentials: { username: string; password: string } | undefined;
if (remoteHomologation) {
  const target = new URL(baseURL);
  if (target.origin !== homologationOrigin || target.href !== `${homologationOrigin}/`) {
    throw new Error("Remote E2E is restricted to the isolated homologation origin.");
  }

  const username = process.env.QA_E2E_BASIC_AUTH_USERNAME;
  const password = process.env.QA_E2E_BASIC_AUTH_PASSWORD;
  if (!username || !password) {
    throw new Error("Remote homologation E2E requires private Basic Auth credentials.");
  }
  httpCredentials = { username, password };
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "/tmp/descomplica-playwright-results",
  reporter: [["line"]],
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    ...(httpCredentials ? { httpCredentials } : {}),
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
