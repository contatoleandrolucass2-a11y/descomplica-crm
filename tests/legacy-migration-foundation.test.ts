import { describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "@/lib/authorization/types";
import {
  handleWeekendForecastGet,
  handleWeekendForecastPost,
  type DialerHandlerDependencies,
} from "@/lib/crm/dialer/handler";
import { weekendForecastWriteSchema } from "@/lib/crm/dialer/weekend-forecast";
import { reconcileInventoryItems, type InventoryItem } from "@/lib/crm/inventory/contract";
import {
  handleInventoryGet,
  inventorySourceIsConfigured,
  type InventoryHandlerDependencies,
} from "@/lib/crm/inventory/handler";
import {
  getLegacyMigrationRuntimeConfiguration,
  legacyMigrationModuleIsEnabled,
} from "@/lib/crm/legacy-migration/config";

const masterContext: AuthorizationContext = {
  userId: "10000000-0000-4000-8000-000000000001",
  roleKey: "master",
  level: 100,
  permissions: ["crm.simulators.view", "crm.dialer.view"],
};

function inventoryDependencies(
  overrides: Partial<InventoryHandlerDependencies> = {},
): InventoryHandlerDependencies {
  return {
    authorize: vi.fn(async () => ({ ok: true as const, context: masterContext })),
    configuration: () => ({
      available: true as const,
      sourceUrl: new URL("https://inventory.example.test/v1/items"),
      authFile: "/run/secrets/inventory",
    }),
    fetchSource: vi.fn(),
    readAuth: vi.fn(async () => "Bearer opaque"),
    ...overrides,
  };
}

function dialerDependencies(
  overrides: Partial<DialerHandlerDependencies> = {},
): DialerHandlerDependencies {
  return {
    authorize: vi.fn(async () => ({ ok: true as const, context: masterContext })),
    moduleEnabled: vi.fn(() => true),
    ...overrides,
  };
}

describe("flags da migração legado", () => {
  it("falha fechada por padrão e quando a lista contém chave desconhecida", () => {
    expect(getLegacyMigrationRuntimeConfiguration({})).toEqual({
      mode: "off",
      enabledModules: [],
    });
    expect(
      getLegacyMigrationRuntimeConfiguration({
        LEGACY_MIGRATION_RUNTIME_MODE: "active",
        LEGACY_MIGRATION_ENABLED_MODULES: "simulator.wf16,unknown",
      }),
    ).toEqual({ mode: "off", enabledModules: [] });
  });

  it("habilita cada página somente por chave independente", () => {
    const environment = {
      LEGACY_MIGRATION_RUNTIME_MODE: "active",
      LEGACY_MIGRATION_ENABLED_MODULES: "simulator.tabelao,dialer",
    };
    expect(legacyMigrationModuleIsEnabled("simulator.tabelao", environment)).toBe(true);
    expect(legacyMigrationModuleIsEnabled("dialer", environment)).toBe(true);
    expect(legacyMigrationModuleIsEnabled("dialer.weekend-forecast", environment)).toBe(false);
  });
});

describe("contrato seguro do Tabelão", () => {
  it("detecta configuração completa sem expor a origem ou o segredo", () => {
    expect(inventorySourceIsConfigured({ CRM_INVENTORY_RUNTIME_MODE: "off" })).toBe(false);
    expect(
      inventorySourceIsConfigured({
        CRM_INVENTORY_RUNTIME_MODE: "active",
        CRM_INVENTORY_SOURCE_URL: "https://inventory.example.test/v1/items",
        CRM_INVENTORY_SOURCE_AUTH_FILE: "/run/secrets/inventory_source_auth",
      }),
    ).toBe(true);
  });

  const items: InventoryItem[] = [
    {
      businessUnit: "Direcional",
      development: "Parque Azul",
      floorPlan: "2Q",
      region: "Leste",
      priceCents: 31_000_000,
      updatedAt: "2026-08-28T10:00:00Z",
      source: "fixture",
    },
    {
      businessUnit: "Direcional",
      development: " Parque  Azul ",
      floorPlan: "2q",
      region: "Leste",
      priceCents: 29_000_000,
      updatedAt: "2026-08-28T10:01:00Z",
      source: "fixture",
    },
  ];

  it("remove combinações repetidas e preserva o menor valor", () => {
    expect(reconcileInventoryItems(items)).toEqual([items[1]]);
  });

  it("nunca consulta a fonte quando o contrato está indisponível", async () => {
    const fetchSource = vi.fn();
    const response = await handleInventoryGet(
      new Request("https://crm.example.test/api/inventory"),
      inventoryDependencies({ configuration: () => ({ available: false }), fetchSource }),
    );
    expect(response.status).toBe(404);
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("retorna somente combinações reconciliadas sem status de unidade", async () => {
    const response = await handleInventoryGet(
      new Request("https://crm.example.test/api/inventory"),
      inventoryDependencies({
        fetchSource: vi.fn(async () => Response.json({ schemaVersion: 1, items }, { status: 200 })),
      }),
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body.items).toEqual([{ ...items[1], development: "Parque  Azul" }]);
    expect(JSON.stringify(body)).not.toContain("availability");
    expect(JSON.stringify(body)).not.toContain("reserved");
  });

  it("nega usuário anônimo antes de consultar a fonte", async () => {
    const fetchSource = vi.fn();
    const response = await handleInventoryGet(
      new Request("https://crm.example.test/api/inventory"),
      inventoryDependencies({
        authorize: vi.fn(async () => ({
          ok: false as const,
          response: Response.json({ error: "unauthenticated" }, { status: 401 }),
        })),
        fetchSource,
      }),
    );
    expect(response.status).toBe(401);
    expect(fetchSource).not.toHaveBeenCalled();
  });
});

describe("contrato da previsão em desenvolvimento", () => {
  it("aceita somente payload sintético estrito", () => {
    expect(
      weekendForecastWriteSchema.safeParse({
        schemaVersion: 1,
        week: "2026-08-24",
        category: "visits",
        cells: [
          {
            brokerKey: "qa-broker",
            developmentKey: "qa-development",
            forecast: 2,
            realized: 1,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      weekendForecastWriteSchema.safeParse({
        schemaVersion: 1,
        week: "2026-08-24",
        category: "visits",
        cells: [],
        token: "forbidden",
      }).success,
    ).toBe(false);
  });

  it("GET expõe somente estado vazio e POST permanece bloqueado", async () => {
    const getResponse = await handleWeekendForecastGet(
      new Request("https://crm.example.test/api/weekend-forecast?week=2026-08-24"),
      dialerDependencies(),
    );
    const postResponse = await handleWeekendForecastPost(
      new Request("https://crm.example.test/api/weekend-forecast", { method: "POST" }),
      dialerDependencies(),
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      state: "development",
      writable: false,
      brokers: [],
      developments: [],
    });
    expect(postResponse.status).toBe(404);
    await expect(postResponse.json()).resolves.toEqual({
      error: "weekend_forecast_writes_disabled",
    });
  });

  it("falha fechado antes da autenticação quando o módulo está desligado", async () => {
    const authorize = vi.fn();
    const response = await handleWeekendForecastGet(
      new Request("https://crm.example.test/api/weekend-forecast?week=2026-08-24"),
      dialerDependencies({ authorize, moduleEnabled: vi.fn(() => false) }),
    );
    expect(response.status).toBe(404);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejeita datas normalizadas pelo Date como se fossem válidas", async () => {
    const response = await handleWeekendForecastGet(
      new Request("https://crm.example.test/api/weekend-forecast?week=2026-02-30"),
      dialerDependencies(),
    );
    expect(response.status).toBe(400);
  });
});
