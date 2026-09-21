import { roughenOutline, textBackgroundOutline, traceOutline, type PlateRect } from "./background-shape";
import { isBackdropDecoration, renderTextDecoration } from "./decoration";
import { alignedLineStart, measureText2D, textFont } from "./layout";
import { renderTextSurfaceRelief } from "./surface-relief";
import type { TextBounds, TextFill, TextStroke, TextStyle2D } from "./types";

function createFill(context: CanvasRenderingContext2D, fill: TextFill, width: number, height: number): string | CanvasGradient {
  if (fill.kind === "solid") return fill.color;
  const radians = fill.angle * Math.PI / 180;
  const radius = Math.hypot(width, height) / 2;
  const gradient = context.createLinearGradient(
    -Math.cos(radians) * radius,
    -Math.sin(radians) * radius,
    Math.cos(radians) * radius,
    Math.sin(radians) * radius,
  );
  fill.colors.forEach((color, index) => gradient.addColorStop(index / (fill.colors.length - 1), color));
  return gradient;
}

function drawSpacedLine(
  context: CanvasRenderingContext2D,
  value: string,
  y: number,
  width: number,
  style: TextStyle2D,
  operation: "fill" | "stroke",
): void {
  const draw = operation === "fill"
    ? (glyph: string, x: number) => context.fillText(glyph, x, y)
    : (glyph: string, x: number) => context.strokeText(glyph, x, y);
  if (style.letterSpacing === 0) {
    draw(value, alignedLineStart(style.align, width));
    return;
  }
  let x = alignedLineStart(style.align, width);
  for (const glyph of value) {
    draw(glyph, x);
    x += context.measureText(glyph).width + style.letterSpacing;
  }
}

const clearShadow = (context: CanvasRenderingContext2D): void => {
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
};

/** Left edge of the text block, in the same centred space the glyphs use. */
const blockLeft = (style: TextStyle2D, bounds: TextBounds): number =>
  style.align === "left" ? 0 : style.align === "right" ? -bounds.width : -bounds.width / 2;

/*
 * The area a decoration is spread across.
 *
 * With a plate it is the plate; without one it is the text plus a margin, so
 * flames around bare letters still have somewhere to sit rather than collapsing
 * onto the glyphs.
 */
function decorationRect(style: TextStyle2D, bounds: TextBounds): PlateRect {
  const padX = style.background?.paddingX ?? style.fontSize * 0.3;
  const padY = style.background?.paddingY ?? style.fontSize * 0.24;
  return {
    left: blockLeft(style, bounds) - padX,
    top: -bounds.height / 2 - padY,
    width: bounds.width + padX * 2,
    height: bounds.height + padY * 2,
  };
}

/** Shapes built from overlapping sub-paths, whose seams a stroke would expose. */
const unionShapes = new Set(["cloud", "speech"]);

type Plate = NonNullable<TextStyle2D["background"]>;

/** Paper grain: a seeded speckle field, clipped to the plate and faintly multiplied. */
function paintTexture(context: CanvasRenderingContext2D, rect: PlateRect, strength: number, seed: number): void {
  const cell = Math.max(2, Math.min(rect.width, rect.height) / 28);
  const columns = Math.ceil((rect.width * 1.4) / cell);
  const rows = Math.ceil((rect.height * 1.6) / cell);
  const left = rect.left - rect.width * 0.2;
  const top = rect.top - rect.height * 0.3;
  context.save();
  context.globalAlpha *= strength * 0.22;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let h = Math.imul(row * 1_103 + column * 7_919 + 1, 2_654_435_761) ^ Math.imul(seed | 0, 40_503);
      h = Math.imul(h ^ (h >>> 15), 1_664_525) >>> 0;
      const value = h / 4_294_967_296;
      if (value > 0.42) continue;
      context.fillStyle = value < 0.14 ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)";
      context.fillRect(left + column * cell + (value * 7 % 1) * cell, top + row * cell + (value * 13 % 1) * cell, cell * 0.55, cell * 0.55);
    }
  }
  context.restore();
}

