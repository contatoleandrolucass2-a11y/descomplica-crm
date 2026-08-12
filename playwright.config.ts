import { defineConfig } from "@playwright/test";

const fallbackOrigin = "http://127.0.0.1:4173";
const baseURL = process.env.QA_E2E_ORIGIN ?? fallbackOrigin;

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
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
