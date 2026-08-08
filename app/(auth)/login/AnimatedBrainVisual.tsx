"use client";

import { useEffect, useRef } from "react";

import styles from "./AnimatedBrainVisual.module.css";

type GearProps = {
  centerX: number;
  centerY: number;
  radius: number;
  speed: number;
  teeth: number;
  tone: "amber" | "coral" | "graphite" | "lime" | "magenta" | "teal";
};

function Gear({ centerX, centerY, radius, speed, teeth, tone }: GearProps) {
  const toothWidth = radius * 0.22;
  const toothHeight = radius * 0.34;

  return (
    <g
      className={`${styles.gear} ${styles[tone]}`}
      data-brain-gear
      data-center-x={centerX}
      data-center-y={centerY}
      data-speed={speed}
    >
      {Array.from({ length: teeth }, (_, index) => (
        <rect
          key={index}
          x={centerX - toothWidth / 2}
          y={centerY - radius - toothHeight / 2}
          width={toothWidth}
          height={toothHeight}
          rx={toothWidth * 0.12}
          transform={`rotate(${(360 / teeth) * index} ${centerX} ${centerY})`}
        />
      ))}
      <circle cx={centerX} cy={centerY} r={radius * 0.84} />
      {Array.from({ length: 6 }, (_, index) => (
        <rect
          key={index}
          className={styles.spoke}
          x={centerX - radius * 0.08}
          y={centerY - radius * 0.7}
          width={radius * 0.16}
          height={radius * 0.7}
          rx={radius * 0.06}
          transform={`rotate(${index * 60} ${centerX} ${centerY})`}
        />
      ))}
      <circle className={styles.hubOuter} cx={centerX} cy={centerY} r={radius * 0.3} />
      <circle className={styles.hubInner} cx={centerX} cy={centerY} r={radius * 0.13} />
    </g>
  );
}

