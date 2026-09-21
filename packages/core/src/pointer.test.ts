import { describe, expect, it } from "vitest";
import type { StageLayout } from "./camera.js";
import {
  maximumSpeed, pointerStateAt, pressedAt, pressFrames, reviewPointerPath, ringFrames, type PointerKey,
} from "./pointer.js";

const layout: StageLayout = {
  "export-button": { x: 800, y: 900, width: 160, height: 40 },
  "record-pill": { x: 100, y: 60, width: 120, height: 32 },
};

const path: readonly PointerKey[] = [
  { at: 0, to: { x: 200, y: 200 } },
  { at: 60, to: "export-button", press: true },
  { at: 120, to: "record-pill" },
];

const at = (frame: number) => pointerStateAt({ path, frame, layout });

describe("pointer travel", () => {
  it("starts on its first key and finishes on its last", () => {
    expect(at(0)).toMatchObject({ x: 200, y: 200 });
    expect(at(200)).toMatchObject({ x: 160, y: 76 });
  });

  it("arrives exactly on a named element's centre", () => {
    expect(at(60)).toMatchObject({ x: 880, y: 920 });
  });

  it("bows away from the straight line and comes back to it", () => {
    const midpoint = { x: (200 + 880) / 2, y: (200 + 920) / 2 };
    const middle = at(30);
    const offLine = Math.hypot(middle.x - midpoint.x, middle.y - midpoint.y);

    expect(offLine).toBeGreaterThan(1);
    expect(offLine).toBeLessThan(120);
  });

  it("eases, so it is slower at the ends than in the middle", () => {
    const step = (frame: number) => Math.hypot(at(frame + 1).x - at(frame).x, at(frame + 1).y - at(frame).y);

    expect(step(30)).toBeGreaterThan(step(1));
    expect(step(30)).toBeGreaterThan(step(58));
  });

  it("gives the same position whichever frame was asked for first", () => {
    const forwards = [0, 15, 30, 60, 90].map((frame) => at(frame));
    const backwards = [90, 60, 30, 15, 0].map((frame) => at(frame)).reverse();

    expect(backwards).toEqual(forwards);
  });
});

describe("pressing", () => {
  it("holds the button down for exactly the press window", () => {
    expect(at(59).pressed).toBe(false);
    expect(at(60).pressed).toBe(true);
    expect(at(60 + pressFrames - 1).pressed).toBe(true);
    expect(at(60 + pressFrames).pressed).toBe(false);
  });

  it("squashes in and back out across the press", () => {
    expect(at(60).pressPhase).toBeCloseTo(0, 6);
    expect(at(63).pressPhase).toBeGreaterThan(0.9);
    expect(at(66).pressPhase).toBe(0);
  });

  it("leaves a ring that expands and then stops", () => {
    expect(at(59).ringPhase).toBeUndefined();
    expect(at(60).ringPhase).toBeCloseTo(0, 6);
    expect(at(60 + ringFrames - 1).ringPhase).toBeGreaterThan(0.9);
    expect(at(60 + ringFrames).ringPhase).toBeUndefined();
  });

  it("tells a component it is being pressed on exactly the same frames", () => {
    expect(pressedAt(path, 59, "export-button")).toBe(false);
    expect(pressedAt(path, 60, "export-button")).toBe(true);
    expect(pressedAt(path, 65, "export-button")).toBe(true);
    expect(pressedAt(path, 66, "export-button")).toBe(false);
    expect(pressedAt(path, 60, "record-pill")).toBe(false);
  });

  it("holds the button down through a drag", () => {
    const dragPath: readonly PointerKey[] = [
      { at: 0, to: { x: 0, y: 0 }, drag: true },
      { at: 30, to: { x: 300, y: 0 } },
    ];

    expect(pointerStateAt({ path: dragPath, frame: 10, layout }).dragging).toBe(true);
    expect(pointerStateAt({ path: dragPath, frame: 10, layout }).pressed).toBe(true);
    expect(pointerStateAt({ path: dragPath, frame: 30, layout }).dragging).toBe(false);
  });
});

describe("pointer path validation", () => {
  it("needs at least one key", () => {
    expect(() => pointerStateAt({ path: [], frame: 0, layout })).toThrow(/at least one key/);
  });

  it("refuses keys listed out of order", () => {
    expect(() => pointerStateAt({ path: [{ at: 30, to: { x: 0, y: 0 } }, { at: 10, to: { x: 0, y: 0 } }], frame: 0, layout }))
      .toThrow(/in the order they happen/);
  });

  it("says which key named something the stage has not placed", () => {
    expect(() => pointerStateAt({ path: [{ at: 0, to: "nowhere" }], frame: 0, layout })).toThrow(/"nowhere"/);
  });
});

describe("pointer speed review", () => {
  it("says nothing about travel a hand could make", () => {
    expect(reviewPointerPath(path, 30, layout)).toEqual([]);
  });

  it("warns when the cursor would have to move faster than a hand", () => {
    const rushed: readonly PointerKey[] = [
      { at: 0, to: { x: 0, y: 0 } },
      { at: 1, to: { x: 1800, y: 0 } },
    ];

    const warnings = reviewPointerPath(rushed, 30, layout);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain(String(maximumSpeed));
  });

  it("warns when two keys share a frame and the cursor would teleport", () => {
    const stacked: readonly PointerKey[] = [
      { at: 10, to: { x: 0, y: 0 } },
      { at: 10, to: { x: 900, y: 0 } },
    ];

    expect(reviewPointerPath(stacked, 30, layout)[0]?.message).toContain("teleports");
  });
});
