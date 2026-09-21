import type { CSSProperties, ReactNode } from "react";
import { FrameProvider, useTimeline } from "./frame-context.js";
import { resolveMusicalTiming, type MusicalTiming } from "./tempo.js";

function assertFrame(value: number, field: string, allowZero: boolean): void {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(`${field} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
}

type FullFrameProps = Readonly<{
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export function FullFrame({ children, className, style }: FullFrameProps) {
  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, display: "flex", ...style }}
    >
      {children}
    </div>
  );
}

type CueProps = MusicalTiming & Readonly<{
  /** When the cue begins, in frames. Omit it to place the cue with `startBar` or `startBeat`. */
  start?: number;
  length?: number;
  children: ReactNode;
  layout?: "fill" | "none";
  className?: string;
  style?: CSSProperties;
}>;

/**
 * A cue placed in frames, or on the film's musical grid.
 *
 * `startBar`/`startBeat` and `lengthBars`/`lengthBeats` are resolved to whole
 * frames through the film's tempo, using the same conversion the rest of the
 * system uses, so a cue on bar four and a flash on bar four land together.
 */
export function Cue(props: CueProps) {
  const { children, layout = "fill", className, style } = props;
  const parent = useTimeline();
  const musical = resolveMusicalTiming(props, parent.film.tempo, parent.film.frameRate);
  if (musical === undefined && props.start === undefined) {
    throw new TypeError("Cue needs start, startBar or startBeat.");
  }
  const start = musical?.start ?? props.start ?? 0;
  const length = musical?.length ?? props.length;
  assertFrame(start, "Cue.start", true);
  if (length !== undefined) assertFrame(length, "Cue.length", false);
  const localFrame = parent.frame - start;
  const active = localFrame >= 0 && (length === undefined || localFrame < length);
  if (!active) return null;
  const content = (
    <FrameProvider value={{ ...parent, frame: localFrame }}>
      {children}
    </FrameProvider>
  );
  return layout === "fill" ? <FullFrame className={className} style={style}>{content}</FullFrame> : content;
}

type RepeatProps = Readonly<{ every: number; children: ReactNode }>;

export function Repeat({ every, children }: RepeatProps) {
  const parent = useTimeline();
  assertFrame(every, "Repeat.every", false);
  return (
    <FrameProvider value={{ ...parent, frame: parent.frame % every }}>
      {children}
    </FrameProvider>
  );
}

type HoldProps = Readonly<{ frame: number; children: ReactNode }>;

export function Hold({ frame, children }: HoldProps) {
  assertFrame(frame, "Hold.frame", true);
  const parent = useTimeline();
  return <FrameProvider value={{ ...parent, frame }}>{children}</FrameProvider>;
}
