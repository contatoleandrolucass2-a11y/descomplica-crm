import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import { useAuth } from "./Auth";
import { Button } from "./ui";
import type { WhatsAppCapabilities } from "./WhatsAppCentral";
import styles from "./whatsapp-styles";

type Account = {
  id: string;
  app_id?: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  business_name: string;
  enabled: boolean;
  graph_version: string;
  connection_status: string;
  version: number;
};
type Settings = {
  mode: "shared" | "round_robin" | "manual";
  max_concurrent: number;
  retention_days: number;
  version?: number;
};
type AccountForm = {
  app_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  business_name: string;
  graph_version: string;
  access_token: string;
  verify_token: string;
};
const blankForm: AccountForm = {
  app_id: "",
  waba_id: "",
  phone_number_id: "",
  display_phone_number: "",
  business_name: "",
  graph_version: "v26.0",
  access_token: "",
  verify_token: "",
};
const accountFields: { name: keyof AccountForm; label: string; secret?: boolean; hint?: string }[] =
  [
    { name: "app_id", label: "Meta App ID" },
    { name: "waba_id", label: "WhatsApp Business Account ID (WABA)" },
    { name: "phone_number_id", label: "Phone Number ID" },
    {
      name: "display_phone_number",
      label: "Número oficial conectado",
      hint: "Informe o número com código do país.",
    },
    { name: "business_name", label: "Identificação do negócio" },
    { name: "graph_version", label: "Versão da Graph API" },
    {
      name: "access_token",
      label: "Token de acesso da Cloud API",
      secret: true,
      hint: "Gravado criptografado no servidor. Nunca é retornado pelo sistema.",
    },
    {
      name: "verify_token",
      label: "Verify Token do webhook",
      secret: true,
      hint: "Utilize o mesmo valor na configuração do webhook da Meta.",
    },
  ];
