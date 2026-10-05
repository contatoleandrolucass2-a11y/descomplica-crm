const synchronizedNames = new Set([
  "associative-pending-shine",
  "associative-selection-shine",
  "associative-rejection-shine",
  "associative-loop-orbit",
  "associative-property-orbit",
  "associative-installment-orbit",
  "associative-documentation-shine",
]);

/** Align newly mounted CSS effects without a rendering timer or financial state changes. */
export function synchronizeAssociativeMotion(root: HTMLElement) {
  const timeline = root.ownerDocument.timeline;
  const origin = timeline.currentTime;
  if (typeof origin !== "number" || !root.getAnimations) return () => {};
  const groups = new WeakMap<Element, number>();
  const aligned = new WeakSet<Animation>();
  let frame = 0;
  const align = () => {
    frame = 0;
    const now = timeline.currentTime;
    if (typeof now !== "number") return;
    for (const animation of root.getAnimations({ subtree: true })) {
      if (
        !(animation instanceof CSSAnimation) ||
        !synchronizedNames.has(animation.animationName) ||
        aligned.has(animation)
      )
        continue;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!(target instanceof Element)) continue;
      const group = target.closest("[data-associative-motion-group]");
      if (group && !groups.has(group)) groups.set(group, now);
      animation.startTime = group ? groups.get(group)! : origin;
      aligned.add(animation);
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(align);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "disabled", "aria-disabled", "aria-pressed", "checked"],
  });
  root.addEventListener("change", schedule);
  root.addEventListener("input", schedule);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", schedule);
  schedule();
  return () => {
    observer.disconnect();
    root.removeEventListener("change", schedule);
    root.removeEventListener("input", schedule);
    motion.removeEventListener("change", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}
