import Image from "next/image";

export default function LeadsLoading() {
  return (
    <section
      aria-labelledby="lead-plus-loading-title"
      className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] p-6 text-center text-[var(--analytics-ink)]"
    >
      <Image src="/lead-plus/descomplica-lead-icon.svg" alt="" width={40} height={40} />
      <h1 id="lead-plus-loading-title" className="text-lg font-semibold">
        DESCOMPLICA LEAD
      </h1>
      <p role="status" className="text-sm text-[var(--analytics-muted)]">
        Carregando sua operação…
      </p>
    </section>
  );
}
