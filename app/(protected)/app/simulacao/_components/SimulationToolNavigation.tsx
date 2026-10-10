import Link from "next/link";

export function SimulationToolNavigation({ current }: { current: "documentation" | "caixa" }) {
  return (
    <nav className="simulation-tool-navigation" aria-label="Ferramentas de simulação">
      <Link href="/app/simulacao" prefetch={false}>
        <span aria-hidden="true">←</span> Todas as ferramentas
      </Link>
      <Link
        href="/app/simulacao/calcular-documentacao"
        prefetch={false}
        aria-current={current === "documentation" ? "page" : undefined}
      >
        Documentação
      </Link>
      <Link
        href="/app/simulacao/caixa"
        prefetch={false}
        aria-current={current === "caixa" ? "page" : undefined}
      >
        CAIXA
      </Link>
    </nav>
  );
}
