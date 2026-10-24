"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import { LeadPageShell, LeadStatePanel } from "./_components/LeadWorkspace";

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <LeadPageShell
      eyebrow="Operação comercial"
      title="Lead"
      description="A área continua protegida enquanto a consulta é recuperada."
      sourceState="error"
    >
      <LeadStatePanel
        state="error"
        title="Não foi possível carregar o módulo Lead"
        description={`Tente novamente. Se o problema continuar, informe ao suporte o código ${error.digest ?? "LEAD-500"}.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={managementStyles.buttonPrimary} onClick={reset}>
              <RotateCcw size={16} aria-hidden="true" />
              Tentar novamente
            </button>
            <Link className={managementStyles.button} href="/app">
              Voltar ao início
            </Link>
          </div>
        }
      />
    </LeadPageShell>
  );
}