/** A heart, a star or a sparkle, sized to `size` and drawn around the origin. */
function motif(context: CanvasRenderingContext2D, kind: NonNullable<Plate["decor"]>, size: number): void {
  context.beginPath();
  if (kind === "hearts") {
    const s = size / 2;
    context.moveTo(0, s * 0.9);
    context.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.7, -s * 1.3, 0, -s * 0.35);
    context.bezierCurveTo(s * 0.7, -s * 1.3, s * 1.6, -s * 0.2, 0, s * 0.9);
  } else if (kind === "stars") {
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? size / 2 : size / 5;
      const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
  } else {
    const s = size / 2;
    context.moveTo(0, -s);
    context.quadraticCurveTo(0, 0, s, 0);
    context.quadraticCurveTo(0, 0, 0, s);
    context.quadraticCurveTo(0, 0, -s, 0);
    context.quadraticCurveTo(0, 0, 0, -s);
  }
  context.closePath();
  context.fill();
}

/** Three motifs in the lower-right corner, the way a sticker is doodled on. */
function paintDecor(context: CanvasRenderingContext2D, plate: Plate, rect: PlateRect): void {
  if (!plate.decor) return;
  const size = Math.min(rect.width, rect.height) * 0.22;
  const colour = plate.decor === "hearts" ? "#ffd166" : plate.decor === "stars" ? "#ffe066" : "#ffffff";
  context.save();
  context.fillStyle = colour;
  context.globalAlpha *= 0.95;
  const baseX = rect.left + rect.width - size * 0.9;
  const baseY = rect.top + rect.height - size * 0.75;
  const offsets = [[0, 0, 1], [-size * 1.05, size * 0.12, 0.8], [-size * 1.95, -size * 0.05, 0.62]] as const;
  for (const [dx, dy, scale] of offsets) {
    context.save();
    context.translate(baseX + dx, baseY + dy);
    context.rotate(dx * 0.004);
    motif(context, plate.decor, size * scale);
    context.restore();
  }
  context.restore();
}

function paintPlate(context: CanvasRenderingContext2D, plate: Plate, rect: PlateRect): void {
  const size = Math.min(rect.width, rect.height);
  const seed = plate.seed ?? 7;
  const outline = roughenOutline(textBackgroundOutline(plate.shape, rect, plate.radius), plate.edge ?? "clean", size, seed);
  context.save();
  if (plate.tilt) {
    context.translate(rect.left + rect.width / 2, rect.top + rect.height / 2);
    context.rotate((plate.tilt * Math.PI) / 180);
    context.translate(-(rect.left + rect.width / 2), -(rect.top + rect.height / 2));
  }
  context.fillStyle = plate.gradient
    ? createFill(context, plate.gradient, rect.width, rect.height)
    : plate.color;
  if (plate.shadow) {
    context.shadowColor = plate.shadow.color;
    context.shadowBlur = plate.shadow.blur;
    context.shadowOffsetX = plate.shadow.offsetX;
    context.shadowOffsetY = plate.shadow.offsetY;
  }
  traceOutline(context, outline);
  // Lobed and tailed shapes are unions of overlapping sub-paths, so they must
  // fill by nonzero -- the default even-odd style would punch holes where the
  // pieces overlap.
  context.fill("nonzero");
  clearShadow(context);
  if (plate.texture && plate.texture > 0) {
    context.save();
    traceOutline(context, outline);
    context.clip("nonzero");
    paintTexture(context, rect, Math.min(1, plate.texture), seed);
    context.restore();
  }
  const stroke = plate.stroke;
  if (stroke && stroke.width > 0) {
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineJoin = "round";
    context.lineCap = "round";
    if (plate.outline === "dashed") context.setLineDash([stroke.width * 3, stroke.width * 2.2]);
    traceOutline(context, outline);
    context.stroke();
    // The fill goes on once more over the stroke, so only the outer edge of a
    // union keeps its line; a cloud otherwise outlines every lobe.
    if (unionShapes.has(plate.shape)) { traceOutline(context, outline); context.fill("nonzero"); }
    if (plate.outline === "double") {
      // A second, thinner line just inside: the felt-pen-over-pencil look.
      context.setLineDash([]);
      context.lineWidth = Math.max(0.5, stroke.width * 0.45);
      context.globalAlpha *= 0.85;
      const inset = roughenOutline(textBackgroundOutline(plate.shape, {
        left: rect.left + stroke.width * 1.6, top: rect.top + stroke.width * 1.6,
        width: rect.width - stroke.width * 3.2, height: rect.height - stroke.width * 3.2,
      }, Math.max(0, plate.radius - stroke.width)), plate.edge ?? "clean", size, seed + 11);
      traceOutline(context, inset);
      context.stroke();
    }
    context.setLineDash([]);
  }
  paintDecor(context, plate, rect);
  context.restore();
}

