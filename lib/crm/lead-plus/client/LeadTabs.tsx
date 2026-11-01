import { workspaceDocument } from "./workspace-document";
import { AlarmClock, Archive, House, Star, Timer } from "lucide-react";

const items = [
  { label: "A fazer", Icon: House },
  { label: "Visitas", Icon: Timer },
  { label: "Futuras", Icon: AlarmClock },
  { label: "Favoritos", Icon: Star },
  { label: "Todos", Icon: Archive },
];

export default function LeadTabs({
  value,
  counts,
  loading,
  onChange,
}: {
  value: string;
  counts: Record<string, number>;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="lead-category-tabs" role="tablist" aria-label="Categorias de leads">
      {items.map(({ label, Icon }, index) => (
        <button
          type="button"
          role="tab"
          key={label}
          id={"lead-tab-" + index}
          aria-selected={value === label}
          aria-controls="leads-tabpanel"
          aria-label={label + " (" + (loading ? "carregando" : counts[label]) + ")"}
          tabIndex={value === label ? 0 : -1}
          onClick={() => onChange(label)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % items.length
                : event.key === "ArrowLeft"
                  ? (index + items.length - 1) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onChange(items[next]!.label);
            workspaceDocument()
              .getElementById("lead-tab-" + next)
              ?.focus();
          }}
        >
          <span className="lead-category-icon">
            <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
            {index === 0 && (
              <span className="lead-category-badge">{loading ? "…" : counts[label]}</span>
            )}
          </span>
          <span>
            {label}
            {index !== 0 && " (" + (loading ? "…" : counts[label]) + ")"}
          </span>
        </button>
      ))}
    </div>
  );
}
