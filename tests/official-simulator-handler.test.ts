import { describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "@/lib/authorization/types";
import {
  getOfficialSimulatorRuntimeConfiguration,
  type OfficialSimulatorRuntimeConfiguration,
} from "@/lib/crm/simulators/official/config";
import {
  handleOfficialSimulatorPost,
  type OfficialSimulatorHandlerDependencies,
} from "@/lib/crm/simulators/official/handler";
import { calculateWf13, WF13_FORMULA, wf13InputSchema } from "@/lib/crm/simulators/official/wf13";
import { calculateWf16, WF16_FORMULA, wf16InputSchema } from "@/lib/crm/simulators/official/wf16";

import goldenFixture from "./fixtures/wf13-reference-golden.json";
import wf16GoldenFixture from "./fixtures/wf16-reference-golden.json";

const ENDPOINT = "https://crm.example.com/api/official-simulator/associativo-fluxo-linear";
const standardInput = goldenFixture[0]!.input;

const masterContext: AuthorizationContext = {
  userId: "10000000-0000-4000-8000-000000000001",
  roleKey: "master",
  level: 100,
  permissions: ["crm.simulators.view", "crm.simulators.execute"],
};

function request(
  body: unknown = { schemaVersion: 1, input: standardInput },
  options: { origin?: string; contentType?: string } = {},
) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      origin: options.origin ?? "https://crm.example.com",
    },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<OfficialSimulatorHandlerDependencies> = {},
): OfficialSimulatorHandlerDependencies {
  return {
    configuration: () => ({ mode: "active", enabledKeys: ["simulator.wf13"] }),
    authorize: vi.fn(async () => ({ ok: true as const, context: masterContext })),
    emit: vi.fn(),
    today: () => "2026-08-13",
    calculators: {
      "associativo-fluxo-linear": {
        engineKey: "simulator.wf13",
        formulaVersion: WF13_FORMULA.version,
        sourceSha256: WF13_FORMULA.sourceSha256,
        execute(input, today) {
          return calculateWf13(wf13InputSchema.parse(input), { today });
        },
      },
    },
    ...overrides,
  };
}

describe("endpoint oficial dos simuladores", () => {
  it("mantém configuração desligada por padrão e falha fechada", () => {
    expect(getOfficialSimulatorRuntimeConfiguration({})).toEqual({ mode: "off", enabledKeys: [] });
    expect(
      getOfficialSimulatorRuntimeConfiguration({
        OFFICIAL_SIMULATOR_RUNTIME_MODE: "active",
        OFFICIAL_SIMULATOR_ENABLED_KEYS: "simulator.wf13,unknown",
      }),
    ).toEqual({ mode: "off", enabledKeys: [] });
  });

  it("não autentica nem calcula quando a flag independente está desligada", async () => {
    const authorize = vi.fn();
    const response = await handleOfficialSimulatorPost(
      request(),
      "associativo-fluxo-linear",
      dependencies({
        configuration: () => ({ mode: "off", enabledKeys: [] }),
        authorize,
      }),
    );

    expect(response.status).toBe(503);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("exige autenticação, permissão e papel Master mesmo com flag ativa", async () => {
    const unauthenticated = await handleOfficialSimulatorPost(
      request(),
      "associativo-fluxo-linear",
      dependencies({
        authorize: vi.fn(async () => ({
          ok: false as const,
          response: Response.json({ error: "unauthenticated" }, { status: 401 }),
        })),
      }),
    );
    const nonMaster = await handleOfficialSimulatorPost(
      request(),
      "associativo-fluxo-linear",
      dependencies({
        authorize: vi.fn(async () => ({
          ok: true as const,
          context: { ...masterContext, roleKey: "admin" as const, level: 80 },
        })),
      }),
    );

    expect(unauthenticated.status).toBe(401);
    expect(nonMaster.status).toBe(403);
  });

  it("rejeita origem, media type e payload fora do contrato", async () => {
    const invalidOrigin = await handleOfficialSimulatorPost(
      request(undefined, { origin: "https://evil.example" }),
      "associativo-fluxo-linear",
      dependencies(),
    );
    const invalidMedia = await handleOfficialSimulatorPost(
      request(undefined, { contentType: "text/plain" }),
      "associativo-fluxo-linear",
      dependencies(),
    );
    const invalidInput = await handleOfficialSimulatorPost(
      request({ schemaVersion: 1, input: { ...standardInput, entry: "1.234,56" } }),
      "associativo-fluxo-linear",
      dependencies(),
    );

    expect(invalidOrigin.status).toBe(403);
    expect(invalidMedia.status).toBe(415);
    expect(invalidInput.status).toBe(422);
  });

  it("retorna cálculo exato e telemetria sem payload", async () => {
    const emit = vi.fn();
    const response = await handleOfficialSimulatorPost(
      request(),
      "associativo-fluxo-linear",
      dependencies({ emit }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      schemaVersion: 1,
      engineKey: "simulator.wf13",
      formulaVersion: "wf13-1.0.0",
      sourceSha256: WF13_FORMULA.sourceSha256,
      result: goldenFixture[0]!.expected,
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "crm.official_simulator",
        engineKey: "simulator.wf13",
        outcome: "success",
        httpStatus: 200,
      }),
    );
    expect(JSON.stringify(emit.mock.calls)).not.toContain("Residencial Teste");
  });

  it("não aceita chave habilitada sem implementação registrada", async () => {
    const active: OfficialSimulatorRuntimeConfiguration = {
      mode: "active",
      enabledKeys: ["simulator.wf16"],
    };
    const response = await handleOfficialSimulatorPost(
      request(),
      "calcular-documentacao",
      dependencies({ configuration: () => active }),
    );

    expect(response.status).toBe(503);
  });

  it("executa WF16 somente com sua flag independente", async () => {
    const response = await handleOfficialSimulatorPost(
      new Request("https://crm.example.com/api/official-simulator/calcular-documentacao", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://crm.example.com",
        },
        body: JSON.stringify({ schemaVersion: 1, input: wf16GoldenFixture[0]!.input }),
      }),
      "calcular-documentacao",
      dependencies({
        configuration: () => ({ mode: "active", enabledKeys: ["simulator.wf16"] }),
        calculators: {
          "calcular-documentacao": {
            engineKey: "simulator.wf16",
            formulaVersion: WF16_FORMULA.version,
            sourceSha256: WF16_FORMULA.sourceSha256,
            execute(input) {
              return calculateWf16(wf16InputSchema.parse(input));
            },
          },
        },
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      engineKey: "simulator.wf16",
      formulaVersion: "wf16-1.0.0",
      sourceSha256: WF16_FORMULA.sourceSha256,
      result: wf16GoldenFixture[0]!.expected,
    });
  });
});