function renderBackground(context: CanvasRenderingContext2D, style: TextStyle2D, bounds: TextBounds): void {
  const background = style.background;
  if (!background || background.opacity <= 0) return;
  const rect = {
    left: blockLeft(style, bounds) - background.paddingX,
    top: -bounds.height / 2 - background.paddingY,
    width: bounds.width + background.paddingX * 2,
    height: bounds.height + background.paddingY * 2,
  };
  context.save();
  clearShadow(context);
  /*
   * A translucent plate is painted opaque on a scratch canvas and composited
   * once at its opacity. Painting fill, stroke and fill again straight onto
   * the frame at partial alpha would show the seams through the second fill
   * and darken where the passes overlap.
   */
  const layered = unionShapes.has(background.shape) || Boolean(background.texture) || background.outline === "double" || Boolean(background.decor);
  const scratch = background.opacity < 1 && layered ? scratchCanvasFor(context) : undefined;
  if (scratch) {
    scratch.setTransform(context.getTransform());
    scratch.clearRect(-1e5, -1e5, 2e5, 2e5);
    paintPlate(scratch, background, rect);
    context.globalAlpha = background.opacity;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(scratch.canvas, 0, 0);
  } else {
    context.globalAlpha = background.opacity;
    paintPlate(context, background, rect);
  }
  context.restore();
}

