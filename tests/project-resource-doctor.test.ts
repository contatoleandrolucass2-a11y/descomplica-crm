import { expect, it } from "vitest";

// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import { diagnoseResources } from "../scripts/knowledge/doctor.mjs";

const ready = {
  nodeVersion: "v24.19.0",
  userAgent: "pnpm/11.20.0 npm/? node/v24.19.0 win32 x64",
  resolvePackage: (name: string) => `/packages/${name}/package.json`,
  supabaseCli: () => ({ path: "/supabase/dist/supabase.js", version: "2.115.0" }),
  browserPath: () => "/chromium/chrome.exe",
  exists: () => true,
  run: (name: string) => ({
    status: 0,
    output:
      name === process.execPath
        ? "2.115.0"
        : name === "gitleaks"
          ? "8.30.1"
          : name === "docker"
            ? "Docker version 29.0.0"
            : "osv-scanner version: 2.6.0",
  }),
};

it("reports required local capabilities without claiming connection or test success", () => {
  const result = diagnoseResources(ready);
  expect(result.status).toBe("ready");
  expect(result.checks).toHaveLength(11);
  expect(result.scope).toContain("nao comprova testes");
});

it("resolves installed package exports even when package.json is private", () => {
  const result = diagnoseResources({ ...ready, resolvePackage: undefined });
  expect(
    result.checks.find((item: { name: string }) => item.name === "@axe-core/playwright")?.status,
  ).toBe("ready");
});

it.each([
  { nodeVersion: "v25.0.0" },
  { nodeVersion: "v24.18.0" },
  { userAgent: "pnpm/11.21.0" },
  { userAgent: "npm/11.20.0" },
  { userAgent: "" },
])("rejects unsupported runtimes: %j", (override) => {
  expect(diagnoseResources({ ...ready, ...override }).status).toBe("incomplete");
});

it("detects missing packages and Chromium without crashing", () => {
  const result = diagnoseResources({
    ...ready,
    resolvePackage: () => {
      throw new Error("not installed");
    },
    supabaseCli: () => {
      throw new Error("not installed");
    },
    browserPath: () => {
      throw new Error("not installed");
    },
  });
  expect(
    result.checks.filter((item: { status: string }) => item.status === "unavailable"),
  ).toHaveLength(6);
  expect(result.status).toBe("incomplete");
  expect(diagnoseResources({ ...ready, exists: () => false }).status).toBe("incomplete");
});

it.each([
  { status: 1, output: "" },
  { status: null, output: "" },
  { status: 0, output: "2.0.0" },
])("rejects a missing or mismatched Supabase platform binary: %j", (response) => {
  const calls: string[][] = [];
  const result = diagnoseResources({
    ...ready,
    run: (name: string, args: string[]) => {
      calls.push([name, ...args]);
      return name === process.execPath ? response : ready.run(name);
    },
  });
  expect(calls).toContainEqual([process.execPath, "/supabase/dist/supabase.js", "--version"]);
  expect(result.status).toBe("incomplete");
  expect(result.checks.find((item: { name: string }) => item.name === "supabase-cli")?.status).toBe(
    "unavailable",
  );
});

it.each([
  ["gitleaks", "8.18.4"],
  ["gitleaks", "9.0.0"],
  ["osv-scanner", "osv-scanner version: 1.9.0"],
])("rejects incompatible %s: %s", (name, output) => {
  const result = diagnoseResources({
    ...ready,
    run: (command: string) => (command === name ? { status: 0, output } : ready.run(command)),
  });
  expect(result.status).toBe("incomplete");
});

it("does not confuse a failed or unexpected CLI response with availability", () => {
  for (const response of [
    { status: null, output: "" },
    { status: 1, output: "8.30.1" },
    { status: 0, output: "unknown" },
  ]) {
    expect(diagnoseResources({ ...ready, run: () => response }).status).toBe("incomplete");
  }
});

it("keeps Docker optional when isolated database gates run in CI", () => {
  const result = diagnoseResources({
    ...ready,
    run: (name: string) => (name === "docker" ? { status: null, output: "" } : ready.run(name)),
  });
  expect(result.status).toBe("ready");
  expect(result.checks.find((item: { name: string }) => item.name === "docker")).toEqual({
    name: "docker",
    required: false,
    status: "unavailable",
  });
});
