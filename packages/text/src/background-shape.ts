import type { TextBackgroundEdge, TextBackgroundShape } from "./types";

export type PlateRect = Readonly<{ left: number; top: number; width: number; height: number }>;
export type PlatePoint = Readonly<{ x: number; y: number }>;
/** A plate is one or more closed outlines; a union of them is the shape. */
export type PlateOutline = readonly (readonly PlatePoint[])[];

/*
 * Speech-balloon geometry.
 *
 * Every shape is built as a polyline around the measured text box, so a
 * bubble grows with the words instead of being a fixed sticker the text must
 * fit inside -- which is the difference between a bubble that works on any
 * title and one that only works on the words it shipped with.
 *
 * Polylines rather than canvas arcs, because a sticker's edge is not a clean
 * line: a hand-drawn balloon wobbles and a torn note is ragged, and both are
 * a matter of nudging points before they are traced. The caller owns fill and
 * stroke.
 */

const TAU = Math.PI * 2;

/** A small, fast, deterministic noise: the same seed draws the same edge every frame. */
function noise(index: number, seed: number): number {
  let h = Math.imul(index + 1, 374_761_393) ^ Math.imul(seed | 0, 668_265_263);
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

function arcPoints(cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps: number): PlatePoint[] {
  const points: PlatePoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = from + ((to - from) * step) / steps;
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
  }
  return points;
}

/** A rounded rectangle, clamped so the radius can never exceed the box. */
function roundedRect(rect: PlateRect, radius: number): PlatePoint[] {
  const r = Math.max(0, Math.min(radius, Math.min(rect.width, rect.height) / 2));
  const { left, top, width, height } = rect;
  const right = left + width;
  const bottom = top + height;
  if (r === 0) return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  const steps = Math.max(3, Math.round(r / 6));
  return [
    ...arcPoints(right - r, top + r, r, r, -Math.PI / 2, 0, steps),
    ...arcPoints(right - r, bottom - r, r, r, 0, Math.PI / 2, steps),
    ...arcPoints(left + r, bottom - r, r, r, Math.PI / 2, Math.PI, steps),
    ...arcPoints(left + r, top + r, r, r, Math.PI, Math.PI * 1.5, steps),
  ];
}

/*
 * An ellipse around the padded box. Growing both axes by root-two would
 * contain the box's corners exactly, but the corners hold padding, not ink,
 * and the result was a plate half again as wide as its title.
 */
function ellipse(rect: PlateRect): PlatePoint[] {
  return arcPoints(rect.left + rect.width / 2, rect.top + rect.height / 2, (rect.width / 2) * 1.1, (rect.height / 2) * 1.38, 0, TAU, 72).slice(0, 72);
}

/**
 * A comic starburst. The spikes are one length, taken from the shorter side,
 * on both axes; scaling each axis separately gave a wide one-line title a
 * plate half again as tall as the words.
 */
function burst(rect: PlateRect, points = 12): PlatePoint[] {
  const centreX = rect.left + rect.width / 2;
  const centreY = rect.top + rect.height / 2;
  const spike = Math.min(rect.width, rect.height) * 0.34;
  const innerX = (rect.width / 2) * 1.12 + spike * 0.1;
  const innerY = (rect.height / 2) * 1.12 + spike * 0.1;
  const result: PlatePoint[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const outward = index % 2 === 0 ? spike : 0;
    const angle = (index / (points * 2)) * TAU - Math.PI / 2;
    result.push({ x: centreX + Math.cos(angle) * (innerX + outward), y: centreY + Math.sin(angle) * (innerY + outward) });
  }
  return result;
}

/**
 * Lobes walked along the edge of a rounded body, the way a thought bubble is
 * drawn: evenly spaced around the perimeter, so a wide title gets more of
 * them and the sides bulge as much as the top does.
 */
