import { createContext, useContext, type ReactNode } from "react";
import type { FilmDescriptor, FilmMetadata, FrameSnapshot, JsonObject, VirtualTime } from "./types.js";
import { createTempoClock, type TempoClock } from "./tempo.js";

const FrameContext = createContext<FrameSnapshot | null>(null);

export function useTimeline(): FrameSnapshot {
  const snapshot = useContext(FrameContext);
  if (!snapshot) throw new Error("useTimeline() must be called inside a ZXN Motion film.");
  return snapshot;
}

export const useFilmConfig = (): FilmMetadata => useTimeline().film;

/**
 * The film's musical grid.
 *
 * Throws when the film declares no tempo, because a cue placed on a bar of a
 * film that has no bars is a mistake worth seeing rather than a silent zero.
 */
export function useTempo(): TempoClock {
  const { film } = useTimeline();
  if (!film.tempo) {
    throw new Error("useTempo() needs a tempo on the film. Add tempo: { bpm } to defineFilm().");
  }
  return createTempoClock(film.tempo, film.frameRate);
}

/**
 * The virtual wall-clock reading for the frame being rendered.
 *
 * The sandbox rewrites `Date.now()` and `performance.now()` to this same
 * value, so a library that seeks by timestamp and a component that reads this
 * hook agree. Prefer it over the globals when the value is wanted in render:
 * it works unchanged outside the sandbox, in tests and in the editor preview.
 */
export function useVirtualTime(): VirtualTime {
  const { frame, film } = useTimeline();
  const seconds = frame / film.frameRate;
  return { frame, seconds, milliseconds: seconds * 1000 };
}

type FrameProviderProps = Readonly<{
  value: FrameSnapshot;
  children: ReactNode;
}>;

export function FrameProvider({ value, children }: FrameProviderProps) {
  return <FrameContext value={value}>{children}</FrameContext>;
}

type FilmSurfaceProps = Readonly<{
  film: FilmDescriptor;
  frame: number;
  inputProps?: JsonObject;
  className?: string;
}>;

export function FilmSurface({ film, frame, inputProps, className }: FilmSurfaceProps) {
  const safeFrame = Math.min(film.frames - 1, Math.max(0, Math.floor(frame)));
  const metadata: FilmMetadata = {
    id: film.id,
    title: film.title,
    width: film.width,
    height: film.height,
    frameRate: film.frameRate,
    frames: film.frames,
    tempo: film.tempo,
  };
  return (
    <div
      className={className}
      data-zxn-film={film.id}
      style={{ position: "relative", width: film.width, height: film.height, overflow: "hidden" }}
    >
      <FrameProvider value={{ absoluteFrame: safeFrame, frame: safeFrame, film: metadata }}>
        {film.render(inputProps)}
      </FrameProvider>
    </div>
  );
}
