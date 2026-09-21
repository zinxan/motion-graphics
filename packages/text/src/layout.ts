import { textBackgroundOverflow } from "./background-shape";
import { textDecorationOverflow } from "./decoration";
import type { TextAlign, TextBounds, TextStyle2D } from "./types";

export type TextMeasurer = (value: string) => number;
export type TextMeasureContext = { font: string; measureText: (value: string) => Readonly<{ width: number }> };

export const textFont = (style: Pick<TextStyle2D, "fontStyle" | "fontWeight" | "fontSize" | "fontFamily">): string =>
  `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;

export function measureLine(value: string, letterSpacing: number, measure: TextMeasurer): number {
  if (!value) return 0;
  return measure(value) + Math.max(0, value.length - 1) * letterSpacing;
}

export function measureText2D(
  context: TextMeasureContext,
  text: string,
  style: TextStyle2D,
): TextBounds {
  context.font = textFont(style);
  const lineWidths = text.split("\n").map((line) => measureLine(line, style.letterSpacing, (value) => context.measureText(value).width));
  return {
    width: Math.max(...lineWidths, 0) + style.stroke.width * 2,
    height: Math.max(1, lineWidths.length) * style.fontSize * style.lineHeight + style.stroke.width * 2,
    lineWidths,
  };
}

export function estimateText2D(text: string, style: TextStyle2D): TextBounds {
  const lineWidths = text.split("\n").map((line) => {
    const glyphWidth = [...line].reduce((total, glyph) => total + (/\s/.test(glyph) ? 0.32 : /[MW@#]/.test(glyph) ? 0.82 : 0.58), 0);
    return glyphWidth * style.fontSize + Math.max(0, line.length - 1) * style.letterSpacing;
  });
  return {
    width: Math.max(...lineWidths, 0) + style.stroke.width * 2,
    height: Math.max(1, lineWidths.length) * style.fontSize * style.lineHeight + style.stroke.width * 2,
    lineWidths,
  };
}

/*
 * The box the style actually paints, for hit-testing and placement.
 *
 * `estimateText2D` measures the glyphs (plus the inner outline, which sits on
 * the glyph edge); the layout code needs exactly that and nothing more. But a
 * plate and an outer outline extend past the glyphs, and anything that asks
 * "did the pointer land on this title?" has to use what the viewer can see --
 * otherwise clicking the visible edge of a captioned title selects the footage
 * behind it. The glow is deliberately excluded: it is a soft halo with no edge
 * to grab, and including it would make titles feel like they have sticky
 * margins.
 */
export function paintedTextBounds2D(text: string, style: TextStyle2D): TextBounds {
  const bounds = estimateText2D(text, style);
  // An offset outer ring reaches further than a centred one.
  const outerStroke = style.outerStroke;
  const outer = outerStroke
    ? outerStroke.width * 2 + Math.abs(outerStroke.offsetX ?? 0) + Math.abs(outerStroke.offsetY ?? 0)
    : 0;
  const background = style.background;
  const plated = background !== undefined && background.opacity > 0;
  const padX = plated ? background.paddingX * 2 : 0;
  const padY = plated ? background.paddingY * 2 : 0;
  const width = bounds.width + outer + padX;
  const height = bounds.height + outer + padY;
  // Bubbles are not their padded box: an ellipse or a starburst paints well
  // past it, and a tail hangs below it.
  const shapeOverflow = plated ? textBackgroundOverflow(background.shape) : { x: 0, y: 0 };
  // A sticker reaches a little further still: its shadow, its tilt, a torn edge.
  const sticker = plated
    ? {
        x: (background.shadow ? (background.shadow.blur + Math.abs(background.shadow.offsetX)) / Math.max(width, 1) : 0)
          + (background.tilt ? Math.abs(background.tilt) * 0.006 : 0) + (background.edge === "torn" ? 0.04 : 0),
        y: (background.shadow ? (background.shadow.blur + Math.abs(background.shadow.offsetY)) / Math.max(height, 1) : 0)
          + (background.tilt ? Math.abs(background.tilt) * 0.012 : 0) + (background.edge === "torn" ? 0.06 : 0),
      }
    : { x: 0, y: 0 };
  const overflow = { x: shapeOverflow.x + sticker.x, y: shapeOverflow.y + sticker.y };
  // Decorations reach past the plate too, and by more than the plate does.
  const decor = style.decoration && style.decoration.opacity > 0
    ? textDecorationOverflow(style.decoration.kind)
    : { x: 0, y: 0 };
  return {
    ...bounds,
    width: width * (1 + Math.max(overflow.x, decor.x) * 2),
    height: height * (1 + Math.max(overflow.y, decor.y)),
  };
}

export function alignedLineStart(align: TextAlign, width: number): number {
  if (align === "center") return -width / 2;
  if (align === "right") return -width;
  return 0;
}
