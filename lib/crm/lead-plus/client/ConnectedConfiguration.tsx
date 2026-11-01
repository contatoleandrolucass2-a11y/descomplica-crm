import { useState } from "react";
import { api, useApi, type Resource } from "./api";
import { Button, Panel } from "./ui";
import { useAuth } from "./Auth";
const definitions: Record<
  string,
  {
    kind: string;
    fields: { name: string; label: string; type?: string; initial?: string }[];
  }
> = {
  Ajustes: {
    kind: "settings",
    fields: [
      {
        name: "company",
        label: "Nome da empresa",
        initial: "Imobiliária Exemplo",
      },
      {
        name: "opening",
        label: "Horário de início",
        type: "time",
        initial: "08:00",
      },
      {
        name: "closing",
        label: "Horário de encerramento",
        type: "time",
        initial: "18:00",
      },
      {
        name: "archive_days",
        label: "Arquivar após (dias)",
        type: "number",
        initial: "30",
      },
    ],
  },
  "Meu perfil": {
    kind: "profile",
    fields: [
      { name: "name", label: "Nome", initial: "Administrador local" },
      {
        name: "email",
        label: "E-mail",
        type: "email",
        initial: "admin@exemplo.com",
      },
      { name: "phone", label: "Celular" },
      { name: "signature", label: "Assinatura" },
    ],
  },
  "Mensagens prontas": {
    kind: "templates",
    fields: [
      { name: "title", label: "Título", initial: "Mensagem de abertura" },
      {
        name: "message",
        label: "Mensagem",
        type: "textarea",
        initial: "Olá, [NOME_CONTATO]! Como podemos ajudar?",
      },
    ],
  },
  "Distribuição de leads": {
    kind: "queues",
    fields: [
      {
        name: "name",
        label: "Nome da distribuição",
        initial: "Distribuição automática local",
      },
      { name: "strategy", label: "Estratégia", initial: "round_robin" },
    ],
  },
  "Filas de Distribuição": {
    kind: "queues",
    fields: [
      {
        name: "name",
        label: "Nome da distribuição",
        initial: "Distribuição automática local",
      },
      { name: "strategy", label: "Estratégia", initial: "round_robin" },
    ],
  },
};
export function ConnectedConfiguration({ screen }: { screen: string }) {
  const auth = useAuth();
  const definition = definitions[screen] || definitions["Ajustes"]!,
    { data, error, loading } = useApi<{ data: Resource[] }>("/resources/" + definition.kind);
  const [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  const recordId = ["profile", "templates"].includes(definition.kind)
    ? auth.user?.id || "local-preview"
    : "default";
  const record = data?.data.find((r) => r.id === recordId);
  const values = record?.fields as Record<string, string> | undefined;
  return (
    <div className="system-screen">
      <Panel title={screen}>
        {screen === "Ajustes" && (
          <p>
            <a href="#Ajustes%20do%20Bols%C3%A3o">
              Ajustes do Bolsão: configurar prazo e entrada automática
            </a>
          </p>
        )}
        <p>Configuração persistida no backend.</p>
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <form
            key={record?.version || 0}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const fields = Object.fromEntries(new FormData(e.currentTarget).entries());
              if (definition.kind === "queues" && fields.strategy !== "round_robin") {
                setFailure("A distribuição implementada é round_robin.");
                return;
              }
              setBusy(true);
              try {
                await api("/resources/" + definition.kind + "/" + recordId, "PUT", {
                  fields,
                  ...(record ? { version: record.version } : {}),
                });
                setNotice("Configuração salva no Supabase.");
                setFailure("");
              } catch (e) {
                setFailure((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {definition.fields.map((f) => (
              <label className="field" key={f.name}>
                {f.label}
                {f.type === "textarea" ? (
                  <textarea name={f.name} defaultValue={values?.[f.name] ?? f.initial ?? ""} />
                ) : (
                  <input
                    name={f.name}
                    type={f.type || "text"}
                    defaultValue={values?.[f.name] ?? f.initial ?? ""}
                    required
                    min={f.type === "number" ? 1 : undefined}
                    max={f.type === "number" ? 90 : undefined}
                    readOnly={f.name === "strategy"}
                  />
                )}
              </label>
            ))}
            {definition.kind === "queues" && (
              <p>
                Distribuição circular entre usuários ativos. A sequência é preservada pelo total de
                leads gravados. Hierarquia e prioridades específicas ainda não são aplicadas.
              </p>
            )}
            {definition.kind === "templates" && (
              <p>Modelo salvo para uso interno. Nenhuma mensagem é enviada automaticamente.</p>
            )}
            {definition.kind === "settings" && (
              <p>
                Valores persistidos. Arquivamento e horário comercial ainda não possuem rotina
                automática.
              </p>
            )}
            <Button primary type="submit">
              {busy ? "Salvando…" : "Salvar"}
            </Button>
            {notice && <span className="notice">{notice}</span>}
          </form>
        )}
        {(error || failure) && (
          <div role="alert" className="api-error">
            {error || failure}
          </div>
        )}
      </Panel>
    </div>
  );
}
