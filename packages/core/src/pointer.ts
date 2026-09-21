import { easing } from "./animation.js";
import type { StageLayout } from "./camera.js";

/*
 * A cursor that behaves like a hand.
 *
 * A pointer that slides in a straight line at constant speed reads as a
 * diagram, not as someone using the product. Real travel curves slightly,
 * starts and stops gently, and never covers the screen instantly. The path
 * below is a list of where the cursor should be and when; everything between
 * those keys — the arc, the easing, the squash on press, the ring that leaves
 * the click behind — is derived from the frame, so it is the same on a scrub
 * as on an export.
 */

export type PointerTarget = Readonly<{ x: number; y: number }> | string;

export type PointerKey = Readonly<{
  /** The frame the cursor arrives. */
  at: number;
  to: PointerTarget;
  /** Presses on arrival. Whatever it is over reads as pressed for `pressFrames`. */
  press?: boolean;
  /** Holds the button down from this key until the next one, for a drag. */
  drag?: boolean;
}>;

export type PointerState = Readonly<{
  x: number;
  y: number;
  /** The button is down this frame. */
  pressed: boolean;
  /** 0 to 1 and back across a press, for the cursor's squash. */
  pressPhase: number;
  /** 0 to 1 as the click ring expands, or undefined when no ring is showing. */
  ringPhase?: number;
  dragging: boolean;
  /** The id the cursor is over, when its current key named one. */
  over?: string;
}>;

/** Frames a press holds the button down. */
export const pressFrames = 6;
/** Frames the ring left behind by a click takes to expand and fade. */
export const ringFrames = 14;
/** Board pixels per second past which travel stops looking like a hand. */
export const maximumSpeed = 4200;

function pointOf(target: PointerTarget, layout: StageLayout): { x: number; y: number; id?: string } {
  if (typeof target !== "string") return { x: target.x, y: target.y };
  const rect = layout[target];
  if (!rect) {
    throw new Error(`Pointer moves to "${target}", which the stage has not placed. Add it to the stage layout.`);
  }
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: target };
}

function assertPath(path: readonly PointerKey[]): void {
  if (path.length === 0) throw new TypeError("Pointer needs at least one key.");
  let previous = Number.NEGATIVE_INFINITY;
  for (const key of path) {
    if (!Number.isInteger(key.at) || key.at < 0) throw new TypeError("Pointer key.at must be a non-negative integer.");
    if (key.at < previous) throw new TypeError("Pointer keys must be listed in the order they happen.");
    previous = key.at;
  }
}

/**
 * How far the travel bows out from the straight line between two points.
 *
 * Proportional to the distance so a short hop stays nearly straight, capped so
 * a long sweep does not sail off the board. The direction comes from the key's
 * index rather than from chance, so the same path always curves the same way.
 */
function arcOffset(index: number, distance: number): number {
  const magnitude = Math.min(distance * 0.14, 90);
  return index % 2 === 0 ? magnitude : -magnitude;
}

/** Where the cursor is, and what it is doing, at a frame. */
export function pointerStateAt(options: Readonly<{
  path: readonly PointerKey[];
  frame: number;
  layout: StageLayout;
}>): PointerState {
  const { path, frame, layout } = options;
  assertPath(path);
  const first = path[0]!;
  const firstPoint = pointOf(first.to, layout);

  let position = firstPoint;
  let activeIndex = 0;
  if (frame > first.at) {
    activeIndex = path.length - 1;
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index]!;
      const to = path[index + 1]!;
      if (frame >= to.at) continue;
      activeIndex = index;
      const a = pointOf(from.to, layout);
      const b = pointOf(to.to, layout);
      const span = to.at - from.at;
      const progress = span <= 0 ? 1 : easing.easeInOut((frame - from.at) / span);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      // The bow peaks halfway and is zero at both ends, so the cursor still
      // arrives exactly on its target.
      const bow = Math.sin(Math.PI * progress) * arcOffset(index, distance);
      const normalX = distance === 0 ? 0 : -dy / distance;
      const normalY = distance === 0 ? 0 : dx / distance;
      position = {
        x: a.x + dx * progress + normalX * bow,
        y: a.y + dy * progress + normalY * bow,
        id: progress >= 1 ? b.id : undefined,
      };
      break;
    }
    if (frame >= path.at(-1)!.at) position = pointOf(path.at(-1)!.to, layout);
  }

  const active = path[activeIndex]!;
  const pressing = path.find((key) => key.press === true && frame >= key.at && frame < key.at + pressFrames);
  const ringing = path.find((key) => key.press === true && frame >= key.at && frame < key.at + ringFrames);
  const dragging = frame >= active.at && active.drag === true && frame < (path[activeIndex + 1]?.at ?? active.at);

  return {
    x: position.x,
    y: position.y,
    pressed: pressing !== undefined || dragging,
    pressPhase: pressing === undefined ? 0 : Math.sin(Math.PI * ((frame - pressing.at) / pressFrames)),
    ringPhase: ringing === undefined ? undefined : (frame - ringing.at) / ringFrames,
    dragging,
    over: frame >= active.at && typeof active.to === "string" ? active.to : position.id,
  };
}

/**
 * Whether a named element is being pressed at a frame.
 *
 * The point of it is synchronisation: a component can draw its own pressed
 * state from the same path that moves the cursor, so the button goes down on
 * exactly the frame the cursor lands on it, with nothing to keep in step by
 * hand.
 */
export function pressedAt(path: readonly PointerKey[], frame: number, id: string): boolean {
  return path.some((key) => key.press === true && key.to === id && frame >= key.at && frame < key.at + pressFrames);
}

export type PointerWarning = Readonly<{ key: number; message: string }>;

/** Reports travel too fast to read as a hand, and keys that land on top of each other. */
export function reviewPointerPath(
  path: readonly PointerKey[],
  frameRate: number,
  layout: StageLayout,
): PointerWarning[] {
  const warnings: PointerWarning[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index]!;
    const to = path[index + 1]!;
    const span = to.at - from.at;
    const a = pointOf(from.to, layout);
    const b = pointOf(to.to, layout);
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (span <= 0) {
      if (distance > 0) {
        warnings.push({ key: index + 1, message: `Pointer key ${String(index + 1)} is on the same frame as the one before it, so the cursor teleports.` });
      }
      continue;
    }
    const speed = distance / (span / frameRate);
    if (speed > maximumSpeed) {
      warnings.push({
        key: index + 1,
        message: `Pointer travels ${String(Math.round(speed))} board pixels a second into key ${String(index + 1)}; above ${String(maximumSpeed)} it stops reading as a hand. Give it more frames.`,
      });
    }
  }
  return warnings;
}
