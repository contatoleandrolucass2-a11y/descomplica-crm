import { afterEach, describe, expect, it, vi } from "vitest";
import { synchronizeAssociativeMotion } from "../app/(protected)/app/simulacao/_components/archive-investor/associative-motion";

class Target {
  constructor(public group: Target | null = null) {}
  closest() {
    return this.group;
  }
}
class CssAnimation {
  startTime = -1;
  effect: { target: Target };
  constructor(
    public animationName: string,
    target = new Target(),
  ) {
    this.effect = { target };
  }
}

function fixture() {
  const callbacks = new Map<number, () => void>();
  let frame = 0;
  let mutation: () => void = () => {};
  const disconnect = vi.fn();
  const media = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const root = {
    ownerDocument: { timeline: { currentTime: 100 } },
    animations: [] as CssAnimation[],
    getAnimations() {
      return this.animations;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("CSSAnimation", CssAnimation);
  vi.stubGlobal("Element", Target);
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        mutation = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("matchMedia", () => media);
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    callbacks.set(++frame, callback);
    return frame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  return {
    root,
    callbacks,
    media,
    disconnect,
    mutation: () => mutation(),
    flush: () => {
      for (const [id, callback] of callbacks) {
        callbacks.delete(id);
        callback();
      }
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Associative animation synchronization", () => {
  it("aligns new selection and guidance effects with existing CTAs without restarting them", () => {
    const f = fixture();
    const loop = new CssAnimation("associative-loop-orbit");
    const hover = new CssAnimation("associative-specular-orbit");
    f.root.animations.push(loop, hover);
    const stop = synchronizeAssociativeMotion(f.root as unknown as HTMLElement);
    f.flush();
    expect(loop.startTime).toBe(100);
    expect(hover.startTime).toBe(-1);
    f.root.ownerDocument.timeline.currentTime = 870;
    const selection = new CssAnimation("associative-selection-shine");
    f.root.animations.push(selection);
    loop.startTime = 101;
    f.mutation();
    f.mutation();
    expect(f.callbacks.size).toBe(1);
    f.flush();
    expect(selection.startTime).toBe(100);
    expect(loop.startTime).toBe(101);
    stop();
  });

  it("starts each sequence at its first target and preserves its clock on late children", () => {
    const f = fixture();
    const group = new Target();
    const parent = new CssAnimation("associative-property-orbit", new Target(group));
    f.root.animations.push(parent);
    const stop = synchronizeAssociativeMotion(f.root as unknown as HTMLElement);
    f.root.ownerDocument.timeline.currentTime = 300;
    f.flush();
    const child = new CssAnimation("associative-property-orbit", new Target(group));
    const documentation = new CssAnimation(
      "associative-documentation-shine",
      new Target(new Target()),
    );
    f.root.animations.push(child, documentation);
    f.root.ownerDocument.timeline.currentTime = 850;
    f.mutation();
    f.flush();
    expect([parent.startTime, child.startTime, documentation.startTime]).toEqual([300, 300, 850]);
    stop();
  });

  it("cleans up observers, media changes, input listeners and pending frames", () => {
    const f = fixture();
    const stop = synchronizeAssociativeMotion(f.root as unknown as HTMLElement);
    expect(f.callbacks.size).toBe(1);
    stop();
    expect(f.callbacks.size).toBe(0);
    expect(f.disconnect).toHaveBeenCalledOnce();
    expect(f.media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(f.root.removeEventListener).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the document timeline is unavailable", () => {
    const f = fixture();
    const unavailable = { ...f.root, ownerDocument: { timeline: { currentTime: null } } };
    synchronizeAssociativeMotion(unavailable as unknown as HTMLElement)();
    expect(f.callbacks.size).toBe(0);
  });
});