export function AnimatedBrainVisual() {
  const rootRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const motionRef = useRef({
    currentX: 0,
    currentY: 0,
    currentTilt: 0,
    gearEnergy: 0,
    targetX: 0,
    targetY: 0,
    targetTilt: 0,
    targetGearEnergy: 0,
  });
  const lastTimeRef = useRef(0);
  const gearAnglesRef = useRef<number[]>([]);
  const reducedMotionRef = useRef(false);
  const finePointerRef = useRef(false);
  const runFrameRef = useRef<(time: number) => void>(() => undefined);

  const scheduleFrame = () => {
    if (animationFrameRef.current === null && !reducedMotionRef.current) {
      animationFrameRef.current = requestAnimationFrame(runFrameRef.current);
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    reducedMotionRef.current = reducedMotion.matches;
    finePointerRef.current = finePointer.matches;

    const stage = root.querySelector<SVGGElement>("[data-brain-stage]");
    const mechanism = root.querySelector<SVGGElement>("[data-brain-mechanism]");
    const gears = Array.from(root.querySelectorAll<SVGGElement>("[data-brain-gear]"));
    gearAnglesRef.current = gears.map(() => 0);

    const resetVisual = () => {
      motionRef.current = {
        currentX: 0,
        currentY: 0,
        currentTilt: 0,
        gearEnergy: 0,
        targetX: 0,
        targetY: 0,
        targetTilt: 0,
        targetGearEnergy: 0,
      };
      stage?.setAttribute("transform", "translate(0 0) rotate(0 627 627)");
      mechanism?.setAttribute("transform", "translate(0 0)");
      gears.forEach((gear) => gear.removeAttribute("transform"));
      gearAnglesRef.current = gears.map(() => 0);
      root.removeAttribute("data-active");
    };

    runFrameRef.current = (time: number) => {
      animationFrameRef.current = null;
      if (reducedMotionRef.current) {
        resetVisual();
        return;
      }

      const elapsed = lastTimeRef.current === 0 ? 16 : Math.min(time - lastTimeRef.current, 48);
      lastTimeRef.current = time;
      const motion = motionRef.current;
      const positionEase = 1 - Math.exp(-elapsed / 85);
      const energyEase = 1 - Math.exp(-elapsed / 260);

      motion.currentX += (motion.targetX - motion.currentX) * positionEase;
      motion.currentY += (motion.targetY - motion.currentY) * positionEase;
      motion.currentTilt += (motion.targetTilt - motion.currentTilt) * positionEase;
      motion.gearEnergy += (motion.targetGearEnergy - motion.gearEnergy) * energyEase;

      stage?.setAttribute(
        "transform",
        `translate(${motion.currentX.toFixed(2)} ${motion.currentY.toFixed(2)}) rotate(${motion.currentTilt.toFixed(2)} 627 627)`,
      );
      mechanism?.setAttribute(
        "transform",
        `translate(${(motion.currentX * 0.48).toFixed(2)} ${(motion.currentY * 0.48).toFixed(2)})`,
      );

      gears.forEach((gear, index) => {
        const speed = Number(gear.dataset.speed ?? "1");
        const centerX = Number(gear.dataset.centerX ?? "0");
        const centerY = Number(gear.dataset.centerY ?? "0");
        const angle =
          (gearAnglesRef.current[index] ?? 0) + speed * motion.gearEnergy * elapsed * 0.035;
        gearAnglesRef.current[index] = angle % 360;
        gear.setAttribute("transform", `rotate(${angle.toFixed(2)} ${centerX} ${centerY})`);
      });

      const isSettled =
        Math.abs(motion.targetX - motion.currentX) < 0.02 &&
        Math.abs(motion.targetY - motion.currentY) < 0.02 &&
        Math.abs(motion.targetTilt - motion.currentTilt) < 0.02 &&
        Math.abs(motion.targetGearEnergy - motion.gearEnergy) < 0.003;

      if (!isSettled || motion.gearEnergy > 0.003) scheduleFrame();
      else lastTimeRef.current = 0;
    };

    const handleMotionPreference = () => {
      reducedMotionRef.current = reducedMotion.matches;
      if (reducedMotion.matches) {
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        resetVisual();
      }
    };
    const handlePointerPreference = () => {
      finePointerRef.current = finePointer.matches;
      if (!finePointer.matches) resetVisual();
    };

    reducedMotion.addEventListener("change", handleMotionPreference);
    finePointer.addEventListener("change", handlePointerPreference);

    return () => {
      reducedMotion.removeEventListener("change", handleMotionPreference);
      finePointer.removeEventListener("change", handlePointerPreference);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handlePointerEnter = () => {
    if (reducedMotionRef.current || !finePointerRef.current) return;
    rootRef.current?.setAttribute("data-active", "true");
    motionRef.current.targetGearEnergy = 1;
    scheduleFrame();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotionRef.current || !finePointerRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    const normalizedY = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    motionRef.current.targetX = normalizedX * 5;
    motionRef.current.targetY = normalizedY * 4;
    motionRef.current.targetTilt = Math.max(-4, Math.min(4, normalizedX * 3.2 + normalizedY * 0.8));
    scheduleFrame();
  };

  const handlePointerLeave = () => {
    if (reducedMotionRef.current || !finePointerRef.current) return;
    rootRef.current?.removeAttribute("data-active");
    motionRef.current.targetX = 0;
    motionRef.current.targetY = 0;
    motionRef.current.targetTilt = 0;
    motionRef.current.targetGearEnergy = 0;
    scheduleFrame();
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      aria-hidden="true"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className={styles.aura} />
      <svg className={styles.visual} viewBox="0 0 1254 1254" role="presentation">
        <defs>
          <radialGradient id="brain-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#2563eb" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className={styles.glow} cx="670" cy="430" r="455" fill="url(#brain-glow)" />
        <g data-brain-stage>
          <image href="/images/login/mechanical-brain.png" width="1254" height="1254" />
          <g className={styles.mechanism} data-brain-mechanism>
            <Gear centerX={454} centerY={255} radius={94} speed={0.62} teeth={14} tone="graphite" />
            <Gear centerX={700} centerY={286} radius={105} speed={-0.46} teeth={16} tone="amber" />
            <Gear centerX={842} centerY={192} radius={58} speed={0.72} teeth={13} tone="magenta" />
            <Gear centerX={749} centerY={486} radius={63} speed={0.68} teeth={14} tone="teal" />
            <Gear centerX={961} centerY={399} radius={58} speed={-0.8} teeth={13} tone="coral" />
            <Gear centerX={852} centerY={583} radius={30} speed={1.15} teeth={12} tone="lime" />
          </g>
        </g>
      </svg>
    </div>
  );
}
