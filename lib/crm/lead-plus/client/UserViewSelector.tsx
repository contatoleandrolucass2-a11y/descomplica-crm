import { useAuth } from "./Auth";

const labels: Record<string, string> = {
  admin: "Admin",
  superintendent: "Superintendente",
  manager: "Gerente",
  broker: "Corretor",
};
export default function UserViewSelector() {
  const auth = useAuth();
  const targets = auth.viewable_users || [];
  if (!auth.actor || (!targets.length && !auth.view_as?.active)) return null;
  return (
    <section
      aria-label="Visualização de usuário"
      style={{
        display: "grid",
        gap: 10,
        margin: "12px 16px",
        minWidth: 0,
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "var(--analytics-page)",
        padding: "10px 0",
      }}
    >
      <label className="field" style={{ maxWidth: 440, width: "100%", minWidth: 0 }}>
        Visualizar como
        <select
          value={auth.view_as?.active ? auth.view_as.target_id : ""}
          disabled={auth.loading}
          onChange={(event) => void auth.switchUser(event.target.value)}
        >
          <option value="">Meu usuário · {auth.actor.name}</option>
          {targets
            .filter((target) => target.id !== auth.actor?.id)
            .map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} · {labels[target.role] || target.role}
                {target.team ? " · " + target.team : ""}
              </option>
            ))}
        </select>
      </label>
      {auth.view_as?.active && (
        <div
          role="status"
          style={{
            border: "2px solid var(--header-accent)",
            background: "var(--analytics-surface-muted)",
            color: "var(--analytics-ink)",
            padding: 12,
            borderRadius: 10,
            overflowWrap: "anywhere",
          }}
        >
          <p style={{ margin: "0 0 8px", color: "inherit" }}>
            <strong style={{ color: "inherit" }}>
              Atenção: você está visualizando {auth.view_as.target_name}. Qualquer alteração será
              registrada na auditoria de {auth.actor.name}.
            </strong>
          </p>
          <button
            type="button"
            onClick={() => void auth.switchUser("")}
            style={{
              color: "var(--header-text)",
              background: "var(--header-active)",
              border: "1px solid var(--header-line)",
              borderRadius: 8,
              padding: "8px 12px",
              minHeight: 40,
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Voltar ao meu usuário
          </button>
        </div>
      )}
    </section>
  );
}
