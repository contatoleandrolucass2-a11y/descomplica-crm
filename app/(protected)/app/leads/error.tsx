"use client";

import Image from "next/image";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      aria-labelledby="lead-plus-error-title"
      className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] p-6 text-center text-[var(--analytics-ink)]"
    >
      <Image src="/lead-plus/descomplica-lead-icon.svg" alt="" width={40} height={40} />
      <h1 id="lead-plus-error-title" className="text-lg font-semibold">
        DESCOMPLICA LEAD
      </h1>
      <p role="alert" className="text-sm text-[var(--analytics-muted)]">
        Não foi possível carregar sua operação. Tente novamente.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--analytics-line)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Tentar novamente
        </button>
        <Link
          href="/app"
          prefetch={false}
          className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Voltar ao início
        </Link>
      </div>
      <p className="text-xs text-[var(--analytics-muted)]">
        Código para o suporte: {error.digest ?? "LEAD-500"}
      </p>
    </section>
  );
}