/** A same-sized scratch surface for the plate, or nothing where one cannot be made. */
function scratchCanvasFor(context: CanvasRenderingContext2D): CanvasRenderingContext2D | undefined {
  const { width, height } = context.canvas;
  if (!width || !height || typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d") ?? undefined;
}

/** An outline paints its gradient when it has one, otherwise its flat colour. */
const strokePaint = (
  context: CanvasRenderingContext2D,
  stroke: TextStroke,
  bounds: TextBounds,
): string | CanvasGradient =>
  stroke.gradient ? createFill(context, stroke.gradient, bounds.width, bounds.height) : stroke.color;

export type RenderText2DOptions = Readonly<{
  /*
   * Draw only the first N characters, for a typewriter. Layout still measures
   * the *whole* string, so the block keeps its final position while it types --
   * measuring the visible prefix instead would make centred text crawl sideways
   * as each letter lands.
   */
  revealCharacters?: number;
}>;

export function renderText2D(
  context: CanvasRenderingContext2D,
  text: string,
  style: TextStyle2D,
  options: RenderText2DOptions = {},
): void {
  context.save();
  context.font = textFont(style);
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.miterLimit = 2;
  const lines = text.split("\n");
  const bounds = measureText2D(context, text, style);
  const lineHeight = style.fontSize * style.lineHeight;
  const drawLines = (target: CanvasRenderingContext2D, operation: "fill" | "stroke") => {
    target.font = textFont(style);
    target.textAlign = "left";
    target.textBaseline = "middle";
    target.lineJoin = "round";
    target.miterLimit = 2;
    let budget = options.revealCharacters ?? Number.POSITIVE_INFINITY;
    lines.forEach((line, index) => {
      const y = (index - (lines.length - 1) / 2) * lineHeight;
      const width = bounds.lineWidths[index] ?? 0;
      const visible = budget >= line.length ? line : line.slice(0, Math.max(0, Math.floor(budget)));
      // The newline itself consumes a character, so a line break takes as long
      // to "type" as a letter does and the pause reads naturally.
      budget -= line.length + 1;
      if (visible) drawSpacedLine(target, visible, y, width, style, operation);
    });
  };
  if (style.surface) {
    const left = style.align === "left" ? 0 : style.align === "right" ? -bounds.width : -bounds.width / 2;
    renderTextSurfaceRelief(
      context,
      { left, top: -bounds.height / 2, width: bounds.width, height: bounds.height },
      style.surface,
      `${text}\u0000${textFont(style)}\u0000${style.letterSpacing}\u0000${style.lineHeight}`,
      (mask) => {
        mask.fillStyle = "#fff";
        mask.shadowColor = "transparent";
        mask.shadowBlur = 0;
        mask.shadowOffsetX = 0;
        mask.shadowOffsetY = 0;
        drawLines(mask, "fill");
      },
    );
    context.restore();
    return;
  }
  /*
   * Back to front: plate, glow, outer outline, inner outline, fill. Each layer
   * is drawn with only its own shadow state, because a canvas has exactly one
   * shadow and letting the drop shadow leak onto the glow passes (or the glow
   * onto the fill) is what turns a layered style into mud.
   */
  const decoration = style.decoration;
  const decorRect = decoration ? decorationRect(style, bounds) : undefined;
  // Sun rays are a backdrop and belong under the plate; snow and confetti fall
  // in front of it but still behind the words.
  if (decoration && decorRect && isBackdropDecoration(decoration.kind)) {
    context.save();
    clearShadow(context);
    renderTextDecoration(context, decoration, decorRect);
    context.restore();
  }

  renderBackground(context, style, bounds);

  if (decoration && decorRect && !isBackdropDecoration(decoration.kind)) {
    context.save();
    clearShadow(context);
    renderTextDecoration(context, decoration, decorRect);
    context.restore();
  }

  const glow = style.glow;
  if (glow && glow.blur > 0 && glow.intensity > 0) {
    context.save();
    context.fillStyle = glow.color;
    context.strokeStyle = glow.color;
    context.shadowColor = glow.color;
    context.shadowBlur = glow.blur;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    // One blurred pass is a thin halo; bloom is several composited on top of
    // each other, so intensity is a pass count.
    const passes = Math.max(1, Math.min(8, Math.round(glow.intensity)));
    const widest = Math.max(style.stroke.width, style.outerStroke?.width ?? 0);
    for (let pass = 0; pass < passes; pass += 1) {
      if (widest > 0) {
        context.lineWidth = widest;
        drawLines(context, "stroke");
      }
      drawLines(context, "fill");
    }
    context.restore();
  }

  const outer = style.outerStroke;
  if (outer && outer.width > 0) {
    context.save();
    clearShadow(context);
    context.strokeStyle = strokePaint(context, outer, bounds);
    // Widths are the visible thickness of each ring, and canvas centres a
    // stroke on the glyph edge, so the outer ring must carry the inner one's
    // width as well or it disappears underneath it.
    context.lineWidth = outer.width + style.stroke.width;
    // Pushing the ring off the glyphs is what fakes an extruded slab.
    context.translate(outer.offsetX ?? 0, outer.offsetY ?? 0);
    drawLines(context, "stroke");
    context.restore();
  }

  context.fillStyle = createFill(context, style.fill, bounds.width, bounds.height);
  context.strokeStyle = strokePaint(context, style.stroke, bounds);
  context.lineWidth = style.stroke.width;
  context.shadowColor = style.shadow.color;
  context.shadowBlur = style.shadow.blur;
  context.shadowOffsetX = style.shadow.offsetX;
  context.shadowOffsetY = style.shadow.offsetY;

  if (style.stroke.width > 0) drawLines(context, "stroke");
  // The fill must not repeat the drop shadow it already cast under the stroke.
  if (style.stroke.width > 0) clearShadow(context);
  drawLines(context, "fill");
  context.restore();
}
