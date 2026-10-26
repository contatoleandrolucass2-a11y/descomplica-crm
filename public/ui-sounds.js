"use strict";

(() => {
  const STORAGE_KEY = "descomplica-ui-sounds-muted";
  const HOVER_COOLDOWN_MS = 850;
  const clickTones = [
    { start: 430, end: 520, duration: 0.04, volume: 0.012 },
    { start: 510, end: 590, duration: 0.035, volume: 0.01 },
  ];
  const hoverTones = [
    { start: 285, end: 330, duration: 0.055, volume: 0.005 },
    { start: 340, end: 380, duration: 0.05, volume: 0.0045 },
  ];

  let audioContext = null;
  let clickIndex = 0;
  let hoverIndex = 0;
  let lastHoverAt = 0;

  const isMuted = () => localStorage.getItem(STORAGE_KEY) === "true";

  function getAudioContext() {
    if (audioContext) return audioContext;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audioContext = new AudioContext();
    return audioContext;
  }

  function playTone(tone, waveform = "sine") {
    if (isMuted()) return;
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => {});

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(tone.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(tone.end, now + tone.duration);
    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.duration);
  }

  function updateToggle() {
    const toggle = document.querySelector("#ui-sound-toggle");
    if (!toggle) return;
    const muted = isMuted();
    toggle.textContent = muted ? "🔇" : "🔈";
    toggle.title = muted ? "Ativar sons discretos" : "Silenciar sons discretos";
    toggle.setAttribute("aria-label", toggle.title);
    toggle.setAttribute("aria-pressed", String(muted));
  }

  document.addEventListener(
    "click",
    (event) => {
      const control = event.target.closest("button, [role='button'], summary");
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;

      if (control.id === "ui-sound-toggle") {
        const willMute = !isMuted();
        localStorage.setItem(STORAGE_KEY, String(willMute));
        updateToggle();
        if (!willMute) playTone({ start: 420, end: 560, duration: 0.06, volume: 0.012 });
        return;
      }

      playTone(clickTones[clickIndex++ % clickTones.length], "triangle");
    },
    true,
  );

  document.addEventListener(
    "pointerover",
    (event) => {
      const graph = event.target.closest(".chart, [data-chart-type] .chart, .panel-body svg");
      if (!graph || graph.contains(event.relatedTarget)) return;
      const now = Date.now();
      if (!audioContext || now - lastHoverAt < HOVER_COOLDOWN_MS) return;
      lastHoverAt = now;
      playTone(hoverTones[hoverIndex++ % hoverTones.length]);
    },
    true,
  );

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) updateToggle();
  });
  document.addEventListener("DOMContentLoaded", updateToggle);
})();
