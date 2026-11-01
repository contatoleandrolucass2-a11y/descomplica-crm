import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Inbox, MessageCircle, X } from "lucide-react";
import { playNotificationSounds } from "./notificationSound";
import { useAuth } from "./Auth";
import { useApi, type Lead } from "./api";

type Notice = {
  id: string;
  lead: Pick<Lead, "id" | "name" | "product">;
  kind: "received" | "bucket";
  count?: number;
};
export default function LeadNotifications({ navigate }: { navigate: (route: string) => void }) {
  const { demo } = useAuth();
  const reducedMotion = useReducedMotion();
  const result = useApi<{ data: Lead[] }>("/leads");
  const previous = useRef<Map<string, boolean> | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    if (!demo) return;
    const simulate = () => {
      const stamp = Date.now();
      playNotificationSounds(["received", "bucket"]);
      setNotices([
        {
          id: "demo-received-" + stamp,
          kind: "received",
          lead: {
            id: "demo-received",
            name: "Mariana Souza (simulação)",
            product: "Residencial Aurora",
          },
        },
        {
          id: "demo-bucket-" + stamp,
          kind: "bucket",
          lead: {
            id: "demo-bucket",
            name: "Carlos Lima (simulação)",
            product: "Parque das Flores",
          },
        },
      ]);
    };
    window.addEventListener("lead-demo-notifications", simulate);
    return () => window.removeEventListener("lead-demo-notifications", simulate);
  }, [demo]);
  useEffect(() => {
    const data = result.data;
    if (!data) return;
    const timeout = setTimeout(() => {
      const current = new Map(data.data.map((lead) => [lead.id, !!lead.bucket_available_at]));
      if (!previous.current) {
        const available = data.data.filter((lead) => lead.bucket_available_at);
        if (available.length)
          setNotices([
            {
              id: "bucket-summary",
              lead: available[0]!,
              kind: "bucket",
              count: available.length,
            },
          ]);
      } else {
        const before = previous.current;
        const incoming = data.data.flatMap<Notice>((lead) => {
          if (lead.bucket_available_at && !before.get(lead.id))
            return [{ id: lead.id + ":bucket", lead, kind: "bucket" as const }];
          if (!before.has(lead.id) && !lead.archived)
            return [{ id: lead.id + ":received", lead, kind: "received" as const }];
          return [];
        });
        if (incoming.length) {
          playNotificationSounds(incoming.map((notice) => notice.kind));
          setNotices((existing) =>
            [
              ...incoming,
              ...existing.filter((notice) => !incoming.some((item) => item.id === notice.id)),
            ].slice(0, 4),
          );
        }
      }
      previous.current = current;
    }, 0);
    return () => clearTimeout(timeout);
  }, [result.data]);
  return (
    <aside
      className="lead-notifications"
      aria-label="Avisos de leads"
      aria-live="polite"
      aria-relevant="additions"
      data-ready={!!result.data}
    >
      <AnimatePresence initial={!reducedMotion}>
        {notices.map((notice) => {
          const Icon = notice.kind === "bucket" ? Inbox : MessageCircle;
          const title = notice.count
            ? `${notice.count} leads no Bolsão`
            : notice.kind === "bucket"
              ? "Lead no Bolsão"
              : "Novo lead recebido";
          const description = notice.count ? "Disponíveis para atendimento." : notice.lead.name;
          return (
            <motion.section
              key={notice.id}
              className="lead-notification"
              data-kind={notice.kind}
              layout={!reducedMotion}
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
            >
              <button
                type="button"
                className="lead-notification-open"
                aria-label={
                  title +
                  ". " +
                  description +
                  ". " +
                  (notice.kind === "bucket" ? "Abrir Bolsão" : "Ver atendimento")
                }
                onClick={() => {
                  navigate(notice.kind === "bucket" ? "Bolsão" : "Leads");
                  setNotices((items) => items.filter((item) => item.id !== notice.id));
                }}
              >
                <span className="lead-notification-icon" aria-hidden="true">
                  <Icon size={13} />
                </span>
                <span className="lead-notification-copy">
                  <strong>{title}</strong>
                  <span
                    className="lead-notification-description"
                    title={
                      notice.count ? description : notice.lead.name + " · " + notice.lead.product
                    }
                  >
                    {description}
                  </span>
                  <span className="lead-notification-action">
                    {notice.kind === "bucket" ? "Abrir Bolsão" : "Ver atendimento"}
                  </span>
                </span>
              </button>
              <button
                className="lead-notification-close"
                type="button"
                aria-label={
                  notice.count
                    ? "Dispensar resumo do Bolsão"
                    : "Dispensar aviso de " + notice.lead.name
                }
                onClick={() => setNotices((items) => items.filter((item) => item.id !== notice.id))}
              >
                <X size={13} />
              </button>
              <span className="lead-notification-fuse" aria-hidden="true" />
            </motion.section>
          );
        })}
      </AnimatePresence>
    </aside>
  );
}