function statusLabel(status: string) {
  return (
    (
      {
        configured: "Configuração salva; validação pendente",
        pending_validation: "Configuração salva; validação pendente",
        number_validated: "Número validado; recebimento ainda precisa ser comprovado",
        connected: "Validado na Meta",
        valid: "Validado na Meta",
        disabled: "Desativado",
        invalid: "Configuração inválida",
        error: "Falha na validação",
      } as Record<string, string>
    )[status] ||
    status ||
    "Não validado"
  );
}
export default function WhatsAppSettings() {
  const auth = useAuth();
  const [capabilities, setCapabilities] = useState<WhatsAppCapabilities | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [available, setAvailable] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsAccount, setSettingsAccount] = useState("");
  const [form, setForm] = useState<AccountForm>({ ...blankForm });
  const [edit, setEdit] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [events, setEvents] = useState<
    { id: string; kind?: string; status?: string; created_at?: string; error_code?: string }[]
  >([]);
  const viewingOther = auth.view_as?.active === true;
  const canConfigure = capabilities?.can_configure === true && !viewingOther;
  const load = useCallback(async () => {
    try {
      const permissions = await api<WhatsAppCapabilities>("/whatsapp/session");
      setCapabilities(permissions);
      if (!permissions.can_configure || viewingOther) return;
      const response = await api<{ data: Account[]; configuration_available: boolean }>(
        "/whatsapp/accounts",
      );
      setAccounts(response.data);
      setAvailable(response.configuration_available);
      setSettingsAccount((current) =>
        response.data.some((account) => account.id === current)
          ? current
          : response.data[0]?.id || "",
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, [viewingOther]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setSettings(null);
      if (!settingsAccount || !canConfigure) return;
      try {
        const config = await api<{
          distribution_mode: Settings["mode"];
          max_conversations: number;
          retention_days: number;
          version?: number;
        }>("/whatsapp/settings?account_id=" + encodeURIComponent(settingsAccount));
        if (live)
          setSettings({
            mode: config.distribution_mode,
            max_concurrent: config.max_conversations,
            retention_days: config.retention_days,
            ...(config.version === undefined ? {} : { version: config.version }),
          });
      } catch (failure) {
        if (live) setError((failure as Error).message);
      }
    });
    return () => {
      live = false;
    };
  }, [settingsAccount, canConfigure]);
  const change = (name: keyof AccountForm, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!canConfigure || !available || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ""));
      await api("/whatsapp/accounts", "POST", {
        ...payload,
        ...(edit ? { id: edit.id, version: edit.version } : {}),
      });
      setForm({ ...blankForm });
      setEdit(null);
      setNotice(
        "Configuração salva. Valide o número e conclua a inscrição oficial do webhook na Meta; salvar não comprova recebimento.",
      );
      await load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      // Segredos permanecem apenas no campo durante a edição; não são mantidos após o envio.
      setForm((current) => ({ ...current, access_token: "", verify_token: "" }));
      setBusy(false);
    }
  };
  const accountAction = async (account: Account, action: "validate" | "disable") => {
    if (!canConfigure || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/whatsapp/accounts/${account.id}/${action}`, "POST", { version: account.version });
      setNotice(
        action === "validate"
          ? "Consulta de configuração concluída. O recebimento e o envio reais ainda precisam ser confirmados com a conta oficial de teste."
          : "Integração desativada no LEAD+. A conta e o número na Meta não foram excluídos.",
      );
      await load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || !canConfigure || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/whatsapp/settings", "PUT", { ...settings, account_id: settingsAccount });
      setNotice("Regras de distribuição e retenção salvas.");
      await load();
      const config = await api<{
        distribution_mode: Settings["mode"];
        max_conversations: number;
        retention_days: number;
        version?: number;
      }>("/whatsapp/settings?account_id=" + encodeURIComponent(settingsAccount));
      setSettings({
        mode: config.distribution_mode,
        max_concurrent: config.max_conversations,
        retention_days: config.retention_days,
        ...(config.version === undefined ? {} : { version: config.version }),
      });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const loadEvents = async () => {
    setError("");
    try {
      const value = await api<{ data: typeof events }>("/whatsapp/diagnostics");
      setEvents(value.data);
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  return (
    <div className={styles.central}>
      <div className={styles.heading}>
        <div>
          <h1>WhatsApp Business</h1>
          <p className={styles.muted}>Configurações · Integrações · API oficial da Meta</p>
        </div>
      </div>
      {loading && <p role="status">Carregando configuração…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {!loading && !canConfigure && (
        <p role="alert">
          Somente o administrador original autorizado pode configurar o WhatsApp Business. A
          visualização de outro usuário não permite alterar credenciais.
        </p>
      )}
      {canConfigure && (
        <>
          {!available && (
            <p className={styles.notice} role="status">
              O armazenamento seguro ainda não está habilitado no servidor. O administrador deve
              configurar a chave de criptografia e o segredo do aplicativo antes de cadastrar
              credenciais. Nenhuma integração está sendo simulada.
            </p>
          )}
          <section className={styles.settingsForm} aria-label="Números oficiais configurados">
            <h2>Números oficiais</h2>
            {!accounts.length && (
              <p>
                Nenhum número configurado. Cadastre um número oficial ou a conta de teste da Meta.
              </p>
            )}
            {accounts.map((account) => (
              <article className={styles.account} key={account.id}>
                <strong>
                  {account.business_name || "Negócio não informado"} ·{" "}
                  {account.display_phone_number || account.phone_number_id}
                </strong>
                <p>
                  {account.enabled ? statusLabel(account.connection_status) : "Desativado no LEAD+"}
                </p>
                <p className={styles.muted}>
                  WABA {account.waba_id} · Phone Number ID {account.phone_number_id} ·{" "}
                  {account.graph_version}
                </p>
                <div className={styles.accountActions}>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setEdit(account);
                      setForm({
                        ...blankForm,
                        app_id: account.app_id || "",
                        waba_id: account.waba_id,
                        phone_number_id: account.phone_number_id,
                        display_phone_number: account.display_phone_number,
                        business_name: account.business_name,
                        graph_version: account.graph_version,
                      });
                      setNotice("");
                    }}
                  >
                    Editar ou reconectar
                  </Button>
                  <Button
                    disabled={busy || !account.enabled}
                    onClick={() => void accountAction(account, "validate")}
                  >
                    Validar configuração
                  </Button>
                  <Button
                    disabled={busy || !account.enabled}
                    onClick={() => void accountAction(account, "disable")}
                  >
                    Desativar no LEAD+
                  </Button>
                </div>
              </article>
            ))}
          </section>
          <form
            className={styles.settingsForm}
            onSubmit={(event) => void saveAccount(event)}
            autoComplete="off"
          >
            <h2>{edit ? "Editar número oficial" : "Conectar número oficial"}</h2>
            <p>
              Use credenciais da Cloud API com os escopos oficiais de mensagens e gerenciamento. O
              token do Meta Ads e a integração de formulários não serão substituídos.
            </p>
            <div className={styles.settingsGrid}>
              {accountFields.map((field) => (
                <label key={field.name}>
                  {field.label}
                  <input
                    type={field.secret ? "password" : "text"}
                    name={`wa-${field.name}`}
                    value={form[field.name]}
                    onChange={(event) => change(field.name, event.target.value)}
                    disabled={busy || !available}
                    required={!edit || !field.secret}
                    autoComplete={field.secret ? "new-password" : "off"}
                    spellCheck={false}
                    placeholder={
                      edit && field.secret ? "Deixe vazio para preservar o valor salvo" : ""
                    }
                    maxLength={field.secret ? 8192 : 160}
                  />
                  {field.hint && <span className={styles.muted}>{field.hint}</span>}
                </label>
              ))}
            </div>
            <p className={styles.muted}>
              Callback HTTPS: /api/integrations/whatsapp/webhook. Configure o objeto
              whatsapp_business_account e o campo messages no aplicativo autorizado. A inscrição
              depende das permissões e da conta da Meta.
            </p>
            <div className={styles.actions}>
              <Button primary type="submit" disabled={busy || !available}>
                {busy ? "Salvando…" : "Salvar configuração segura"}
              </Button>
              {edit && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setEdit(null);
                    setForm({ ...blankForm });
                  }}
                >
                  Cancelar edição
                </Button>
              )}
            </div>
          </form>
          {!!accounts.length && (
            <label className={styles.fileLabel}>
              Número para configurar a distribuição
              <select
                value={settingsAccount}
                disabled={busy}
                onChange={(event) => setSettingsAccount(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.display_phone_number || account.phone_number_id} ·{" "}
                    {account.business_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {settings && (
            <form className={styles.settingsForm} onSubmit={(event) => void saveSettings(event)}>
              <h2>Fila e distribuição</h2>
              <div className={styles.settingsGrid}>
                <label>
                  Modo de distribuição
                  <select
                    value={settings.mode}
                    disabled={busy}
                    onChange={(event) =>
                      setSettings({ ...settings, mode: event.target.value as Settings["mode"] })
                    }
                  >
                    <option value="shared">
                      Fila compartilhada: primeiro autorizado a assumir
                    </option>
                    <option value="round_robin">Distribuição automática entre disponíveis</option>
                    <option value="manual">Atribuição manual pelo supervisor</option>
                  </select>
                </label>
                <label>
                  Limite simultâneo por corretor
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={settings.max_concurrent}
                    disabled={busy}
                    onChange={(event) =>
                      setSettings({ ...settings, max_concurrent: Number(event.target.value) })
                    }
                    required
                  />
                </label>
                <label>
                  Retenção do conteúdo de conversas encerradas, em dias
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
                    value={settings.retention_days}
                    disabled={busy}
                    onChange={(event) =>
                      setSettings({ ...settings, retention_days: Number(event.target.value) })
                    }
                    required
                  />
                </label>
              </div>
              <p className={styles.muted}>
                Após esse prazo, o conteúdo de conversas encerradas será removido. Contatos
                compartilhados e auditoria permanecem preservados. A disponibilidade, o escopo da
                equipe e as permissões são conferidos no servidor. Não são criados usuários ou
                equipes automaticamente.
              </p>
              <Button primary type="submit" disabled={busy}>
                Salvar regras
              </Button>
            </form>
          )}
          <section className={styles.settingsForm}>
            <h2>Eventos e diagnóstico</h2>
            <p>
              Eventos técnicos sem tokens nem conteúdo de mensagens. Um número validado não comprova
              a entrega de uma mensagem real.
            </p>
            <Button disabled={busy} onClick={() => void loadEvents()}>
              Consultar eventos recentes
            </Button>
            {!events.length ? (
              <p className={styles.muted}>Nenhum evento consultado.</p>
            ) : (
              events.map((event) => (
                <p key={event.id} className={styles.muted}>
                  {event.kind || "Evento"} · {event.status || "Registrado"}
                  {event.error_code ? ` · código ${event.error_code}` : ""} ·{" "}
                  {event.created_at
                    ? new Date(event.created_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "Horário indisponível"}
                </p>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
