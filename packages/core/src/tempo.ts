import type { FilmTempo } from "./types.js";

/*
 * Musical time, resolved to frames in one place.
 *
 * A film cut to music is written in bars and beats, but everything downstream —
 * cues, the timeline, the export — counts frames. Converting in each caller is
 * how a film ends up with a title landing on the beat and its underline landing
 * a frame after it, so every conversion goes through `beatFrame` below.
 *
 * Each beat is computed from its own index rather than by adding a beat's
 * worth of frames to the last one. Accumulating rounds once per beat and the
 * error compounds; computing from the index rounds once, so beat 800 of a
 * 29.97fps film is still within half a frame of where the music puts it.
 */

/** Below this a "beat" is shorter than a frame and the film cannot express it. */
const minimumBpm = 1;
const maximumBpm = 1000;

export function assertTempo(tempo: FilmTempo): void {
  if (!Number.isFinite(tempo.bpm) || tempo.bpm < minimumBpm || tempo.bpm > maximumBpm) {
    throw new TypeError("tempo.bpm must be between 1 and 1000.");
  }
  if (tempo.beatsPerBar !== undefined && (!Number.isInteger(tempo.beatsPerBar) || tempo.beatsPerBar < 1)) {
    throw new TypeError("tempo.beatsPerBar must be a positive integer.");
  }
  if (tempo.offsetSeconds !== undefined && !Number.isFinite(tempo.offsetSeconds)) {
    throw new TypeError("tempo.offsetSeconds must be a finite number.");
  }
}

export const beatsPerBarOf = (tempo: FilmTempo): number => tempo.beatsPerBar ?? 4;

const offsetOf = (tempo: FilmTempo): number => tempo.offsetSeconds ?? 0;

/** Seconds one beat lasts. */
export const secondsPerBeat = (tempo: FilmTempo): number => 60 / tempo.bpm;

/** The exact time of a beat, before it is rounded to a frame. */
export const beatSeconds = (tempo: FilmTempo, beat: number): number =>
  offsetOf(tempo) + beat * secondsPerBeat(tempo);

/**
 * The frame a beat lands on.
 *
 * The single rounding step in the whole system. Fractional beats are allowed,
 * so an eighth note is `beatFrame(tempo, rate, 0.5)`.
 */
export function beatFrame(tempo: FilmTempo, frameRate: number, beat: number): number {
  return Math.round(beatSeconds(tempo, beat) * frameRate);
}

/** The frame a bar lands on. Bars and beats are both counted from zero. */
export const barFrame = (tempo: FilmTempo, frameRate: number, bar: number): number =>
  beatFrame(tempo, frameRate, bar * beatsPerBarOf(tempo));

/** The fractional beat a frame falls on. Negative before the tempo's offset. */
export function beatAtFrame(tempo: FilmTempo, frameRate: number, frame: number): number {
  return (frame / frameRate - offsetOf(tempo)) / secondsPerBeat(tempo);
}

/** The fractional bar a frame falls on. */
export const barAtFrame = (tempo: FilmTempo, frameRate: number, frame: number): number =>
  beatAtFrame(tempo, frameRate, frame) / beatsPerBarOf(tempo);

/**
 * Whether this frame is the one a beat lands on.
 *
 * `division` subdivides the beat: 1 is every beat, 2 every eighth, 4 every
 * sixteenth. True on exactly one frame per subdivision — the frame `beatFrame`
 * would return — so a flash triggered by it lasts one frame rather than
 * flickering across two.
 */
export function isOnBeat(tempo: FilmTempo, frameRate: number, frame: number, division = 1): boolean {
  if (!Number.isInteger(division) || division < 1) throw new TypeError("division must be a positive integer.");
  const beat = beatAtFrame(tempo, frameRate, frame) * division;
  // The subdivision this frame is nearest to, then back to a frame to compare.
  const nearest = Math.round(beat);
  if (nearest < 0) return false;
  return beatFrame(tempo, frameRate, nearest / division) === frame;
}

export type TempoClock = Readonly<{
  tempo: FilmTempo;
  beatsPerBar: number;
  /** The frame bar `n` starts on. */
  bar: (n: number) => number;
  /** The frame beat `n` starts on. */
  beat: (n: number) => number;
  /** The fractional bar a frame falls on. */
  barAt: (frame: number) => number;
  /** The fractional beat a frame falls on. */
  beatAt: (frame: number) => number;
  /** Whether a beat, or a subdivision of one, lands exactly on this frame. */
  onBeat: (frame: number, division?: number) => boolean;
}>;

export function createTempoClock(tempo: FilmTempo, frameRate: number): TempoClock {
  assertTempo(tempo);
  return {
    tempo,
    beatsPerBar: beatsPerBarOf(tempo),
    bar: (n) => barFrame(tempo, frameRate, n),
    beat: (n) => beatFrame(tempo, frameRate, n),
    barAt: (frame) => barAtFrame(tempo, frameRate, frame),
    beatAt: (frame) => beatAtFrame(tempo, frameRate, frame),
    onBeat: (frame, division) => isOnBeat(tempo, frameRate, frame, division),
  };
}

export type MusicalTiming = Readonly<{
  startBar?: number;
  startBeat?: number;
  lengthBars?: number;
  lengthBeats?: number;
}>;

/**
 * Turns a cue's musical timing into the frames it actually occupies.
 *
 * Bars and beats add, so `startBar: 2, startBeat: 1` is the second beat of bar
 * two. A length given in bars or beats is measured from the resolved start, so
 * a two-bar cue is exactly two bars long wherever it begins — which is not the
 * same as adding a fixed frame count, once rounding is involved.
 */
export function resolveMusicalTiming(
  timing: MusicalTiming,
  tempo: FilmTempo | undefined,
  frameRate: number,
): { start: number; length?: number } | undefined {
  const musical = timing.startBar ?? timing.startBeat ?? timing.lengthBars ?? timing.lengthBeats;
  if (musical === undefined) return undefined;
  if (!tempo) {
    throw new TypeError("Cue timing in bars or beats needs a tempo on the film. Add tempo: { bpm } to defineFilm().");
  }
  const beats = beatsPerBarOf(tempo);
  const startBeat = (timing.startBar ?? 0) * beats + (timing.startBeat ?? 0);
  const start = beatFrame(tempo, frameRate, startBeat);
  if (timing.lengthBars === undefined && timing.lengthBeats === undefined) return { start };
  const lengthBeats = (timing.lengthBars ?? 0) * beats + (timing.lengthBeats ?? 0);
  const length = beatFrame(tempo, frameRate, startBeat + lengthBeats) - start;
  if (length <= 0) throw new TypeError("Cue length in bars or beats must cover at least one frame.");
  return { start, length };
}
