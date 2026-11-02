import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, LeadApiError } from "./api";
import { useAuth } from "./Auth";
import { Button } from "./ui";
import styles from "./whatsapp-styles";

export type WhatsAppCapabilities = {
  can_configure: boolean;
  can_supervise: boolean;
  can_send: boolean;
  can_claim: boolean;
  can_report?: boolean;
  can_edit?: boolean;
  can_move_stage?: boolean;
};
export type Conversation = {
  id: string;
  account_id: string;
  name: string;
  phone: string;
  status: "waiting" | "active" | "closed";
  distribution_mode?: "shared" | "automatic" | "manual";
  assigned_user_id: string | null;
  assigned_user_name?: string;
  version: number;
  last_message_preview?: string;
  last_message_at?: string;
  last_customer_message_at?: string;
  unread_count?: number;
  created_at?: string;
  source?: string;
  source_campaign_name?: string;
  team?: string;
  stage?: number;
  tags?: string[];
  interest?: string;
};
type Message = {
  id: string;
  client_message_id?: string;
  direction: "inbound" | "outbound";
  type: string;
  content:
    | {
        text?: string;
        caption?: string;
        filename?: string;
        template?: { name: string; language: string; parameters: string[] };
      }
    | string;
  delivery_status: string;
  attempts?: number;
  created_at: string;
  media_reference?: { id: string; mime_type?: string } | null;
};
type Detail = {
  conversation: Conversation;
  messages: Message[];
  notes: { id: string; body: string; user_id: string; created_at: string }[];
  history: { id: string; action: string; created_at: string }[];
  eligible_users: { id: string; name: string }[];
};
type Template = {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: { type: string; text?: string; format?: string; buttons?: unknown[] }[];
};
type Metrics = {
  received?: number;
  waiting?: number;
  active?: number;
  closed?: number;
  average_claim_seconds?: number | null;
  average_first_response_seconds?: number | null;
  conversion_rate?: number | null;
  unanswered?: number;
  transferred?: number;
  by_user?: { key: string | null; name: string; count: number }[];
  by_source?: { key: string | null; name: string; count: number }[];
  by_campaign?: { key: string | null; name: string; count: number }[];
};
const statusNames: Record<string, string> = {
  waiting: "Aguardando atendimento",
  active: "Em atendimento",
  closed: "Finalizado",
};
const deliveryNames: Record<string, string> = {
  queued: "Na fila de envio",
  pending: "Na fila de envio",
  sending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falha no envio",
  unknown: "Confirmação pendente; não reenvie",
  uncertain: "Confirmação pendente; não reenvie",
};
const stages = [
  "Novos leads",
  "Em atendimento",
  "Visita agendada",
  "Visita realizada",
  "Proposta criada",
  "Negócio fechado",
];
export function serviceWindowOpen(lastMessage: string | undefined, now = Date.now()) {
  const received = lastMessage ? Date.parse(lastMessage) : NaN;
  return Number.isFinite(received) && received <= now && now - received < 24 * 60 * 60 * 1000;
}
export function templateParameters(template: Template): number | null {
  if (template.status !== "APPROVED") return null;
  const components = template.components || [];
  if (components.some((item) => item.type !== "BODY" && item.type !== "FOOTER")) return null;
  if (components.filter((item) => item.type === "BODY").length !== 1) return null;
  const body = components.find((item) => item.type === "BODY")?.text || "";
  if (/\{\{(?!\d+\}\})/.test(body)) return null;
  const placeholders = [
    ...(components.find((item) => item.type === "BODY")?.text || "").matchAll(/\{\{(\d+)\}\}/g),
  ].map((item) => Number(item[1]));
  const unique = [...new Set(placeholders)].sort((a, b) => a - b);
  return unique.every((value, index) => value === index + 1) ? unique.length : null;
}
function dateLabel(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
function contentText(message: Message) {
  return typeof message.content === "string"
    ? message.content
    : message.content?.text ||
        message.content?.caption ||
        message.content?.filename ||
        (message.type === "template" ? "Modelo oficial" : "");
}
export function retryMessagePayload(message: Message) {
  if (
    message.direction !== "outbound" ||
    message.delivery_status !== "failed" ||
    !message.client_message_id ||
    (message.attempts ?? 0) >= 3
  )
    return null;
  if (message.type === "text") {
    const text = typeof message.content === "string" ? message.content : message.content.text;
    return text ? { client_message_id: message.client_message_id, type: "text", text } : null;
  }
  if (
    message.type === "template" &&
    typeof message.content !== "string" &&
    message.content.template
  )
    return {
      client_message_id: message.client_message_id,
      type: "template",
      template: message.content.template,
    };
  return null;
}
function MediaAttachment({
  conversationId,
  message,
}: {
  conversationId: string;
  message: Message;
}) {
  const [media, setMedia] = useState<{ url: string; mime: string; filename: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const url = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  const open = async () => {
    setLoading(true);
    setError("");
    try {
      const value = await api<{ mime_type: string; data_base64: string; filename?: string }>(
        `/whatsapp/conversations/${conversationId}/media/${message.id}`,
      );
      const bytes = Uint8Array.from(atob(value.data_base64), (letter) => letter.charCodeAt(0));
      const next = URL.createObjectURL(new Blob([bytes], { type: value.mime_type }));
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = next;
      setMedia({ url: next, mime: value.mime_type, filename: value.filename || "Anexo" });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      {!media && (
        <Button disabled={loading} onClick={() => void open()}>
          {loading ? "Carregando anexo…" : "Abrir anexo"}
        </Button>
      )}
      {media && (
        <>
          {media.mime.startsWith("image/") && (
            <img
              className={styles.mediaPreview}
              src={media.url}
              alt="Imagem recebida na conversa"
            />
          )}
          {media.mime.startsWith("audio/") && (
            <audio className={styles.mediaPreview} controls src={media.url} />
          )}
          <a href={media.url} download={media.filename}>
            Baixar {media.filename}
          </a>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default function WhatsAppCentral() {
  const auth = useAuth();
  const [capabilities, setCapabilities] = useState<WhatsAppCapabilities | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selected, setSelected] = useState("");
  const selectedRef = useRef("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pane, setPane] = useState("list");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [parameters, setParameters] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricOptions, setMetricOptions] = useState<Metrics | null>(null);
  const [metricFilters, setMetricFilters] = useState({
    days: "30",
    source: "",
    campaign_id: "",
    status: "",
    user_id: "",
    team: "",
  });
  const [commercialDraft, setCommercialDraft] = useState<{
    id: string;
    version: number;
    tags: string;
    interest: string;
    stage: number;
    confirm_sale: boolean;
  } | null>(null);
  const [now, setNow] = useState(0);
  const attempts = useRef(new Map<string, string>());
  const refreshSequence = useRef(0);
  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const loadList = useCallback(
    async (cursor?: string) => {
      const sequence = ++listSequence.current;
      const params = new URLSearchParams({ status: filter, search });
      if (cursor) params.set("cursor", cursor);
      const result = await api<{ data: Conversation[]; next_cursor: string | null }>(
        "/whatsapp/conversations?" + params,
      );
      if (sequence !== listSequence.current) return;
      setConversations((current) =>
        cursor
          ? [
              ...current,
              ...result.data.filter((item) => !current.some((previous) => previous.id === item.id)),
            ]
          : result.data,
      );
      setNextCursor(result.next_cursor || null);
    },
    [filter, search],
  );
  const loadDetail = useCallback(async (id: string) => {
    const sequence = ++detailSequence.current;
    const result = await api<Detail>("/whatsapp/conversations/" + id);
    if (selectedRef.current === id && sequence === detailSequence.current)
      setDetail((current) => {
        if (current?.conversation.id !== id) return result;
        const messages = new Map(current.messages.map((message) => [message.id, message]));
        for (const message of result.messages) messages.set(message.id, message);
        return {
          ...result,
          messages: [...messages.values()]
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
            .slice(-5000),
        };
      });
  }, []);
  const refresh = useCallback(async () => {
    const current = ++refreshSequence.current;
    try {
      await Promise.all([
        loadList(),
        selectedRef.current ? loadDetail(selectedRef.current) : Promise.resolve(),
      ]);
      if (refreshSequence.current === current) setConnected(true);
    } catch (failure) {
      if (refreshSequence.current === current) {
        setConnected(false);
        setError((failure as Error).message);
        if (failure instanceof LeadApiError && [403, 404].includes(failure.status)) {
          selectedRef.current = "";
          setSelected("");
          setDetail(null);
          setDraft("");
          setFile(null);
        }
      }
    } finally {
      if (refreshSequence.current === current) setLoading(false);
    }
  }, [loadList, loadDetail]);
  useEffect(() => {
    void api<WhatsAppCapabilities>("/whatsapp/session")
      .then(setCapabilities)
      .catch((failure: Error) => setError(failure.message));
  }, []);
  useEffect(() => {
    if (!capabilities?.can_claim) return;
    void api<{ available: boolean }>("/whatsapp/availability")
      .then((value) => setAvailable(value.available))
      .catch(() => setAvailable(null));
  }, [capabilities?.can_claim]);
  useEffect(() => {
    if (!capabilities?.can_claim || available !== true) return;
    // Availability expires on the server when the operator leaves the central.
    const timer = setInterval(() => {
      void api("/whatsapp/availability", "PUT", { available: true }).catch(() =>
        setAvailable(null),
      );
    }, 120000);
    return () => clearInterval(timer);
  }, [available, capabilities?.can_claim]);
  useEffect(() => {
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    let after = "";
    let delay = 2000;
    const poll = async () => {
      try {
        const events = await api<{ data: unknown[]; next_cursor: string; resync?: boolean }>(
          "/whatsapp/events" + (after ? "?after=" + encodeURIComponent(after) : ""),
        );
        if (stopped) return;
        if (events.data.length || events.resync) await refresh();
        after = events.next_cursor || after;
        setConnected(true);
        delay = 2000;
      } catch (failure) {
        if (!stopped) setConnected(false);
        if (!stopped && failure instanceof LeadApiError && [401, 403].includes(failure.status)) {
          setDetail(null);
          setConversations([]);
          setCapabilities(null);
          setError("Seu acesso ao atendimento foi alterado. Recarregue a sessão para continuar.");
        }
        delay = Math.min(delay * 2, 15000);
      } finally {
        if (!stopped) timeout = setTimeout(() => void poll(), delay);
      }
    };
    void Promise.resolve().then(() => {
      if (!stopped) return refresh();
    });
    timeout = setTimeout(() => void poll(), delay);
    const visibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", visibility);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      clearTimeout(timeout);
      window.removeEventListener("online", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);
  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!capabilities?.can_report) return;
    let live = true;
    const loadMetrics = () => {
      const params = new URLSearchParams(
        Object.entries(metricFilters).filter(([key, value]) => key !== "days" && value),
      );
      const end = Date.now();
      params.set("from", new Date(end - Number(metricFilters.days) * 86400000).toISOString());
      params.set("to", new Date(end).toISOString());
      void api<Metrics>("/whatsapp/metrics?" + params)
        .then((value) => {
          if (live) {
            setMetrics(value);
            setMetricOptions((current) => current || value);
          }
        })
        .catch(() => {
          if (live) setMetrics(null);
        });
    };
    loadMetrics();
    const timer = setInterval(loadMetrics, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [capabilities?.can_report, metricFilters]);
  useEffect(() => {
    let live = true;
    const accountId = detail?.conversation.account_id;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setTemplates([]);
      if (!accountId || !capabilities?.can_send) return;
      try {
        const value = await api<{ data: Template[] }>(
          "/whatsapp/templates?account_id=" + encodeURIComponent(accountId),
        );
        if (live) setTemplates(value.data);
      } catch {
        if (live) setTemplates([]);
      }
    });
    return () => {
      live = false;
    };
  }, [detail?.conversation.account_id, capabilities?.can_send]);
  const choose = async (id: string) => {
    if (busy) return;
    selectedRef.current = id;
    setSelected(id);
    setDetail(null);
    setDraft("");
    setNote("");
    setFile(null);
    setTarget("");
    setCommercialDraft(null);
    setTemplateId("");
    setParameters([]);
    setError("");
    setNotice("");
    setPane("chat");
    setDetailLoading(true);
    try {
      await loadDetail(id);
      if (selectedRef.current === id) {
        await api("/whatsapp/conversations/" + id + "/read", "POST", {});
        await loadList();
      }
    } catch (failure) {
      if (selectedRef.current === id) setError((failure as Error).message);
    } finally {
      if (selectedRef.current === id) setDetailLoading(false);
    }
  };
  const mutate = async (path: string, body: unknown, success: string, method = "POST") => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, method, body);
      await refresh();
      setNotice(success);
      return true;
    } catch (failure) {
      if (failure instanceof LeadApiError && failure.status === 409) {
        await refresh();
        setError(
          "O atendimento foi alterado por outra pessoa. O responsável atual foi atualizado; confira antes de tentar novamente.",
        );
      } else setError((failure as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const conversation = detail?.conversation;
  const owned = conversation?.assigned_user_id === auth.user?.id;
  const canReply =
    !!conversation && conversation.status === "active" && owned && capabilities?.can_send === true;
  const windowOpen = serviceWindowOpen(conversation?.last_customer_message_at, now);
  const template = templates.find((item) => item.name + ":" + item.language === templateId);
  const parameterCount = template ? templateParameters(template) : null;
  const commercial = conversation
    ? commercialDraft?.id === conversation.id
      ? commercialDraft
      : {
          id: conversation.id,
          version: conversation.version,
          tags: conversation.tags?.join(", ") || "",
          interest: conversation.interest || "",
          stage: conversation.stage ?? 0,
          confirm_sale: false,
        }
    : null;
  const attemptId = (key: string) => {
    if (!attempts.current.has(key)) attempts.current.set(key, crypto.randomUUID());
    return attempts.current.get(key)!;
  };
  const sendText = async (event: FormEvent) => {
    event.preventDefault();
    if (!conversation || !canReply || !windowOpen || !draft.trim()) return;
    const text = draft;
    const attemptKey = `${conversation.id}:text:${text.trim()}`;
    if (
      await mutate(
        `/whatsapp/conversations/${conversation.id}/messages`,
        { client_message_id: attemptId(attemptKey), type: "text", text: text.trim() },
        "Mensagem registrada na fila de envio.",
      )
    ) {
      setDraft("");
      attempts.current.delete(attemptKey);
    }
  };
  const sendTemplate = async () => {
    if (
      !conversation ||
      !canReply ||
      !template ||
      parameterCount === null ||
      parameters.length !== parameterCount ||
      parameters.some((value) => !value.trim())
    )
      return;
    const attemptKey = `${conversation.id}:template:${templateId}:${JSON.stringify(parameters)}`;
    if (
      await mutate(
        `/whatsapp/conversations/${conversation.id}/messages`,
        {
          client_message_id: attemptId(attemptKey),
          type: "template",
          template: { name: template.name, language: template.language, parameters },
        },
        "Modelo registrado na fila de envio.",
      )
    ) {
      setTemplateId("");
      setParameters([]);
      attempts.current.delete(attemptKey);
    }
  };
  const sendFile = async () => {
    if (!file || !conversation || !canReply || !windowOpen) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(
        "O anexo deve ter até 10 MB. O servidor também valida o formato e o limite oficial.",
      );
      return;
    }
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
        ? "audio"
        : "document";
    const attemptKey = `${conversation.id}:media:${file.name}:${file.size}:${file.lastModified}`;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(Error("Não foi possível ler o anexo."));
        reader.readAsDataURL(file);
      });
      if (selectedRef.current !== conversation.id) return;
      if (
        await mutate(
          `/whatsapp/conversations/${conversation.id}/media`,
          {
            client_message_id: attemptId(attemptKey),
            type,
            filename: file.name,
            mime_type: file.type,
            data_base64: data,
          },
          "Anexo registrado para envio.",
        )
      ) {
        setFile(null);
        attempts.current.delete(attemptKey);
      }
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  const olderMessages = async () => {
    if (!conversation || !detail?.messages.length) return;
    const first = detail.messages[0];
    if (!first) return;
    try {
      const previous = await api<{ data: Message[] }>(
        `/whatsapp/conversations/${conversation.id}/messages?before=${encodeURIComponent(first.id)}`,
      );
      if (selectedRef.current === conversation.id)
        setDetail((current) =>
          current
            ? {
                ...current,
                messages: [
                  ...previous.data.filter(
                    (item) => !current.messages.some((message) => message.id === item.id),
                  ),
                  ...current.messages,
                ],
              }
            : current,
        );
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  return (
    <div className={styles.central}>
      <div className={styles.heading}>
        <div>
          <h1>Central de Atendimento</h1>
          <p className={styles.muted}>
            WhatsApp Business oficial · mensagens e fila da sua organização
          </p>
        </div>
        <span className={styles.connection} role="status">
          <i className={styles.dot} data-offline={!connected} />
          {connected ? "Atualização automática" : "Reconectando; dados podem estar desatualizados"}
        </span>
        {capabilities?.can_claim && (
          <Button
            disabled={busy || available === null}
            onClick={async () => {
              if (available === null) return;
              setBusy(true);
              setError("");
              try {
                const value = await api<{ available: boolean }>("/whatsapp/availability", "PUT", {
                  available: !available,
                });
                setAvailable(value.available);
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {available === null
              ? "Consultando disponibilidade…"
              : available
                ? "Disponível para atender · pausar"
                : "Indisponível · ativar atendimento"}
          </Button>
        )}
      </div>
      {metrics && (
        <div className={styles.metrics}>
          {(
            [
              ["Recebidos", metrics.received],
              ["Aguardando", metrics.waiting],
              ["Em atendimento", metrics.active],
              ["Finalizados", metrics.closed],
            ] as const
          ).map(([label, value]) => (
            <div className={styles.metric} key={label}>
              <span>{label}</span>
              <strong>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
      )}
      {capabilities?.can_report && (
        <details className={styles.dashboard}>
          <summary>Indicadores e filtros do atendimento</summary>
          <div className={styles.settingsGrid}>
            <label>
              Período
              <select
                value={metricFilters.days}
                onChange={(event) =>
                  setMetricFilters({ ...metricFilters, days: event.target.value })
                }
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={metricFilters.status}
                onChange={(event) =>
                  setMetricFilters({ ...metricFilters, status: event.target.value })
                }
              >
                <option value="">Todos</option>
                <option value="waiting">Aguardando</option>
                <option value="active">Em atendimento</option>
                <option value="closed">Finalizados</option>
              </select>
            </label>
            <label>
              Origem
              <select
                value={metricFilters.source}
                onChange={(event) =>
                  setMetricFilters({ ...metricFilters, source: event.target.value })
                }
              >
                <option value="">Todas as origens</option>
                {metricOptions?.by_source
                  ?.filter((item) => item.key)
                  .map((item) => (
                    <option key={item.key} value={item.key!}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Campanha
              <select
                value={metricFilters.campaign_id}
                onChange={(event) =>
                  setMetricFilters({ ...metricFilters, campaign_id: event.target.value })
                }
              >
                <option value="">Todas as campanhas</option>
                {metricOptions?.by_campaign
                  ?.filter((item) => item.key)
                  .map((item) => (
                    <option key={item.key} value={item.key!}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Corretor
              <select
                value={metricFilters.user_id}
                onChange={(event) =>
                  setMetricFilters({ ...metricFilters, user_id: event.target.value })
                }
              >
                <option value="">Todos os autorizados</option>
                {metricOptions?.by_user
                  ?.filter((item) => item.key)
                  .map((item) => (
                    <option key={item.key} value={item.key!}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Equipe
              <input
                value={metricFilters.team}
                maxLength={160}
                placeholder="Nome exato da equipe"
                onChange={(event) =>
                  setMetricFilters({ ...metricFilters, team: event.target.value })
                }
              />
            </label>
          </div>
          {metrics ? (
            <>
              <div className={styles.metrics}>
                {(
                  [
                    ["Sem resposta", metrics.unanswered ?? "—"],
                    ["Transferidos", metrics.transferred ?? "—"],
                    [
                      "Tempo médio até assumir",
                      metrics.average_claim_seconds == null
                        ? "Sem base"
                        : `${Math.round(metrics.average_claim_seconds)} s`,
                    ],
                    [
                      "Primeira resposta humana",
                      metrics.average_first_response_seconds == null
                        ? "Sem base"
                        : `${Math.round(metrics.average_first_response_seconds)} s`,
                    ],
                    [
                      "Conversão comercial",
                      metrics.conversion_rate == null
                        ? "Sem base"
                        : new Intl.NumberFormat("pt-BR", {
                            style: "percent",
                            maximumFractionDigits: 1,
                          }).format(metrics.conversion_rate),
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div className={styles.metric} key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.groupMetrics}>
                {(
                  [
                    ["Atendimentos por corretor", metrics.by_user],
                    ["Leads por origem", metrics.by_source],
                    ["Leads por campanha", metrics.by_campaign],
                  ] as const
                ).map(([label, rows]) => (
                  <section key={label}>
                    <h2>{label}</h2>
                    {!rows?.length && <p className={styles.muted}>Sem dados neste recorte.</p>}
                    {rows?.map((row, index) => (
                      <div className={styles.groupMetric} key={row.key || `unknown-${index}`}>
                        <span>{row.name}</span>
                        <strong>{row.count}</strong>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.muted}>
              Indicadores indisponíveis. Nenhum valor de demonstração é exibido.
            </p>
          )}
        </details>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}{" "}
          <Button
            disabled={busy}
            onClick={() => {
              setError("");
              void refresh();
            }}
          >
            Atualizar
          </Button>
        </div>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.mobileTabs} aria-label="Áreas do atendimento">
        {(
          [
            ["list", "Conversas"],
            ["chat", "Chat"],
            ["info", "Informações"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={pane === value}
            onClick={() => setPane(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.layout} data-pane={pane}>
        <section className={styles.listPane} aria-label="Lista de conversas">
          <div className={styles.filters}>
            <label className={styles.muted} htmlFor="wa-search">
              Buscar nome ou telefone
            </label>
            <input
              id="wa-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Nome ou telefone"
            />
            <label className={styles.muted} htmlFor="wa-filter">
              Filtrar atendimentos
            </label>
            <select
              id="wa-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="waiting">Aguardando atendimento</option>
              <option value="active">Em atendimento</option>
              <option value="mine">Meus atendimentos</option>
              <option value="unanswered">Não respondidos</option>
              <option value="closed">Finalizados</option>
              <option value="transferred">Transferidos</option>
            </select>
          </div>
          <div className={styles.conversationList}>
            {loading && (
              <p className={styles.empty} role="status">
                Carregando conversas…
              </p>
            )}
            {!loading && !conversations.length && (
              <p className={styles.empty}>
                Nenhuma conversa neste recorte. As mensagens aparecem após configurar um número
                oficial e receber seu primeiro contato.
              </p>
            )}
            {conversations.map((item) => (
              <button
                type="button"
                className={styles.conversation}
                aria-pressed={selected === item.id}
                key={item.id}
                disabled={busy}
                onClick={() => void choose(item.id)}
              >
                <span className={styles.conversationName}>
                  <strong>{item.name || item.phone}</strong>
                  {!!item.unread_count && (
                    <span
                      className={styles.unread}
                      aria-label={`${item.unread_count} mensagens não lidas`}
                    >
                      {item.unread_count}
                    </span>
                  )}
                </span>
                <span className={styles.preview}>{item.last_message_preview || item.phone}</span>
                <span className={styles.badge}>{statusNames[item.status] || item.status}</span>
                <span className={styles.muted}>
                  {item.assigned_user_name || "Sem responsável"} · {dateLabel(item.last_message_at)}
                </span>
              </button>
            ))}
            {nextCursor && (
              <Button
                onClick={() =>
                  void loadList(nextCursor).catch((failure: Error) => setError(failure.message))
                }
              >
                Carregar mais conversas
              </Button>
            )}
          </div>
        </section>
        <section className={styles.chatPane} aria-label="Chat do atendimento">
          {detailLoading ? (
            <p className={styles.empty} role="status">
              Carregando histórico…
            </p>
          ) : !conversation ? (
            <p className={styles.empty}>
              Selecione uma conversa para visualizar o histórico e assumir o atendimento.
            </p>
          ) : (
            <>
              <div className={`${styles.paneHeader} ${styles.chatHeader}`}>
                <div>
                  <strong>{conversation.name || conversation.phone}</strong>
                  <p className={styles.muted}>
                    {conversation.phone} · {statusNames[conversation.status]}
                  </p>
                </div>
                {conversation.status === "waiting" &&
                  conversation.distribution_mode !== "manual" &&
                  capabilities?.can_claim &&
                  capabilities.can_send && (
                    <Button
                      primary
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/whatsapp/conversations/${conversation.id}/claim`,
                          { version: conversation.version },
                          "Atendimento assumido.",
                        )
                      }
                    >
                      Assumir atendimento
                    </Button>
                  )}
                {conversation.status === "active" && (owned || capabilities?.can_supervise) && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/whatsapp/conversations/${conversation.id}/close`,
                        { version: conversation.version },
                        "Atendimento finalizado.",
                      )
                    }
                  >
                    Finalizar
                  </Button>
                )}
              </div>
              <div
                className={styles.messageList}
                role="log"
                aria-label="Histórico de mensagens"
                aria-live="polite"
              >
                {!!detail.messages.length && (
                  <Button disabled={busy} onClick={() => void olderMessages()}>
                    Carregar mensagens anteriores
                  </Button>
                )}
                {!detail.messages.length && (
                  <p className={styles.empty}>Nenhuma mensagem registrada.</p>
                )}
                {detail.messages.map((message) => (
                  <article
                    key={message.id}
                    className={styles.message}
                    data-direction={message.direction}
                  >
                    <p>{contentText(message)}</p>
                    {message.media_reference && (
                      <MediaAttachment conversationId={conversation.id} message={message} />
                    )}
                    <div className={styles.messageMeta}>
                      <time dateTime={message.created_at}>{dateLabel(message.created_at)}</time>
                      {message.direction === "outbound" && (
                        <span>
                          {deliveryNames[message.delivery_status] || message.delivery_status}
                        </span>
                      )}
                    </div>
                    {message.delivery_status === "failed" && (
                      <p className={styles.muted}>
                        O envio falhou. Confira o diagnóstico antes de tentar novamente.
                      </p>
                    )}
                    {canReply && retryMessagePayload(message) && (
                      <Button
                        disabled={busy || (message.type === "text" && !windowOpen)}
                        onClick={() =>
                          void mutate(
                            `/whatsapp/conversations/${conversation.id}/messages`,
                            retryMessagePayload(message),
                            "Nova tentativa processada. Confira o status da mensagem.",
                          )
                        }
                      >
                        Tentar novamente
                      </Button>
                    )}
                    {message.delivery_status === "failed" && (message.attempts ?? 0) >= 3 && (
                      <p className={styles.muted}>
                        Limite de três tentativas atingido. Consulte o administrador.
                      </p>
                    )}
                    {message.delivery_status === "failed" && message.media_reference && (
                      <p className={styles.muted}>
                        Confira a falha antes de selecionar o anexo novamente. Não existe reenvio
                        automático de mídia.
                      </p>
                    )}
                  </article>
                ))}
              </div>
              <form className={styles.composer} onSubmit={(event) => void sendText(event)}>
                {!canReply ? (
                  <p>Somente o responsável autorizado pode responder um atendimento ativo.</p>
                ) : (
                  <>
                    <p className={styles.muted}>
                      {windowOpen
                        ? "Janela de atendimento aberta. Envios sujeitos às regras e à cobrança da Meta."
                        : "Janela de 24 horas encerrada. Utilize um modelo aprovado; mensagens livres estão bloqueadas."}
                    </p>
                    <label className={styles.muted} htmlFor="wa-message">
                      Mensagem para o cliente
                    </label>
                    <textarea
                      id="wa-message"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={4096}
                      disabled={busy || !windowOpen}
                      placeholder={
                        windowOpen ? "Escreva uma mensagem" : "Selecione um modelo aprovado abaixo"
                      }
                    />
                    <div className={styles.actions}>
                      <label className={styles.fileLabel}>
                        Anexar arquivo
                        <input
                          key={file?.name || "empty"}
                          type="file"
                          accept="image/jpeg,image/png,application/pdf,audio/mpeg,audio/ogg,audio/mp4,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          disabled={busy || !windowOpen}
                          onChange={(event) => setFile(event.target.files?.[0] || null)}
                        />
                      </label>
                      <Button primary type="submit" disabled={busy || !windowOpen || !draft.trim()}>
                        Enviar mensagem
                      </Button>
                    </div>
                    {file && (
                      <Button disabled={busy || !windowOpen} onClick={() => void sendFile()}>
                        Enviar anexo: {file.name}
                      </Button>
                    )}
                    <details>
                      <summary>Modelos oficiais</summary>
                      <label className={styles.fileLabel}>
                        Modelo aprovado
                        <select
                          value={templateId}
                          disabled={busy}
                          onChange={(event) => {
                            const selectedTemplate = templates.find(
                              (item) => item.name + ":" + item.language === event.target.value,
                            );
                            setTemplateId(event.target.value);
                            setParameters(
                              Array.from(
                                {
                                  length: selectedTemplate
                                    ? templateParameters(selectedTemplate) || 0
                                    : 0,
                                },
                                () => "",
                              ),
                            );
                          }}
                        >
                          <option value="">Selecione um modelo</option>
                          {templates.map((item) => (
                            <option
                              key={item.name + ":" + item.language}
                              value={item.name + ":" + item.language}
                              disabled={templateParameters(item) === null}
                            >
                              {item.name} · {item.language} ·{" "}
                              {item.category || "Categoria não informada"} · {item.status}
                              {templateParameters(item) === null ? " · formato não suportado" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      {template?.components?.find((item) => item.type === "BODY")?.text && (
                        <p>{template.components.find((item) => item.type === "BODY")?.text}</p>
                      )}
                      {parameters.map((value, index) => (
                        <label className={styles.fileLabel} key={index}>
                          Variável {index + 1}
                          <input
                            value={value}
                            maxLength={1024}
                            disabled={busy}
                            onChange={(event) =>
                              setParameters((current) =>
                                current.map((item, position) =>
                                  position === index ? event.target.value : item,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                      <Button
                        disabled={
                          busy ||
                          !template ||
                          parameterCount === null ||
                          parameters.some((value) => !value.trim())
                        }
                        onClick={() => void sendTemplate()}
                      >
                        Enviar modelo aprovado
                      </Button>
                      {!templates.length && (
                        <p className={styles.muted}>
                          Nenhum modelo disponível para esta conta. A consulta depende da
                          configuração e das permissões da Meta.
                        </p>
                      )}
                    </details>
                  </>
                )}
              </form>
            </>
          )}
        </section>
        <div className={styles.infoPane} role="complementary" aria-label="Informações do lead">
          {!conversation ? (
            <p className={styles.empty}>
              As informações do contato aparecem ao selecionar uma conversa.
            </p>
          ) : (
            <>
              <section>
                <h2>Informações do lead</h2>
                <dl>
                  <dt>Nome</dt>
                  <dd>{conversation.name || "Não informado"}</dd>
                  <dt>Telefone</dt>
                  <dd>{conversation.phone}</dd>
                  <dt>Origem</dt>
                  <dd>{conversation.source || "Desconhecida"}</dd>
                  <dt>Campanha</dt>
                  <dd>{conversation.source_campaign_name || "Não informada pela Meta"}</dd>
                  <dt>Entrada</dt>
                  <dd>{dateLabel(conversation.created_at)}</dd>
                  <dt>Equipe</dt>
                  <dd>{conversation.team || "Sem equipe"}</dd>
                  <dt>Responsável</dt>
                  <dd>{conversation.assigned_user_name || "Não atribuído"}</dd>
                  <dt>Empreendimento</dt>
                  <dd>{conversation.interest || "Não informado"}</dd>
                  <dt>Etapa comercial</dt>
                  <dd>{stages[conversation.stage ?? -1] || "Não informada"}</dd>
                  <dt>Etiquetas</dt>
                  <dd>{conversation.tags?.join(", ") || "Nenhuma"}</dd>
                </dl>
              </section>
              {commercial &&
                capabilities?.can_edit &&
                capabilities.can_move_stage &&
                (owned || capabilities.can_supervise) && (
                  <section>
                    <h2>Dados comerciais</h2>
                    <label className={styles.fileLabel}>
                      Empreendimento de interesse
                      <input
                        value={commercial.interest}
                        maxLength={250}
                        disabled={busy}
                        onChange={(event) =>
                          setCommercialDraft({ ...commercial, interest: event.target.value })
                        }
                      />
                    </label>
                    <label className={styles.fileLabel}>
                      Etapa do funil
                      <select
                        value={commercial.stage}
                        disabled={busy}
                        onChange={(event) =>
                          setCommercialDraft({
                            ...commercial,
                            stage: Number(event.target.value),
                            confirm_sale: false,
                          })
                        }
                      >
                        {stages.map((stage, index) => (
                          <option key={stage} value={index}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.fileLabel}>
                      Etiquetas, separadas por vírgula
                      <input
                        value={commercial.tags}
                        maxLength={2000}
                        disabled={busy}
                        onChange={(event) =>
                          setCommercialDraft({ ...commercial, tags: event.target.value })
                        }
                      />
                    </label>
                    {commercial.stage === 5 && conversation.stage !== 5 && (
                      <label className={styles.confirmation}>
                        <input
                          type="checkbox"
                          checked={commercial.confirm_sale}
                          disabled={busy}
                          onChange={(event) =>
                            setCommercialDraft({
                              ...commercial,
                              confirm_sale: event.target.checked,
                            })
                          }
                        />
                        Confirmo que o negócio foi fechado
                      </label>
                    )}
                    <Button
                      disabled={
                        busy ||
                        !commercialDraft ||
                        (commercial.stage === 5 &&
                          conversation.stage !== 5 &&
                          !commercial.confirm_sale)
                      }
                      onClick={async () => {
                        if (
                          await mutate(
                            `/whatsapp/conversations/${conversation.id}`,
                            {
                              version: commercial.version,
                              interest: commercial.interest.trim(),
                              tags: [
                                ...new Set(
                                  commercial.tags
                                    .split(",")
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                                ),
                              ],
                              stage: commercial.stage,
                              confirm_sale: commercial.confirm_sale,
                            },
                            "Dados comerciais atualizados.",
                            "PATCH",
                          )
                        )
                          setCommercialDraft(null);
                      }}
                    >
                      Salvar dados comerciais
                    </Button>
                  </section>
                )}
              {conversation.status !== "closed" && (owned || capabilities?.can_supervise) && (
                <section>
                  <h2>Movimentar atendimento</h2>
                  <label className={styles.fileLabel}>
                    Novo responsável
                    <select
                      value={target}
                      disabled={busy}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      <option value="">Selecione um usuário permitido</option>
                      {detail.eligible_users
                        .filter((item) => item.id !== conversation.assigned_user_id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    disabled={busy || !target}
                    onClick={() =>
                      void mutate(
                        `/whatsapp/conversations/${conversation.id}/transfer`,
                        { version: conversation.version, target_user_id: target },
                        "Atendimento transferido.",
                      )
                    }
                  >
                    Transferir atendimento
                  </Button>
                  <Button
                    disabled={busy || conversation.status === "waiting"}
                    onClick={() =>
                      void mutate(
                        `/whatsapp/conversations/${conversation.id}/requeue`,
                        { version: conversation.version },
                        "Atendimento devolvido à fila.",
                      )
                    }
                  >
                    Devolver à fila
                  </Button>
                </section>
              )}
              <section>
                <h2>Observações internas</h2>
                <p className={styles.muted}>Estas observações nunca são enviadas ao cliente.</p>
                {detail.notes.map((item) => (
                  <div className={styles.note} key={item.id}>
                    <p>{item.body}</p>
                    <time className={styles.muted}>{dateLabel(item.created_at)}</time>
                  </div>
                ))}
                {(owned || capabilities?.can_supervise) && (
                  <>
                    <label className={styles.fileLabel}>
                      Nova observação
                      <textarea
                        value={note}
                        maxLength={4000}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <Button
                      disabled={busy || !note.trim()}
                      onClick={async () => {
                        if (
                          await mutate(
                            `/whatsapp/conversations/${conversation.id}/notes`,
                            { text: note.trim() },
                            "Observação interna salva.",
                          )
                        )
                          setNote("");
                      }}
                    >
                      Salvar observação
                    </Button>
                  </>
                )}
              </section>
              <section>
                <h2>Histórico de responsáveis</h2>
                {!detail.history.length && (
                  <p className={styles.muted}>Nenhuma movimentação registrada.</p>
                )}
                {detail.history.map((item) => (
                  <p className={styles.muted} key={item.id}>
                    {item.action} · {dateLabel(item.created_at)}
                  </p>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
