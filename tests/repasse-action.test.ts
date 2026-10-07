import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookupRepasseByFid: vi.fn(),
  requirePermission: vi.fn(),
  releaseEnabled: true,
}));

vi.mock("@/lib/authorization/guards", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/crm/repasse/data", () => ({
  lookupRepasseByFid: mocks.lookupRepasseByFid,
}));
vi.mock("@/lib/authorization/page-gates", () => ({
  getProtectedPageGate: () => ({
    pageKey: "crm.repasse",
    path: "/app/repasse",
    permission: "crm.partnerships.view",
    releaseEnabled: mocks.releaseEnabled,
    requiredRole: "master",
  }),
}));
vi.mock("next/navigation", () => ({
  forbidden: () => {
    throw new Error("NEXT_FORBIDDEN");
  },
}));

import { lookupRepasseAction } from "@/app/(protected)/app/repasse/actions";

function form(fid: string) {
  const data = new FormData();
  data.set("fid", fid);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.releaseEnabled = true;
  mocks.requirePermission.mockResolvedValue({
    userId: "10000000-0000-4000-8000-000000000001",
    roleKey: "master",
  });
});

describe("Server Action da consulta de repasse", () => {
  it("reautoriza e rejeita FID inválido antes da origem", async () => {
    await expect(lookupRepasseAction({ status: "idle" }, form("ABC-123"))).resolves.toEqual({
      status: "validation_error",
      message: "Informe um FID numérico com até 12 dígitos.",
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.partnerships.view");
    expect(mocks.lookupRepasseByFid).not.toHaveBeenCalled();
  });

  it("falha fechado antes da autorização e da origem quando a release está desabilitada", async () => {
    mocks.releaseEnabled = false;

    await expect(lookupRepasseAction({ status: "idle" }, form("123456"))).rejects.toThrow(
      "NEXT_FORBIDDEN",
    );
    expect(mocks.requirePermission).not.toHaveBeenCalled();
    expect(mocks.lookupRepasseByFid).not.toHaveBeenCalled();
  });

  it("nega perfil nao Master mesmo quando Parcerias esta permitida", async () => {
    mocks.requirePermission.mockResolvedValue({
      userId: "10000000-0000-4000-8000-000000000002",
      roleKey: "coordinator",
    });

    await expect(lookupRepasseAction({ status: "idle" }, form("123456"))).rejects.toThrow(
      "NEXT_FORBIDDEN",
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith("crm.partnerships.view");
    expect(mocks.lookupRepasseByFid).not.toHaveBeenCalled();
  });

  it("retorna somente o DTO validado do FID exato", async () => {
    mocks.lookupRepasseByFid.mockResolvedValue({
      status: "ready",
      lastUpdated: "06/10/2026",
      record: {
        empreendimento: "Residencial Sintético",
        etapa: "Assinatura",
        status: "Repassado",
        nomeCliente: "Cliente Sintético",
        motivo: "Concluído.",
      },
    });

    await expect(lookupRepasseAction({ status: "idle" }, form("123456"))).resolves.toEqual({
      status: "ready",
      fid: "123456",
      lastUpdated: "06/10/2026",
      record: {
        empreendimento: "Residencial Sintético",
        etapa: "Assinatura",
        status: "Repassado",
        nomeCliente: "Cliente Sintético",
        motivo: "Concluído.",
      },
    });
    expect(mocks.lookupRepasseByFid).toHaveBeenCalledWith("123456");
  });

  it("devolve erro recuperável sem detalhes da falha externa", async () => {
    mocks.lookupRepasseByFid.mockRejectedValue(new Error("upstream detail"));

    const result = await lookupRepasseAction({ status: "idle" }, form("123456"));
    expect(result).toEqual({
      status: "unavailable",
      message:
        "A consulta está temporariamente indisponível. Aguarde alguns instantes e tente novamente.",
    });
    expect(JSON.stringify(result)).not.toContain("upstream detail");
  });
});