function cloud(rect: PlateRect): PlateOutline {
  const lobe = Math.min(rect.width, rect.height) * 0.42;
  const corner = Math.min(rect.width, rect.height) * 0.4;
  const body = roundedRect(rect, corner);
  let perimeter = 0;
  for (let index = 0; index < body.length; index += 1) {
    const a = body[index]!;
    const b = body[(index + 1) % body.length]!;
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const count = Math.max(6, Math.round(perimeter / (lobe * 1.35)));
  const spacing = perimeter / count;
  const lobes: PlatePoint[][] = [];
  let travelled = 0;
  let placed = 0;
  for (let index = 0; index < body.length && placed < count; index += 1) {
    const a = body[index]!;
    const b = body[(index + 1) % body.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    while (placed * spacing <= travelled + length && placed < count) {
      const along = (placed * spacing - travelled) / Math.max(length, 1e-6);
      const size = lobe * (placed % 2 === 0 ? 1 : 0.8);
      lobes.push(arcPoints(a.x + (b.x - a.x) * along, a.y + (b.y - a.y) * along, size, size, 0, TAU, 24).slice(0, 24));
      placed += 1;
    }
    travelled += length;
  }
  return [body, ...lobes];
}

/** A ribbon with notched ends. */
function banner(rect: PlateRect): PlatePoint[] {
  const notch = Math.min(rect.height / 2, rect.width / 6);
  const { left, top, width, height } = rect;
  const right = left + width;
  const bottom = top + height;
  return [
    { x: left, y: top }, { x: right, y: top }, { x: right - notch, y: top + height / 2 },
    { x: right, y: bottom }, { x: left, y: bottom }, { x: left + notch, y: top + height / 2 },
  ];
}

/** A price tag: square on the right, pointed on the left. */
function tag(rect: PlateRect, radius: number): PlatePoint[] {
  const point = Math.min(rect.height / 2, rect.width / 5);
  const { left, top, width, height } = rect;
  const right = left + width;
  const bottom = top + height;
  const corner = Math.max(0, Math.min(radius, height / 2));
  return [
    { x: left, y: top + height / 2 }, { x: left + point, y: top },
    ...arcPoints(right - corner, top + corner, corner, corner, -Math.PI / 2, 0, 4),
    ...arcPoints(right - corner, bottom - corner, corner, corner, 0, Math.PI / 2, 4),
    { x: left + point, y: bottom },
  ];
}

/** A rounded plate with a curved tail dropping from the lower left. */
function speech(rect: PlateRect, radius: number): PlateOutline {
  const tail = Math.min(rect.height * 0.55, rect.width * 0.22);
  const baseX = rect.left + Math.max(radius, rect.width * 0.18);
  const bottom = rect.top + rect.height;
  const tailPoints: PlatePoint[] = [{ x: baseX, y: bottom - 1 }, { x: baseX + tail * 0.9, y: bottom - 1 }];
  // Two curves rather than two straight edges: the tail leans out and thins
  // to its point, the way a drawn balloon does.
  for (let step = 1; step <= 6; step += 1) {
    const t = step / 6;
    const x = (1 - t) * (1 - t) * (baseX + tail * 0.9) + 2 * (1 - t) * t * (baseX + tail * 0.35) + t * t * (baseX - tail * 0.35);
    const y = (1 - t) * (1 - t) * (bottom - 1) + 2 * (1 - t) * t * (bottom + tail * 0.45) + t * t * (bottom + tail);
    tailPoints.push({ x, y });
  }
  for (let step = 1; step < 6; step += 1) {
    const t = step / 6;
    const x = (1 - t) * (1 - t) * (baseX - tail * 0.35) + 2 * (1 - t) * t * (baseX + tail * 0.05) + t * t * baseX;
    const y = (1 - t) * (1 - t) * (bottom + tail) + 2 * (1 - t) * t * (bottom + tail * 0.45) + t * t * (bottom - 1);
    tailPoints.push({ x, y });
  }
  return [roundedRect(rect, radius), tailPoints];
}

/** A sticky note: square-cornered, with the lower-right corner curled up. */
function note(rect: PlateRect): PlatePoint[] {
  const { left, top, width, height } = rect;
  const right = left + width;
  const bottom = top + height;
  const fold = Math.min(width, height) * 0.16;
  return [
    { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom - fold },
    { x: right - fold * 0.35, y: bottom - fold * 0.2 }, { x: right - fold, y: bottom }, { x: left, y: bottom },
  ];
}

/** Subdivides every edge so a wobble or a tear has points to move. */
function subdivide(points: readonly PlatePoint[], spacing: number): PlatePoint[] {
  const result: PlatePoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(length / spacing));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

/**
 * The edge treatment. A sketched edge moves each point a little along a slow
 * noise, the way a felt pen wanders; a torn edge moves them a lot along a
 * fast one, so the paper reads as ripped rather than wobbly.
 */
export function roughenOutline(outline: PlateOutline, edge: TextBackgroundEdge, size: number, seed: number): PlateOutline {
  if (edge === "clean") return outline;
  const spacing = edge === "torn" ? size * 0.05 : size * 0.09;
  const amplitude = edge === "torn" ? size * 0.028 : size * 0.008;
  return outline.map((path, pathIndex) => {
    const dense = subdivide(path, spacing);
    const total = dense.length;
    return dense.map((point, index) => {
      const previous = dense[(index - 1 + total) % total]!;
      const next = dense[(index + 1) % total]!;
      // Push along the local normal so the outline gets rougher, not smeared.
      const tx = next.x - previous.x;
      const ty = next.y - previous.y;
      const length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length;
      const ny = tx / length;
      const key = pathIndex * 4_096 + index;
      const wobble = edge === "torn"
        ? (noise(key, seed) - 0.5) * 2 + (noise(key * 7, seed + 1) - 0.5) * 0.6
        : (noise(Math.floor(key / 3), seed) - 0.5) * 1.4 + (noise(key, seed + 2) - 0.5) * 0.4;
      return { x: point.x + nx * wobble * amplitude, y: point.y + ny * wobble * amplitude };
    });
  });
}

export function textBackgroundOutline(shape: TextBackgroundShape, rect: PlateRect, radius: number): PlateOutline {
  switch (shape) {
    case "pill": return [roundedRect(rect, Math.min(rect.width, rect.height))];
    case "ellipse": return [ellipse(rect)];
    case "burst": return [burst(rect)];
    case "cloud": return cloud(rect);
    case "banner": return [banner(rect)];
    case "tag": return [tag(rect, radius)];
    case "speech": return speech(rect, radius);
    case "note": return [note(rect)];
    case "rect": return [roundedRect(rect, radius)];
  }
}

export function traceOutline(context: CanvasRenderingContext2D, outline: PlateOutline): void {
  context.beginPath();
  for (const path of outline) {
    path.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
    });
    context.closePath();
  }
}

/** The classic entry point: the clean outline of a shape, as a path on the context. */
export function textBackgroundPath(
  context: CanvasRenderingContext2D,
  shape: TextBackgroundShape,
  rect: PlateRect,
  radius: number,
): void {
  traceOutline(context, textBackgroundOutline(shape, rect, radius));
}

/*
 * How far past the text box each shape actually paints.
 *
 * Hit-testing and the plate's own layout both need this: an ellipse or a
 * starburst reaches well beyond the rectangle it wraps, and a caller that
 * assumes the padded box is the whole plate will clip it or fail to select it.
 */
export function textBackgroundOverflow(shape: TextBackgroundShape): Readonly<{ x: number; y: number }> {
  switch (shape) {
    case "ellipse": return { x: 0.05, y: 0.19 };
    case "burst": return { x: 0.15, y: 0.45 };
    case "cloud": return { x: 0.14, y: 0.42 };
    case "speech": return { x: 0, y: 0.55 };
    default: return { x: 0, y: 0 };
  }
}
