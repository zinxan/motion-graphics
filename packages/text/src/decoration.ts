import type { PlateRect } from "./background-shape";

/*
 * Decorative motifs drawn around a title.
 *
 * These are what turn a recoloured caption into a seasonal one: snow, confetti,
 * flames, sun rays. They are drawn procedurally rather than shipped as images
 * for three reasons -- they scale to any title length, they recolour freely,
 * and they cost nothing to download.
 *
 * Placement is pseudo-random but *seeded*, so a given preset draws the same
 * flake in the same place on every frame, in the preview and in the export.
 * An unseeded Math.random here would make titles crawl with noise during
 * playback and render differently every time the file was exported.
 */

export type TextDecorationKind =
  | "snow"
  | "sparkle"
  | "confetti"
  | "hearts"
  | "stars"
  | "leaves"
  | "bubbles"
  | "flame"
  | "sunburst"
  | "drip";

export type TextDecoration = Readonly<{
  kind: TextDecorationKind;
  colors: readonly [string, ...string[]];
  /** Roughly how many motifs; scaled by the title's area. */
  density: number;
  seed: number;
  opacity: number;
}>;

export const textDecorationLabels: Readonly<Record<TextDecorationKind, string>> = {
  snow: "Snow",
  sparkle: "Sparkle",
  confetti: "Confetti",
  hearts: "Hearts",
  stars: "Stars",
  leaves: "Leaves",
  bubbles: "Bubbles",
  flame: "Flames",
  sunburst: "Sun rays",
  drip: "Drips",
};

export const textDecorationKinds = Object.keys(textDecorationLabels) as readonly TextDecorationKind[];

/** Deterministic 32-bit PRNG; same seed, same picture, every frame. */
function seeded(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * Motifs that belong *behind* the plate rather than scattered over it. Sun rays
 * are a backdrop; snow falls in front. The renderer draws the two groups on
 * either side of the plate, so this is what decides which.
 */
export const isBackdropDecoration = (kind: TextDecorationKind): boolean =>
  kind === "sunburst";

/*
 * How far past the decoration's box the motifs actually reach, as a fraction of
 * that box. Hit-testing needs it: a title framed by snow is visually bigger
 * than its letters, and its selection handles have to agree with what is drawn.
 */
export function textDecorationOverflow(kind: TextDecorationKind): Readonly<{ x: number; y: number }> {
  switch (kind) {
    // Rays fill the frame behind the plate rather than ringing it.
    case "sunburst": return { x: 0, y: 0 };
    case "flame": return { x: 0.04, y: 0.6 };
    case "drip": return { x: 0.04, y: 0.5 };
    default: return { x: 0.06, y: 0.32 };
  }
}

function starPath(context: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number): void {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const angle = (index / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const reach = index % 2 === 0 ? radius : radius * 0.42;
    const px = x + Math.cos(angle) * reach;
    const py = y + Math.sin(angle) * reach;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
}

function heartPath(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  context.beginPath();
  context.moveTo(x, y + size * 0.7);
  context.bezierCurveTo(x - size * 1.3, y - size * 0.4, x - size * 0.35, y - size, x, y - size * 0.35);
  context.bezierCurveTo(x + size * 0.35, y - size, x + size * 1.3, y - size * 0.4, x, y + size * 0.7);
  context.closePath();
  context.fill();
}

function leafPath(context: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number): void {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, -size);
  context.quadraticCurveTo(size * 0.85, 0, 0, size);
  context.quadraticCurveTo(-size * 0.85, 0, 0, -size);
  context.closePath();
  context.fill();
  context.restore();
}

/** A snowflake: six spokes, drawn as strokes so it stays crisp when small. */
function flakePath(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  context.beginPath();
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI;
    context.moveTo(x - Math.cos(angle) * size, y - Math.sin(angle) * size);
    context.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  }
  context.lineWidth = Math.max(1, size * 0.22);
  context.stroke();
}

/** A tongue of flame, widest at the base and curling to a point. */
function flamePath(context: CanvasRenderingContext2D, x: number, base: number, width: number, height: number, lean: number): void {
  context.beginPath();
  context.moveTo(x - width / 2, base);
  context.quadraticCurveTo(x - width * 0.55, base - height * 0.55, x + lean * width * 0.4, base - height);
  context.quadraticCurveTo(x + width * 0.55, base - height * 0.5, x + width / 2, base);
  context.closePath();
  context.fill();
}

/** A hanging drip, as on melted or gloss lettering. */
function dripPath(context: CanvasRenderingContext2D, x: number, top: number, width: number, length: number): void {
  context.beginPath();
  context.moveTo(x - width / 2, top);
  context.lineTo(x + width / 2, top);
  context.lineTo(x + width / 2, top + length - width / 2);
  context.arc(x, top + length - width / 2, width / 2, 0, Math.PI);
  context.closePath();
  context.fill();
}

