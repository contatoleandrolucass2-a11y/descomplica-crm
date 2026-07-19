/* eslint-disable @next/next/no-html-link-for-pages -- Native links avoid a Vinext hydration bug. */
import { STAGES, type StageSlug } from "./stage-config";

export function StageNavigation({
  active = "overview",
}: {
  active?: StageSlug | "overview";
}) {
  return (
    <nav className="stage-navigation" aria-label="Páginas do funil">
      <a
        href="/"
        className={active === "overview" ? "active" : ""}
        aria-current={active === "overview" ? "page" : undefined}
      >
        <span className="overview-icon" aria-hidden="true">▦</span>
        Visão geral
      </a>
      {STAGES.map((stage, index) => (
        <a
          key={stage.slug}
          href={`/etapas/${stage.slug}`}
          className={active === stage.slug ? "active" : ""}
          aria-current={active === stage.slug ? "page" : undefined}
          style={{ "--nav-accent": stage.color } as React.CSSProperties}
        >
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          {stage.label}
        </a>
      ))}
    </nav>
  );
}
