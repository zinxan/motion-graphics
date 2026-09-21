import { describe, expect, it } from "vitest";
import { easing, mapRange, seededRandom, springValue } from "./animation.js";

describe("mapRange", () => {
  it("maps across multiple increasing segments", () => {
    expect(mapRange(15, [0, 10, 20], [0, 100, 50])).toBe(75);
  });

  it("clamps values at both boundaries", () => {
    expect(mapRange(-5, [0, 10], [2, 4], { clamp: true })).toBe(2);
    expect(mapRange(20, [0, 10], [2, 4], { clamp: true })).toBe(4);
  });

  it("accepts deterministic easing", () => {
    expect(mapRange(5, [0, 10], [0, 1], { ease: easing.easeIn })).toBe(0.125);
  });

  it("rejects ambiguous ranges", () => {
    expect(() => mapRange(1, [0, 0], [0, 1])).toThrow("increase strictly");
  });
});

describe("springValue", () => {
  it("starts exactly at the requested value", () => {
    expect(springValue({ frame: 0, frameRate: 30, from: 4, to: 9 })).toBe(4);
  });

  it("settles near its target deterministically", () => {
    expect(springValue({ frame: 180, frameRate: 30, from: 0, to: 1 })).toBeCloseTo(1, 5);
  });
});

describe("seededRandom", () => {
  it("is stable for equal seeds and distinct for different seeds", () => {
    expect(seededRandom("shot-12")).toBe(seededRandom("shot-12"));
    expect(seededRandom("shot-12")).not.toBe(seededRandom("shot-13"));
  });
});
