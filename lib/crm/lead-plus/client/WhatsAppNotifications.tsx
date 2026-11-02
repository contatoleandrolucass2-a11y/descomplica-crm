import { useEffect, useState } from "react";
import { api, LeadApiError } from "./api";
import { useAuth } from "./Auth";
import { canAccessRoute } from "./navigation";
import { playNotificationSounds } from "./notificationSound";
import styles from "./whatsapp-styles";

/** Only scoped event metadata is polled; contact details never appear in this notification. */
export default function WhatsAppNotifications({ navigate }: { navigate: (route: string) => void }) {
  const auth = useAuth();
  const [notice, setNotice] = useState("");
  const userId = auth.user?.id;
  const allowed =
    !!userId && canAccessRoute("Central de Atendimento", auth.can, auth.user?.host_pages);
  useEffect(() => {
    if (!allowed) return;
    let stopped = false;
    let cursor = "";
    let initialized = false;
    let delay = 3000;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api<{ data: { event: string }[]; next_cursor: string }>(
          "/whatsapp/events" + (cursor ? "?after=" + encodeURIComponent(cursor) : ""),
        );
        if (stopped) return;
        if (
          initialized &&
          result.data.some((event) =>
            ["conversation.created", "message.received"].includes(event.event),
          )
        ) {
          setNotice("Nova mensagem ou atendimento disponível na Central de Atendimento.");
          playNotificationSounds(["received"]);
        }
        cursor = result.next_cursor || cursor;
        initialized = true;
        delay = 3000;
      } catch (error) {
        if (stopped) return;
        if (error instanceof LeadApiError && [401, 403].includes(error.status)) {
          setNotice("");
          stopped = true;
          return;
        }
        delay = Math.min(delay * 2, 30000);
      }
      if (!stopped) timer = setTimeout(() => void poll(), delay);
    };
    timer = setTimeout(() => void poll(), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [allowed, userId]);
  if (!allowed || !notice) return null;
  return (
    <div className={styles.notification} role="status" aria-live="polite">
      <button
        type="button"
        className={styles.notificationClose}
        aria-label="Fechar aviso de atendimento"
        onClick={() => setNotice("")}
      >
        ×
      </button>
      <strong>WhatsApp Business</strong>
      <p>{notice}</p>
      <button
        type="button"
        onClick={() => {
          setNotice("");
          navigate("Central de Atendimento");
        }}
      >
        Abrir atendimento
      </button>
    </div>
  );
}
