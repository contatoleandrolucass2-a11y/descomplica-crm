import { useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useAuth } from "./Auth";
import {
  configureNotificationSound,
  toggleNotificationSound,
  unlockNotificationSound,
  useNotificationSound,
} from "./notificationSound";

export default function NotificationSoundControl() {
  const { user } = useAuth();
  const sound = useNotificationSound();
  useEffect(() => {
    configureNotificationSound(user?.id || "preview");
  }, [user?.id]);
  useEffect(() => {
    const unlock = (event: Event) => {
      if (
        !event.isTrusted ||
        (event.target instanceof Element &&
          event.target.closest("[data-notification-sound-control]"))
      )
        return;
      void unlockNotificationSound();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);
  const audible = sound.enabled && sound.ready;
  const label = audible ? "Silenciar som dos leads" : "Ativar som dos leads";
  return (
    <button
      type="button"
      className="crm-icon-button lead-sound-control"
      data-notification-sound-control
      data-sound-state={!sound.enabled ? "muted" : sound.ready ? "ready" : "locked"}
      aria-label={label}
      aria-pressed={audible}
      title={sound.error || label + ". Lead novo: som forte. Bolsão: som suave."}
      onClick={() => void toggleNotificationSound()}
    >
      {audible ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}
