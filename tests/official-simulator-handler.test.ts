import { describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "@/lib/authorization/types";
import {
  getOfficialSimulatorRuntimeConfiguration,
  officialSimulatorExecutionIsEnabled,
  type OfficialSimulatorRuntimeConfiguration,
} from "@/lib/crm/simulators/official/config";
import {
  handleOfficialSimulatorPost,
  handleOfficialSimulatorStatus,
  type OfficialSimulatorHandlerDependencies,
} from "@/lib/crm/simulators/official/handler";
import { calculateWf13, WF13_FORMULA, wf13InputSchema } from "@/lib/crm/simulators/official/wf13";

import goldenFixture from "./fixtures/wf13-reference-golden.json";

const ENDPOINT = "https://crm.example.com/api/official-simulator/associativo-fluxo-linear";
const { annual1, annual2, annual3, annual4, annual5, ...legacyStandardInput } =
  goldenFixture[0]!.input;
const standardAnnuals = [annual1, annual2, annual3, annual4, annual5];
while (standardAnnuals.at(-1) === "0") standardAnnuals.pop();
const standardInput = {
  ...legacyStandardInput,
  ranking: "DIAMANTE",
  cashback: "0",
  cashbackDiscount: "0",
  annuals: standardAnnuals,
  monthlyDueDay: "10",
  signal1Date: "",
  signal2Date: "",
  signal3Date: "",
};

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

  it("expõe status no-store para recuperar UI de canário sem relaxar autorização", async () => {
    expect(
      officialSimulatorExecutionIsEnabled(
        { mode: "active", enabledKeys: ["simulator.wf13"] },
        "associativo-fluxo-linear",
        masterContext,
      ),
    ).toBe(true);
    expect(
      officialSimulatorExecutionIsEnabled(
        { mode: "active", enabledKeys: ["simulator.wf13"] },
        "associativo-fluxo-linear",
        { ...masterContext, roleKey: "admin", level: 80 },
      ),
    ).toBe(false);

    const enabled = await handleOfficialSimulatorStatus(
      new Request(ENDPOINT),
      "associativo-fluxo-linear",
      dependencies(),
    );
    const body = (await enabled.json()) as Record<string, unknown>;
    expect(enabled.status).toBe(200);
    expect(enabled.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      schemaVersion: 1,
      engineKey: "simulator.wf13",
      executionEnabled: true,
    });

    const blocked = await handleOfficialSimulatorStatus(
      new Request(ENDPOINT),
      "associativo-fluxo-linear",
      dependencies({ configuration: () => ({ mode: "off", enabledKeys: [] }) }),
    );
    const nonMaster = await handleOfficialSimulatorStatus(
      new Request(ENDPOINT),
      "associativo-fluxo-linear",
      dependencies({
        authorize: vi.fn(async () => ({
          ok: true as const,
          context: { ...masterContext, roleKey: "admin" as const, level: 80 },
        })),
      }),
    );
    expect(blocked.status).toBe(200);
    await expect(blocked.json()).resolves.toMatchObject({ executionEnabled: false });
    expect(nonMaster.status).toBe(200);
    await expect(nonMaster.json()).resolves.toMatchObject({ executionEnabled: false });
  });

  it("mantém o status autenticado e não revela execução a quem não pode ver simuladores", async () => {
    const authorize = vi.fn(async () => ({
      ok: false as const,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    }));
    const response = await handleOfficialSimulatorStatus(
      new Request(ENDPOINT),
      "associativo-fluxo-linear",
      dependencies({ authorize }),
    );

    expect(response.status).toBe(403);
    expect(authorize).toHaveBeenCalledWith("crm.simulators.view");
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
    const forgedApproval = await handleOfficialSimulatorPost(
      request({
        schemaVersion: 1,
        input: { ...standardInput, approval: "APROVADO", salePrice: "-1" },
      }),
      "associativo-fluxo-linear",
      dependencies(),
    );

    expect(invalidOrigin.status).toBe(403);
    expect(invalidMedia.status).toBe(415);
    expect(invalidInput.status).toBe(422);
    expect(forgedApproval.status).toBe(422);
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
      formulaVersion: "wf13-1.2.0",
      sourceSha256: WF13_FORMULA.sourceSha256,
      result: {
        ok: true,
        firstInstallmentDate: "2026-09-10",
        proSoluto: 45000,
        nominalInstallment: 535.71,
        correctedInstallment: 727.66,
      },
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
});
