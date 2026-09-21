import { easing, springValue } from "./animation.js";

/*
 * Where the camera is looking, as a function of the frame.
 *
 * Films here used to hand-roll their perspective: a transform built from a
 * handful of mapRange calls, with the pixel coordinates of whatever was being
 * framed typed in by hand and retyped whenever the layout moved. A shot list
 * says the same thing in the language a director uses — look at this, at this
 * time, this close — and a shot can name an element instead of a coordinate,
 * so moving the element moves the camera with it.
 *
 * The whole thing is a pure function of the frame. Nothing integrates, so
 * frame 400 costs the same as frame 4 and gives the same answer whichever was
 * asked for first.
 */

export type StageRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type StageLayout = Readonly<Record<string, StageRect>>;

/** A point in board pixels, or the id of something the stage has placed. */
export type CameraTarget = Readonly<{ x: number; y: number }> | string;

export type CameraSettle = "spring" | "ease" | "cut";

export type CameraShot = Readonly<{
  /** The frame the camera has arrived at this shot. */
  at: number;
  look: CameraTarget;
  /**
   * How close. Omitted for a named element, the camera frames that element's
   * bounds plus `padding`; omitted for a point, the board is shown at 1:1.
   */
  zoom?: number;
  tilt?: Readonly<{ x: number; y: number }>;
  /** How the camera travelled here from the shot before it. Defaults to "spring". */
  settle?: CameraSettle;
  /** Frames to sit still after arriving, before leaving for the next shot. */
  hold?: number;
  /** Board pixels kept around a framed element. */
  padding?: number;
}>;

export type CameraView = Readonly<{
  /** The board point sitting at the centre of the viewport. */
  x: number;
  y: number;
  zoom: number;
  tiltX: number;
  tiltY: number;
}>;

export type CameraBoard = Readonly<{ width: number; height: number }>;

export type CameraIdle = Readonly<{
  /** Board pixels of drift at 1:1. A few is plenty; this is breath, not motion. */
  amplitude?: number;
  /** Cycles per second. */
  rate?: number;
  seed?: string;
}>;

const defaultPadding = 64;
const defaultZoom = 1;

/**
 * The spring's own timeline, in frames, that a move is mapped onto.
 *
 * `springValue` is a closed form over real seconds, so a move is evaluated by
 * asking the spring where it is a proportion of the way through its own settle
 * rather than the shot's. At the end of that window the spring has covered
 * 99.9% of the distance and the arrival snaps the remainder, which is under a
 * tenth of a pixel on a 1080-pixel board.
 */
const springSettleFrames = 60;
const springSettleRate = 60;

function assertShots(shots: readonly CameraShot[]): void {
  if (shots.length === 0) throw new TypeError("Camera needs at least one shot.");
  let previous = Number.NEGATIVE_INFINITY;
  for (const shot of shots) {
    if (!Number.isInteger(shot.at) || shot.at < 0) throw new TypeError("Camera shot.at must be a non-negative integer.");
    if (shot.at < previous) throw new TypeError("Camera shots must be listed in the order they happen.");
    if (shot.zoom !== undefined && (!Number.isFinite(shot.zoom) || shot.zoom <= 0)) {
      throw new TypeError("Camera shot.zoom must be a positive number.");
    }
    if (shot.hold !== undefined && (!Number.isInteger(shot.hold) || shot.hold < 0)) {
      throw new TypeError("Camera shot.hold must be a non-negative integer.");
    }
    previous = shot.at;
  }
}

/** Where a single shot puts the camera, with no travel involved. */
export function resolveShot(shot: CameraShot, layout: StageLayout, board: CameraBoard): CameraView {
  const tilt = shot.tilt ?? { x: 0, y: 0 };
  if (typeof shot.look !== "string") {
    return { x: shot.look.x, y: shot.look.y, zoom: shot.zoom ?? defaultZoom, tiltX: tilt.x, tiltY: tilt.y };
  }
  const rect = layout[shot.look];
  if (!rect) {
    throw new Error(`Camera shot looks at "${shot.look}", which the stage has not placed. Add it to the stage layout.`);
  }
  const padding = shot.padding ?? defaultPadding;
  // Fit the element plus its padding inside the board, on whichever axis is tighter.
  const fit = Math.min(
    board.width / (rect.width + padding * 2),
    board.height / (rect.height + padding * 2),
  );
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    zoom: shot.zoom ?? fit,
    tiltX: tilt.x,
    tiltY: tilt.y,
  };
}

function settleProgress(settle: CameraSettle, progress: number): number {
  if (settle === "cut") return progress >= 1 ? 1 : 0;
  if (settle === "ease") return easing.easeInOut(Math.min(1, Math.max(0, progress)));
  return springValue({
    frame: Math.min(1, Math.max(0, progress)) * springSettleFrames,
    frameRate: springSettleRate,
    clamp: true,
  });
}

function blend(from: CameraView, to: CameraView, progress: number): CameraView {
  const mix = (a: number, b: number) => a + (b - a) * progress;
  return {
    x: mix(from.x, to.x),
    y: mix(from.y, to.y),
    // Zoom is multiplicative: a move from 1x to 4x should spend as long
    // covering 1x-2x as 2x-4x, which linear interpolation does not.
    zoom: from.zoom * (to.zoom / from.zoom) ** progress,
    tiltX: mix(from.tiltX, to.tiltX),
    tiltY: mix(from.tiltY, to.tiltY),
  };
}

