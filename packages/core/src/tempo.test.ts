import { describe, expect, it } from "vitest";
import {
  assertTempo,
  barFrame,
  beatAtFrame,
  beatFrame,
  createTempoClock,
  isOnBeat,
  resolveMusicalTiming,
  secondsPerBeat,
} from "./tempo.js";

const tempo = { bpm: 120 } as const;

describe("tempo frame maths", () => {
  it("places beats at their own time rather than by accumulating", () => {
    expect(beatFrame(tempo, 30, 0)).toBe(0);
    expect(beatFrame(tempo, 30, 1)).toBe(15);
    expect(beatFrame(tempo, 30, 4)).toBe(60);
  });

  it("counts bars in beats per bar", () => {
    expect(barFrame(tempo, 30, 1)).toBe(beatFrame(tempo, 30, 4));
    expect(barFrame({ bpm: 120, beatsPerBar: 3 }, 30, 1)).toBe(beatFrame(tempo, 30, 3));
  });

  it("shifts the whole grid by the tempo's offset", () => {
    expect(beatFrame({ bpm: 120, offsetSeconds: 0.5 }, 30, 0)).toBe(15);
    expect(beatFrame({ bpm: 120, offsetSeconds: 0.5 }, 30, 1)).toBe(30);
  });

  it("resolves fractional beats, so an eighth note has a frame", () => {
    expect(beatFrame(tempo, 30, 0.5)).toBe(8);
  });

  /*
   * The requirement that made the maths what it is: adding a beat's frames to
   * the previous beat rounds once per beat, and by bar 200 the error is whole
   * frames. Computing each beat from its index keeps every one within half a
   * frame of the music, at a frame rate that does not divide evenly.
   */
  it.each([
    ["30fps", 30],
    ["29.97fps", 30000 / 1001],
    ["24fps", 24],
  ])("does not drift over 200 bars at %s", (_name, frameRate) => {
    const bars = 200;
    const beats = bars * 4;
    let worst = 0;
    for (let beat = 0; beat <= beats; beat += 1) {
      const exact = beat * secondsPerBeat(tempo);
      const landed = beatFrame(tempo, frameRate, beat) / frameRate;
      worst = Math.max(worst, Math.abs(landed - exact));
    }

    expect(worst).toBeLessThanOrEqual(0.5 / frameRate + 1e-9);
  });

  it("reads a frame back as the beat it falls on", () => {
    expect(beatAtFrame(tempo, 30, 15)).toBeCloseTo(1, 9);
    expect(beatAtFrame(tempo, 30, 22)).toBeCloseTo(1.466, 2);
  });

  it("is on a beat for exactly one frame", () => {
    const onBeat = Array.from({ length: 60 }, (_value, frame) => isOnBeat(tempo, 30, frame));

    expect(onBeat.filter(Boolean)).toHaveLength(4);
    expect(onBeat[0]).toBe(true);
    expect(onBeat[15]).toBe(true);
    expect(onBeat[14]).toBe(false);
    expect(onBeat[16]).toBe(false);
  });

  it("subdivides a beat on request", () => {
    const eighths = Array.from({ length: 30 }, (_value, frame) => isOnBeat(tempo, 30, frame, 2));

    expect(eighths.filter(Boolean)).toHaveLength(4);
    expect(eighths[8]).toBe(true);
  });

  it("is never on a beat before the tempo's offset", () => {
    expect(isOnBeat({ bpm: 120, offsetSeconds: 1 }, 30, 0)).toBe(false);
    expect(isOnBeat({ bpm: 120, offsetSeconds: 1 }, 30, 30)).toBe(true);
  });

  it("rejects a subdivision that is not a positive integer", () => {
    expect(() => isOnBeat(tempo, 30, 0, 0)).toThrow(/positive integer/);
    expect(() => isOnBeat(tempo, 30, 0, 1.5)).toThrow(/positive integer/);
  });
});

describe("tempo validation", () => {
  it.each([
    [{ bpm: 0 }, /bpm/],
    [{ bpm: 5000 }, /bpm/],
    [{ bpm: Number.NaN }, /bpm/],
    [{ bpm: 120, beatsPerBar: 0 }, /beatsPerBar/],
    [{ bpm: 120, beatsPerBar: 2.5 }, /beatsPerBar/],
    [{ bpm: 120, offsetSeconds: Number.POSITIVE_INFINITY }, /offsetSeconds/],
  ])("rejects %j", (value, message) => {
    expect(() => { assertTempo(value); }).toThrow(message);
  });
});

describe("tempo clock", () => {
  it("answers in bars and beats from the frame rate it was made with", () => {
    const clock = createTempoClock({ bpm: 120 }, 30);

    expect(clock.beatsPerBar).toBe(4);
    expect(clock.bar(2)).toBe(120);
    expect(clock.beat(2)).toBe(30);
    expect(clock.barAt(120)).toBeCloseTo(2, 9);
    expect(clock.beatAt(30)).toBeCloseTo(2, 9);
    expect(clock.onBeat(30)).toBe(true);
  });
});

describe("musical cue timing", () => {
  it("is absent when a cue was given only frames", () => {
    expect(resolveMusicalTiming({}, tempo, 30)).toBeUndefined();
  });

  it("adds a beat offset to its bar", () => {
    expect(resolveMusicalTiming({ startBar: 2, startBeat: 1 }, tempo, 30))
      .toEqual({ start: beatFrame(tempo, 30, 9) });
  });

  it("measures a length from the resolved start, not as a fixed frame count", () => {
    const first = resolveMusicalTiming({ startBar: 0, lengthBars: 2 }, { bpm: 97 }, 30000 / 1001);
    const later = resolveMusicalTiming({ startBar: 51, lengthBars: 2 }, { bpm: 97 }, 30000 / 1001);

    expect(first?.length).toBeDefined();
    expect(later?.length).toBeDefined();
    // Rounding may differ by a frame; the cue still spans two real bars.
    expect(Math.abs((later?.length ?? 0) - (first?.length ?? 0))).toBeLessThanOrEqual(1);
  });

  it("refuses musical timing on a film with no tempo", () => {
    expect(() => resolveMusicalTiming({ startBar: 1 }, undefined, 30)).toThrow(/tempo/);
  });

  it("refuses a length that would not cover a frame", () => {
    expect(() => resolveMusicalTiming({ startBar: 0, lengthBeats: 0 }, tempo, 30)).toThrow(/at least one frame/);
  });
});
