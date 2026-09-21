import { describe, expect, it } from "vitest";
import { cameraViewAt, resolveShot, reviewCameraShots, type CameraShot, type StageLayout } from "./camera.js";

const board = { width: 1920, height: 1080 };

/** A stand-in for a stage's layout: the camera never measures, it is told. */
const layout: StageLayout = {
  "cut-badge": { x: 1400, y: 200, width: 120, height: 48 },
  "export-button": { x: 800, y: 900, width: 160, height: 40 },
  wide: { x: 0, y: 400, width: 1800, height: 100 },
};

const view = (frame: number, shots: readonly CameraShot[]) =>
  cameraViewAt({ shots, frame, frameRate: 30, layout, board });

describe("resolving a single shot", () => {
  it("looks at a point exactly", () => {
    expect(resolveShot({ at: 0, look: { x: 400, y: 300 }, zoom: 2 }, layout, board))
      .toEqual({ x: 400, y: 300, zoom: 2, tiltX: 0, tiltY: 0 });
  });

  it("centres a named element from the layout", () => {
    const shot = resolveShot({ at: 0, look: "cut-badge", zoom: 1 }, layout, board);

    expect(shot.x).toBe(1460);
    expect(shot.y).toBe(224);
  });

  it("frames a named element with padding when no zoom is given", () => {
    const shot = resolveShot({ at: 0, look: "cut-badge", padding: 40 }, layout, board);

    // The badge plus padding must fit inside the board on the tighter axis.
    expect(shot.zoom).toBeCloseTo(Math.min(1920 / 200, 1080 / 128), 9);
  });

  it("fits a wide element on the axis that constrains it", () => {
    const shot = resolveShot({ at: 0, look: "wide", padding: 0 }, layout, board);

    expect(shot.zoom).toBeCloseTo(1920 / 1800, 9);
  });

  it("says which shot named something the stage has not placed", () => {
    expect(() => resolveShot({ at: 0, look: "nowhere" }, layout, board))
      .toThrow(/"nowhere"/);
  });
});

describe("camera travel", () => {
  const shots: readonly CameraShot[] = [
    { at: 0, look: { x: 960, y: 540 }, zoom: 1, hold: 30 },
    { at: 90, look: "cut-badge", zoom: 2, settle: "ease" },
  ];

  it("sits on the first shot before it and after the last", () => {
    expect(view(0, shots)).toMatchObject({ x: 960, y: 540, zoom: 1 });
    expect(view(200, shots)).toMatchObject({ x: 1460, y: 224, zoom: 2 });
  });

  it("holds still for the shot's hold before travelling", () => {
    expect(view(30, shots)).toMatchObject({ x: 960, y: 540, zoom: 1 });
  });

  it("arrives exactly on the next shot's frame", () => {
    expect(view(90, shots)).toMatchObject({ x: 1460, y: 224, zoom: 2 });
  });

  it("moves monotonically between the two, without overshooting", () => {
    const xs = Array.from({ length: 61 }, (_value, offset) => view(30 + offset, shots).x);

    for (let index = 1; index < xs.length; index += 1) expect(xs[index]!).toBeGreaterThanOrEqual(xs[index - 1]!);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1460);
  });

  it("interpolates zoom multiplicatively, so halfway is the geometric middle", () => {
    const zoomShots: readonly CameraShot[] = [
      { at: 0, look: { x: 0, y: 0 }, zoom: 1 },
      { at: 100, look: { x: 0, y: 0 }, zoom: 4, settle: "ease" },
    ];

    expect(view(50, zoomShots).zoom).toBeCloseTo(2, 6);
  });

  it("cuts rather than travels when the shot says so", () => {
    const cutShots: readonly CameraShot[] = [
      { at: 0, look: { x: 0, y: 0 }, zoom: 1 },
      { at: 60, look: { x: 500, y: 0 }, zoom: 1, settle: "cut" },
    ];

    expect(view(59, cutShots).x).toBe(0);
    expect(view(60, cutShots).x).toBe(500);
  });

  it("settles with a spring by default and is still moving partway through", () => {
    const springShots: readonly CameraShot[] = [
      { at: 0, look: { x: 0, y: 0 }, zoom: 1 },
      { at: 60, look: { x: 1000, y: 0 }, zoom: 1 },
    ];
    const middle = view(30, springShots).x;

    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1000);
  });

  it("gives the same view whichever frame was asked for first", () => {
    const forwards = [0, 20, 45, 70, 90].map((frame) => view(frame, shots));
    const backwards = [90, 70, 45, 20, 0].map((frame) => view(frame, shots)).reverse();

    expect(backwards).toEqual(forwards);
  });

  it("drifts deterministically when idling, and not at all without it", () => {
    const still = cameraViewAt({ shots, frame: 10, frameRate: 30, layout, board });
    const drifting = cameraViewAt({ shots, frame: 10, frameRate: 30, layout, board, idle: { seed: "a" } });
    const again = cameraViewAt({ shots, frame: 10, frameRate: 30, layout, board, idle: { seed: "a" } });

    expect(drifting).toEqual(again);
    expect(drifting.x).not.toBe(still.x);
  });
});

