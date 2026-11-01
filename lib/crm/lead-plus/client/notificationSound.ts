import { useSyncExternalStore } from "react";

export type NotificationKind = "received" | "bucket";
type SoundState = { enabled: boolean; ready: boolean; error: string };
export const notificationSounds = {
  received: { name: "Lantern", file: "reactbits-lantern.wav", gain: 1.5 },
  bucket: { name: "Shake", file: "reactbits-shake.wav", gain: 0.45 },
};
let context: AudioContext | null = null;
let state: SoundState = { enabled: true, ready: false, error: "" };
let preferenceKey = "";
let busyUntil = 0;
const listeners = new Set<() => void>();
const active = new Set<AudioBufferSourceNode>();
const buffers = new Map<NotificationKind, Promise<AudioBuffer>>();
let playbackQueue: Promise<void> = Promise.resolve();
let playbackGeneration = 0;
const emit = (next: Partial<SoundState>) => {
  const updated = { ...state, ...next };
  if (
    Object.keys(updated).every(
      (key) => updated[key as keyof SoundState] === state[key as keyof SoundState],
    )
  )
    return;
  state = updated;
  listeners.forEach((listener) => listener());
};
const persist = () => {
  try {
    if (preferenceKey) localStorage.setItem(preferenceKey, state.enabled ? "on" : "off");
  } catch {
    /* O áudio continua funcionando sem armazenamento local. */
  }
};
const stop = () => {
  playbackGeneration += 1;
  playbackQueue = Promise.resolve();
  active.forEach((source) => {
    try {
      source.stop();
    } catch {
      /* A reprodução pode já ter terminado. */
    }
  });
  active.clear();
  busyUntil = 0;
};
export function configureNotificationSound(userId: string) {
  const key = "descomplica-lead:notification-sound:" + userId;
  if (preferenceKey === key) return;
  stop();
  preferenceKey = key;
  let enabled = true;
  try {
    enabled = localStorage.getItem(key) !== "off";
  } catch {
    /* A preferência padrão permite avisos sonoros. */
  }
  emit({ enabled, ready: enabled && context?.state === "running", error: "" });
}
export async function unlockNotificationSound() {
  if (!state.enabled) return false;
  try {
    if (!context || context.state === "closed") {
      const Audio =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) throw Error("Este navegador não oferece áudio de notificações.");
      context = new Audio();
      buffers.clear();
      context.onstatechange = () => emit({ ready: state.enabled && context?.state === "running" });
    }
    if (context.state !== "running") await context.resume();
    const ready = context.state === "running";
    emit({ ready, error: ready ? "" : "Clique para liberar o áudio neste navegador." });
    if (ready)
      void Promise.all(
        (["received", "bucket"] as const).map((kind) => loadNotificationSound(context!, kind)),
      ).catch(() => {});
    return ready;
  } catch {
    emit({ ready: false, error: "Clique novamente para liberar o áudio neste navegador." });
    return false;
  }
}
export async function toggleNotificationSound() {
  if (state.enabled && state.ready) {
    stop();
    emit({ enabled: false, ready: false, error: "" });
    persist();
    return;
  }
  emit({ enabled: true, error: "" });
  persist();
  await unlockNotificationSound();
}
function loadNotificationSound(audio: AudioContext, kind: NotificationKind): Promise<AudioBuffer> {
  let pending = buffers.get(kind);
  if (!pending) {
    const url = import.meta.env.BASE_URL + "sounds/" + notificationSounds[kind].file;
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw Error("Não foi possível carregar o som de notificação.");
        return response.arrayBuffer();
      })
      .then((bytes) => audio.decodeAudioData(bytes))
      .catch((error) => {
        buffers.delete(kind);
        throw error;
      });
    buffers.set(kind, pending);
  }
  return pending;
}
export function playNotificationSounds(kinds: NotificationKind[]) {
  const audio = context;
  if (!state.enabled || !audio || audio.state !== "running") return;
  const generation = playbackGeneration;
  const selected = (["received", "bucket"] as const).filter((kind) => kinds.includes(kind));
  // Um lote toca cada tipo uma única vez. A fila mantém os dois sons separados.
  playbackQueue = playbackQueue
    .then(async () => {
      const loaded = await Promise.all(selected.map((kind) => loadNotificationSound(audio, kind)));
      if (
        generation !== playbackGeneration ||
        !state.enabled ||
        context !== audio ||
        audio.state !== "running"
      )
        return;
      let at = Math.max(audio.currentTime + 0.03, busyUntil);
      selected.forEach((kind, index) => {
        const source = audio.createBufferSource();
        const volume = audio.createGain();
        const buffer = loaded[index];
        if (!buffer) return;
        source.buffer = buffer;
        volume.gain.value = notificationSounds[kind].gain;
        source.connect(volume);
        volume.connect(audio.destination);
        active.add(source);
        source.onended = () => {
          active.delete(source);
          source.disconnect();
          volume.disconnect();
        };
        source.start(at);
        at += buffer.duration + 0.3;
      });
      busyUntil = at;
      emit({ error: "" });
    })
    .catch(() => {
      if (generation === playbackGeneration)
        emit({ error: "Não foi possível carregar o áudio. Tente novamente." });
    });
}
export function useNotificationSound() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