export function renderTextDecoration(
  context: CanvasRenderingContext2D,
  decoration: TextDecoration,
  rect: PlateRect,
): void {
  if (decoration.opacity <= 0 || decoration.density <= 0) return;
  const random = seeded(decoration.seed);
  const pick = (): string => decoration.colors[Math.floor(random() * decoration.colors.length)] ?? decoration.colors[0];
  const unit = Math.min(rect.width, rect.height);
  // Count scales with the title's width so a long sentence is not left bare at
  // one end while a short word is buried.
  const count = Math.max(3, Math.round(decoration.density * (rect.width / Math.max(1, unit)) * 4));

  context.save();
  context.globalAlpha = decoration.opacity;

  if (decoration.kind === "sunburst") {
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    const reach = Math.hypot(rect.width, rect.height);
    const rays = Math.max(6, Math.round(decoration.density * 10));
    for (let index = 0; index < rays; index += 1) {
      const angle = (index / rays) * Math.PI * 2;
      const spread = (Math.PI / rays) * 0.62;
      context.fillStyle = pick();
      context.beginPath();
      context.moveTo(centreX, centreY);
      context.lineTo(centreX + Math.cos(angle - spread) * reach, centreY + Math.sin(angle - spread) * reach);
      context.lineTo(centreX + Math.cos(angle + spread) * reach, centreY + Math.sin(angle + spread) * reach);
      context.closePath();
      context.fill();
    }
    context.restore();
    return;
  }

  if (decoration.kind === "flame") {
    /*
     * Flames rise from *behind* the letters, not from a row above them.
     *
     * Basing them on the top edge left a detached band of fire floating over
     * the title. Rooting them near the middle of the text and drawing them
     * under the glyphs -- which is where the decoration pass already sits --
     * makes the letters look like they are burning rather than parked beneath a
     * bonfire.
     */
    const tongues = Math.max(5, Math.round(rect.width / (unit * 0.26)));
    const base = rect.top + rect.height * 0.62;
    for (let index = 0; index < tongues; index += 1) {
      const x = rect.left + ((index + 0.5) / tongues) * rect.width;
      const height = rect.height * (0.75 + random() * 0.85) * decoration.density;
      context.fillStyle = pick();
      flamePath(context, x, base, unit * (0.26 + random() * 0.2), height, random() * 2 - 1);
    }
    context.restore();
    return;
  }

  if (decoration.kind === "drip") {
    const drips = Math.max(3, Math.round(rect.width / (unit * 0.5)));
    for (let index = 0; index < drips; index += 1) {
      const x = rect.left + ((index + 0.5) / drips) * rect.width + (random() - 0.5) * unit * 0.2;
      context.fillStyle = pick();
      dripPath(context, x, rect.top + rect.height - unit * 0.1, unit * (0.09 + random() * 0.08), unit * (0.2 + random() * 0.5) * decoration.density);
    }
    context.restore();
    return;
  }

  for (let index = 0; index < count; index += 1) {
    const x = rect.left - rect.width * 0.04 + random() * rect.width * 1.08;
    /*
     * Motifs frame the title instead of covering it.
     *
     * Scattering freely across the whole box buries the words -- which is the
     * one thing a title must not do. Anything that lands in the middle band is
     * pushed out to the nearer edge, so the decoration reads as a border around
     * the text rather than as confetti thrown over it.
     */
    const spread = rect.top - rect.height * 0.28 + random() * rect.height * 1.56;
    const centre = rect.top + rect.height / 2;
    const keepClear = rect.height * 0.3;
    const y = Math.abs(spread - centre) < keepClear
      ? centre + Math.sign(spread - centre || 1) * (keepClear + random() * rect.height * 0.28)
      : spread;
    // Sized off the shorter axis so a long title does not grow huge motifs.
    const size = unit * (0.045 + random() * 0.075);
    const colour = pick();
    context.fillStyle = colour;
    context.strokeStyle = colour;
    switch (decoration.kind) {
      case "snow": flakePath(context, x, y, size); break;
      case "sparkle": starPath(context, x, y, size * 1.2, 4); break;
      case "stars": starPath(context, x, y, size, 5); break;
      case "hearts": heartPath(context, x, y, size); break;
      case "leaves": leafPath(context, x, y, size, random() * Math.PI * 2); break;
      case "bubbles":
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.globalAlpha = decoration.opacity * (0.35 + random() * 0.5);
        context.fill();
        context.globalAlpha = decoration.opacity;
        break;
      case "confetti":
        context.save();
        context.translate(x, y);
        context.rotate(random() * Math.PI);
        context.fillRect(-size * 0.7, -size * 0.28, size * 1.4, size * 0.56);
        context.restore();
        break;
    }
  }
  context.restore();
}
