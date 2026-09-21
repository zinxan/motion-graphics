import type { CSSProperties } from "react";
import { useTimeline } from "./frame-context.js";
import {
  footageAssetAttribute, footageFitAttribute, footageTimeAttribute, footageTimeAt,
  type FootageFit,
} from "./footage.js";

type FootageProps = Readonly<{
  /** The project asset to show. */
  asset: string;
  /** Seconds into the source that this film's frame zero shows. */
  from?: number;
  /** Playback rate. 2 runs it twice as fast. */
  speed?: number;
  /** The source's length, when the film knows it, so the last frame is held. */
  duration?: number;
  fit?: FootageFit;
  /** The box to fill, in film pixels. Defaults to the whole frame. */
  width?: number;
  height?: number;
  /**
   * Present for symmetry with the timeline's own clips and to say plainly what
   * this does not do: a film draws pictures, and its audio stays on a track.
   */
  muted?: true;
  className?: string;
  style?: CSSProperties;
}>;

/**
 * A project video asset, drawn inside the film.
 *
 * It is a canvas, not a <video>: the renderer fills it with the exact frame
 * the film's own frame maps to and waits for it before capturing. Because it
 * is an ordinary element, it can be rotated, masked, put in a card and
 * animated like anything else the film draws.
 */
export function Footage({
  asset, from, speed, duration, fit = "cover", width, height, muted, className, style,
}: FootageProps) {
  const { frame, film } = useTimeline();
  if (!asset) throw new TypeError("Footage needs an asset id.");
  void muted;
  const seconds = footageTimeAt({ frame, frameRate: film.frameRate, from, speed, duration });
  const boxWidth = Math.max(1, Math.round(width ?? film.width));
  const boxHeight = Math.max(1, Math.round(height ?? film.height));

  return (
    <canvas
      // The renderer finds these canvases by this attribute and reads the rest
      // off them, so a film never has to hold a decoder or a promise itself.
      {...{
        [footageAssetAttribute]: asset,
        [footageTimeAttribute]: seconds.toFixed(6),
        [footageFitAttribute]: fit,
      }}
      data-zxn-name={`Footage ${asset}`}
      width={boxWidth}
      height={boxHeight}
      className={className}
      style={{ display: "block", width: boxWidth, height: boxHeight, ...style }}
    />
  );
}
