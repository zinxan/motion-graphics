import { describe, expect, it } from "vitest";
import { evaluateTextAnimation, restingTextAnimation } from "./animation";

const at = (localSeconds: number, durationSeconds = 5, characters = 10) =>
  ({ localSeconds, durationSeconds, characters });

describe("text animation", () => {
  it("rests when there is no animation", () => {
    expect(evaluateTextAnimation(undefined, at(2))).toEqual(restingTextAnimation);
  });

  it("settles exactly at rest once the intro is over", () => {
    const animation = { in: { id: "rise" as const, duration: 1 } };
    const settled = evaluateTextAnimation(animation, at(2.5));
    expect(settled.opacity).toBeCloseTo(1);
    expect(settled.offsetY).toBeCloseTo(0);
    expect(settled.scale).toBeCloseTo(1);
  });

  it("starts an intro fully hidden and displaced", () => {
    const start = evaluateTextAnimation({ in: { id: "rise", duration: 1 } }, at(0));
    expect(start.opacity).toBe(0);
    expect(start.offsetY).toBeCloseTo(0.6);
  });

  it("plays the outro in reverse against the end of the clip", () => {
    const animation = { out: { id: "fade" as const, duration: 1 } };
    // Measured from the end: 5s clip, so 4.5s in is halfway through the outro.
    expect(evaluateTextAnimation(animation, at(5)).opacity).toBe(0);
    expect(evaluateTextAnimation(animation, at(4.5)).opacity).toBeLessThan(1);
    expect(evaluateTextAnimation(animation, at(2)).opacity).toBeCloseTo(1);
  });

  it("overshoots on a pop and comes back", () => {
    const animation = { in: { id: "pop" as const, duration: 1 } };
    const peak = Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => evaluateTextAnimation(animation, at(t)).scale));
    expect(peak).toBeGreaterThan(1);
    expect(evaluateTextAnimation(animation, at(1)).scale).toBeCloseTo(1);
  });

  it("types linearly and ends on the whole string", () => {
    const animation = { in: { id: "typewriter" as const, duration: 2 } };
    expect(evaluateTextAnimation(animation, at(0)).revealCharacters).toBe(0);
    expect(evaluateTextAnimation(animation, at(1)).revealCharacters).toBe(5);
    expect(evaluateTextAnimation(animation, at(2)).revealCharacters).toBe(10);
    // Past the intro it stops constraining the reveal at all.
    expect(evaluateTextAnimation(animation, at(4)).revealCharacters).toBe(10);
  });

  it("combines an intro, an outro and a loop", () => {
    const state = evaluateTextAnimation({
      in: { id: "fade", duration: 1 },
      out: { id: "fade", duration: 1 },
      loop: { id: "pulse", speed: 1, amount: 1 },
      // 0.25s puts the pulse at the peak of its sine; at 0.5s it crosses zero
      // and the assertion below would pass or fail on the phase, not the code.
    }, at(0.25));
    // Part faded in, nowhere near the outro, and the pulse is scaling.
    expect(state.opacity).toBeGreaterThan(0);
    expect(state.opacity).toBeLessThan(1);
    expect(state.scale).not.toBe(1);
  });

  it("ignores a loop turned down to nothing", () => {
    const still = evaluateTextAnimation({ loop: { id: "shake", speed: 4, amount: 0 } }, at(1));
    expect(still).toEqual(restingTextAnimation);
  });

  it("keeps a shake from repeating on a simple beat", () => {
    const shake = { loop: { id: "shake" as const, speed: 1, amount: 1 } };
    const first = evaluateTextAnimation(shake, at(1));
    const later = evaluateTextAnimation(shake, at(2));
    expect(first.offsetX).not.toBeCloseTo(later.offsetX);
  });

  it("is deterministic, so preview and export agree", () => {
    const animation = { in: { id: "spin" as const, duration: 1.5 }, loop: { id: "float" as const, speed: 2, amount: 1 } };
    expect(evaluateTextAnimation(animation, at(0.9))).toEqual(evaluateTextAnimation(animation, at(0.9)));
  });
});
