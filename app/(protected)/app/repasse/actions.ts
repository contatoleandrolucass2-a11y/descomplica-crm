"use server";

import { z } from "zod";
import { forbidden } from "next/navigation";

import { requirePermission } from "@/lib/authorization/guards";
import { getProtectedPageGate, pageGateAllowsRole } from "@/lib/authorization/page-gates";
import type { RepasseLookupState } from "@/lib/crm/repasse/contracts";
import { lookupRepasseByFid } from "@/lib/crm/repasse/data";

const fidSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().regex(/^[0-9]{1,12}$/u),
);

async function authorizeRepasseAccess() {
  const gate = getProtectedPageGate("/app/repasse");
  if (
    gate?.releaseEnabled !== true ||
    gate.pageKey !== "crm.repasse" ||
    gate.permission !== "crm.partnerships.view" ||
    gate.allowedRoles?.length !== 2 ||
    !gate.allowedRoles.includes("master") ||
    !gate.allowedRoles.includes("admin")
  ) {
    forbidden();
  }
  const context = await requirePermission("crm.partnerships.view");
  if (!pageGateAllowsRole(gate, context.roleKey)) forbidden();
}

async function lookupRepasse(fid: unknown): Promise<RepasseLookupState> {
  await authorizeRepasseAccess();
  const parsed = fidSchema.safeParse(fid);
  if (!parsed.success) {
    return {
      status: "validation_error",
      message: "Informe um FID numérico com até 12 dígitos.",
    };
  }

  try {
    const result = await lookupRepasseByFid(parsed.data);
    if (result.status === "not_found") {
      return {
        status: "not_found",
        fid: parsed.data,
        lastUpdated: result.lastUpdated,
        message: "Nenhum repasse foi localizado para este FID. Confira o número e tente novamente.",
      };
    }
    if (result.status === "conflict") {
      return {
        status: "source_conflict",
        fid: parsed.data,
        message:
          "A fonte retornou mais de um cadastro para este FID. Solicite a conferência da planilha antes de continuar.",
      };
    }
    return {
      status: "ready",
      fid: parsed.data,
      lastUpdated: result.lastUpdated,
      record: result.record,
    };
  } catch {
    return {
      status: "unavailable",
      message:
        "A consulta está temporariamente indisponível. Aguarde alguns instantes e tente novamente.",
    };
  }
}

export async function lookupRepasseAction(
  _state: RepasseLookupState,
  formData: FormData,
): Promise<RepasseLookupState> {
  return lookupRepasse(formData.get("fid"));
}

export async function getRepasseDetailAction(fid: string): Promise<RepasseLookupState> {
  return lookupRepasse(fid);
}