describe("keeping the picture inside the board", () => {
  const edge: readonly CameraShot[] = [{ at: 0, look: "cut-badge", zoom: 2 }];
  const viewport = { width: 1920, height: 1080 };

  it("shows past the edge when not asked to contain", () => {
    const loose = cameraViewAt({ shots: edge, frame: 0, frameRate: 30, layout, board, viewport });

    expect(loose.x).toBe(1460);
  });

  it("clamps the centre so the frame stays full", () => {
    const held = cameraViewAt({ shots: edge, frame: 0, frameRate: 30, layout, board, viewport, contain: true });

    // At 2x the viewport covers 960x540 of board, so the centre cannot pass
    // 1920 - 480 across nor 1080 - 270 down.
    expect(held.x).toBe(1920 - 480);
    expect(held.y).toBe(270);
  });

  it("centres an axis the viewport cannot fit on", () => {
    const wide = cameraViewAt({
      shots: [{ at: 0, look: { x: 200, y: 100 }, zoom: 0.5 }],
      frame: 0, frameRate: 30, layout, board, viewport, contain: true,
    });

    expect(wide.x).toBe(960);
    expect(wide.y).toBe(540);
  });
});

describe("camera shot validation", () => {
  it("needs at least one shot", () => {
    expect(() => view(0, [])).toThrow(/at least one shot/);
  });

  it("refuses shots listed out of order", () => {
    expect(() => view(0, [{ at: 60, look: { x: 0, y: 0 } }, { at: 30, look: { x: 0, y: 0 } }]))
      .toThrow(/in the order they happen/);
  });

  it.each([
    [{ at: -1, look: { x: 0, y: 0 } }, /at must be/],
    [{ at: 0, look: { x: 0, y: 0 }, zoom: 0 }, /zoom must be/],
    [{ at: 0, look: { x: 0, y: 0 }, hold: -5 }, /hold must be/],
  ])("rejects %j", (shot, message) => {
    expect(() => view(0, [shot as CameraShot])).toThrow(message);
  });
});

describe("the one-move-per-shot rule", () => {
  it("says nothing about shots given room to breathe", () => {
    expect(reviewCameraShots([
      { at: 0, look: { x: 0, y: 0 } },
      { at: 90, look: { x: 100, y: 0 } },
    ], 30)).toEqual([]);
  });

  it("warns when two shots are closer than a move can read", () => {
    const warnings = reviewCameraShots([
      { at: 0, look: { x: 0, y: 0 } },
      { at: 4, look: { x: 100, y: 0 } },
    ], 30);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("4 frames apart");
  });

  it("warns when a hold leaves no time to travel", () => {
    const warnings = reviewCameraShots([
      { at: 0, look: { x: 0, y: 0 }, hold: 90 },
      { at: 60, look: { x: 100, y: 0 } },
    ], 30);

    expect(warnings.some(({ message }) => message.includes("no time to travel"))).toBe(true);
  });
});
