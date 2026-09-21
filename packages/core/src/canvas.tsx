import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useTimeline } from "./frame-context.js";
import type { FilmMetadata } from "./types.js";

/** What a draw function is told about the frame it is drawing. */
export type CanvasFrame = Readonly<{
  frame: number;
  absoluteFrame: number;
  /** `frame / frameRate`, for anything that thinks in seconds. */
  seconds: number;
  film: FilmMetadata;
  /** The size of the drawing surface, in the units `draw` draws in. */
  width: number;
  height: number;
}>;

export type CanvasDraw = (context: CanvasRenderingContext2D, frame: CanvasFrame) => void;

type Canvas2DProps = Readonly<{
  /**
   * Draws one frame. It must draw the whole picture from `frame` alone: frames
   * are asked for in any order, so nothing may be carried over from the last
   * call. The surface is cleared and the context reset before every call.
   */
  draw: CanvasDraw;
  /** Drawing units across and down. Default to the film's own size. */
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}>;

/**
 * Clears `context` and draws one frame on it. Exported so a draw function can
 * be exercised against any 2D context, in a test or outside React.
 */
export function paintCanvasFrame(context: CanvasRenderingContext2D, draw: CanvasDraw, frame: CanvasFrame): void {
  context.save();
  try {
    // Identity first: a draw that left a transform behind must not skew the next frame.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, frame.width, frame.height);
    draw(context, frame);
  } finally {
    context.restore();
  }
}

/**
 * One element that paints itself from the frame.
 *
 * A film made of DOM costs what its DOM costs to lay out and paint, on every
 * frame. That is nothing for a title and ruinous for a thousand particles:
 * a character rain built from one element per glyph is slow at any size.
 * Anything particle-like -- rain, snow, stars, noise, a plotted curve, a field
 * of lines -- belongs here instead, as one canvas drawn in a single pass.
 *
 * The drawing happens in a layout effect, after React commits and before the
 * host captures the frame, so the pixels belong to the frame that was asked for.
 */
export function Canvas2D({ draw, width, height, className, style }: Canvas2DProps) {
  const element = useRef<HTMLCanvasElement>(null);
  const { frame, absoluteFrame, film } = useTimeline();
  const surfaceWidth = width ?? film.width;
  const surfaceHeight = height ?? film.height;

  useLayoutEffect(() => {
    const context = element.current?.getContext("2d");
    if (!context) return;
    paintCanvasFrame(context, draw, {
      frame, absoluteFrame, seconds: frame / film.frameRate, film, width: surfaceWidth, height: surfaceHeight,
    });
  });

  return (
    <canvas
      ref={element}
      width={surfaceWidth}
      height={surfaceHeight}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }}
    />
  );
}