/** A seeded, slow wander, so a held shot is not perfectly dead. */
function idleDrift(idle: CameraIdle | undefined, frame: number, frameRate: number): { x: number; y: number } {
  if (!idle) return { x: 0, y: 0 };
  const amplitude = idle.amplitude ?? 6;
  const rate = idle.rate ?? 0.08;
  const seed = idle.seed ?? "idle";
  // Two incommensurable phases, so the drift never retraces the same path.
  const phaseX = hashPhase(`${seed}:x`);
  const phaseY = hashPhase(`${seed}:y`);
  const seconds = frame / frameRate;
  return {
    x: Math.sin(seconds * rate * Math.PI * 2 + phaseX) * amplitude,
    y: Math.sin(seconds * rate * Math.PI * 2 * 0.61803 + phaseY) * amplitude,
  };
}

function hashPhase(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return ((hash >>> 0) / 4_294_967_296) * Math.PI * 2;
}

/**
 * Keeps the viewport inside the board.
 *
 * A shot that frames something near an edge otherwise puts the board's border
 * in the middle of the picture, with nothing beyond it. Clamping the centre is
 * what a real camera operator does instead: the subject sits off-centre and
 * the frame stays full. An axis the viewport cannot fit on is centred, because
 * there is no clamp that would help.
 */
function containView(view: CameraView, board: CameraBoard, viewport: CameraBoard): CameraView {
  const halfWidth = viewport.width / (2 * view.zoom);
  const halfHeight = viewport.height / (2 * view.zoom);
  const clamp = (value: number, half: number, extent: number): number =>
    half * 2 >= extent ? extent / 2 : Math.min(extent - half, Math.max(half, value));
  return {
    ...view,
    x: clamp(view.x, halfWidth, board.width),
    y: clamp(view.y, halfHeight, board.height),
  };
}

/**
 * The camera's view at a frame.
 *
 * Before the first shot the camera is already sitting on it; after the last it
 * stays there. Between two shots it holds for the earlier shot's `hold`, then
 * travels, arriving exactly as the later shot's `at` comes up.
 */
export function cameraViewAt(options: Readonly<{
  shots: readonly CameraShot[];
  frame: number;
  frameRate: number;
  layout: StageLayout;
  board: CameraBoard;
  idle?: CameraIdle;
  /** The picture's own size, needed to know what "inside the board" means. */
  viewport?: CameraBoard;
  /** Stops the camera showing past the board's edges. */
  contain?: boolean;
}>): CameraView {
  const { shots, frame, frameRate, layout, board } = options;
  assertShots(shots);
  const first = shots[0]!;
  const view = ((): CameraView => {
    if (frame <= first.at) return resolveShot(first, layout, board);
    for (let index = 0; index < shots.length - 1; index += 1) {
      const from = shots[index]!;
      const to = shots[index + 1]!;
      if (frame >= to.at) continue;
      const moveStart = from.at + (from.hold ?? 0);
      const fromView = resolveShot(from, layout, board);
      if (frame <= moveStart || to.at <= moveStart) return fromView;
      const progress = (frame - moveStart) / (to.at - moveStart);
      return blend(fromView, resolveShot(to, layout, board), settleProgress(to.settle ?? "spring", progress));
    }
    return resolveShot(shots.at(-1)!, layout, board);
  })();
  const drift = idleDrift(options.idle, frame, frameRate);
  const drifted = { ...view, x: view.x + drift.x, y: view.y + drift.y };
  const viewport = options.viewport ?? board;
  return options.contain === true ? containView(drifted, board, viewport) : drifted;
}

export type CameraWarning = Readonly<{ shot: number; message: string }>;

/**
 * The house rule, checked: one deliberate move per shot, then hold.
 *
 * A shot list whose shots crowd each other reads as a camera that cannot
 * settle — it arrives, and is already leaving. The gap below is the point at
 * which a move stops being legible, and shots closer than it are reported
 * rather than rejected, because a deliberate whip between two beats is a real
 * thing to want.
 */
export function reviewCameraShots(
  shots: readonly CameraShot[],
  frameRate: number,
  minimumGapFrames = Math.round(frameRate * 0.4),
): CameraWarning[] {
  const warnings: CameraWarning[] = [];
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index]!;
    const next = shots[index + 1];
    if (!next) continue;
    const gap = next.at - shot.at;
    if (gap < minimumGapFrames) {
      warnings.push({
        shot: index + 1,
        message: `Shots ${String(index)} and ${String(index + 1)} are ${String(gap)} frames apart; a move needs at least ${String(minimumGapFrames)} to read. Hold the shot or drop one.`,
      });
    }
    const hold = shot.hold ?? 0;
    if (hold >= gap && gap > 0) {
      warnings.push({
        shot: index,
        message: `Shot ${String(index)} holds for ${String(hold)} of the ${String(gap)} frames before the next shot, leaving no time to travel.`,
      });
    }
  }
  return warnings;
}
