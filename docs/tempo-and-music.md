---
title: Tempo and music
summary: Cut a film to a track: declare a tempo, place cues in bars and beats, and derive pulses and subdivisions from one musical clock.
---
# Tempo and music

A film cut to music is written in bars and beats, but everything downstream — cues, the player's scrubber, the export — counts frames. Declaring a tempo gives a film a musical clock so it can be written the way it is heard, and lets one function do every conversion.

<video src="media/beat-pulse.mp4" poster="media/beat-pulse.jpg" controls muted loop playsinline width="720"></video>

## Declaring a tempo

`tempo` sits on the film definition beside its size and frame rate.

```ts
const tempo = { bpm: 120, beatsPerBar: 4, offsetSeconds: 0 };
```

`bpm` is required and must be between 1 and 1000. `beatsPerBar` defaults to 4 and must be a positive integer. `offsetSeconds` defaults to 0 and is where bar zero sits in the film, so a track with a pickup, a count-in or a moment of silence before the downbeat still lines up. Bars and beats are both counted from zero: bar 0 beat 0 is the first downbeat.

A bad tempo throws when the film is defined, not halfway through a render.

## The clock

`useTempo()` returns the film's clock. It throws when the film declares no tempo, because a cue placed on a bar of a film that has no bars is a mistake worth seeing rather than a silent zero.

| Member | Gives |
| --- | --- |
| `tempo` | The `{ bpm, beatsPerBar?, offsetSeconds? }` the film declared. |
| `beatsPerBar` | The resolved value, 4 when the film did not say. |
| `bar(n)` | The frame bar `n` starts on. |
| `beat(n)` | The frame beat `n` starts on. Fractional beats are allowed, so `beat(0.5)` is the eighth note after the downbeat. |
| `barAt(frame)` | The fractional bar a frame falls on. Negative before `offsetSeconds`. |
| `beatAt(frame)` | The fractional beat a frame falls on. Negative before `offsetSeconds`. |
| `onBeat(frame, division?)` | Whether a beat, or a subdivision of one, lands exactly on this frame. `division` is 1 for every beat, 2 for eighths, 4 for sixteenths; it must be a positive integer. |

The same maths is exported as plain functions for code outside a component: `barFrame`, `beatFrame`, `barAtFrame`, `beatAtFrame`, `isOnBeat`, `secondsPerBeat`, `resolveMusicalTiming` and `createTempoClock`.

```ts
import { beatFrame, createTempoClock, secondsPerBeat } from "@matildeene/motion-core";

const clock = createTempoClock({ bpm: 120 }, 30);
clock.bar(2);                              // 120
clock.beat(0.5);                           // 8, the first eighth note
beatFrame({ bpm: 120 }, 30, 4);            // 60
secondsPerBeat({ bpm: 96 });               // 0.625
```

## Cues on the grid

`<Cue>` takes musical timing as well as frames: `startBar`, `startBeat`, `lengthBars` and `lengthBeats`. Bars and beats add, so `startBar={2} startBeat={1}` is the second beat of bar two.

```tsx
<Cue startBar={2} startBeat={1} lengthBeats={2}>
  <Flash />
</Cue>
```

A length given in bars or beats is measured from the resolved start rather than added as a fixed frame count, so a two-bar cue covers exactly two real bars wherever it begins. At a frame rate that does not divide a beat evenly those are not the same number of frames, and a fixed count would slide against the music as the film went on. Inside a cue `frame` restarts at zero, exactly as it does for a cue placed in frames.

Musical timing on a film with no tempo throws and says so. So does a cue whose musical length works out at under a frame.

## One conversion, one rounding

Every bar and beat in the system resolves through `beatFrame`. That is the only place a musical time becomes an integer frame, which is what makes a cut and a flash written for the same downbeat land on the same frame instead of one frame apart. Converting in each caller is how a film ends up with a title on the beat and its underline just after it — the kind of error that is invisible in a still and obvious in motion.

Each beat is computed from its own index rather than by adding a beat's worth of frames to the previous one. Accumulating rounds once per beat and the error compounds: at 29.97 fps a beat at 120 bpm is 14.985 frames, so rounding to 15 each time gains a hundredth of a frame per beat, and by bar 200 the picture is whole frames ahead of the music. Computing from the index rounds once, and the tests hold every beat over 200 bars to within half a frame at 30, 29.97 and 24 fps.

`onBeat` is true on exactly one frame per subdivision: it works out which subdivision the frame is nearest, converts that back through `beatFrame`, and compares. A flash triggered by it lasts one frame rather than flickering across two, and no beat is ever missed because the frame it wanted fell between two subdivisions. Before the tempo's offset it is always false — there is no beat minus one.

## Walking through the beat pulse recipe

[`examples/recipes/beat-pulse.tsx`](../examples/recipes/beat-pulse.tsx) is the smallest film that uses all of this: four words that cut on bars, a ring that kicks on every beat, and four dots that show where in the bar you are.

The words are four one-bar cues. Nothing in them is a frame number, so changing `bpm` moves every cut.

```tsx excerpt=examples/recipes/beat-pulse.tsx
      {words.map((word, index) => (
        <Cue key={word} startBar={index} lengthBars={1}>
          <FullFrame style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ font: "900 260px Inter, system-ui, sans-serif", color: "#fff", letterSpacing: "-0.05em", transform: `scale(${1 + 0.1 * kick})` }}>{word}</div>
          </FullFrame>
        </Cue>
      ))}
```

The kick is not `onBeat`. A one-frame boolean is right for a flash, but a pulse needs to decay over several frames, so the film asks how far it is past the most recent beat and maps that to a falling value.

```tsx excerpt=examples/recipes/beat-pulse.tsx
  // How far through the current beat we are: 0 on the beat, 1 just before the next.
  const beat = tempo.beatAt(frame);
  const sinceBeat = frame - tempo.beat(Math.floor(beat));
  const kick = mapRange(sinceBeat, [0, 7], [1, 0], { clamp: true, ease: easing.easeOut });
```

`beatAt` gives the fractional beat; flooring it names the beat that has most recently started; `beat()` turns that index back into the frame it landed on. The subtraction is therefore in real frames, and the decay is the same seven frames at any tempo. That single `kick` value drives both the expanding ring and the scale on the words, so they breathe together.

The dots are the bar position read straight off the clock:

```tsx excerpt=examples/recipes/beat-pulse.tsx
        {Array.from({ length: 4 }, (_, dot) => (
          <div key={dot} style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", opacity: Math.floor(beat) % 4 === dot ? 1 : 0.28 }} />
        ))}
```

And the tempo itself, with the film's length written in bars rather than guessed:

```tsx excerpt=examples/recipes/beat-pulse.tsx
  // Four bars of four beats at 120 bpm is eight seconds.
  frames: 30 * 8,
  tempo: { bpm: 120, beatsPerBar: 4 },
```

## A sequencer on eighth notes

`onBeat` with a `division` is how you drive something faster than the pulse. This film runs an eight-step grid and a twelve-band equaliser on eighths: the pads light in turn, the bands jump to a new seeded height on each eighth and fall away, and the whole frame lifts for a single frame on each downbeat.

```tsx film
import { FullFrame, defineFilm, easing, mapRange, seededRandom, useTempo, useTimeline } from "@matildeene/motion-core";

type Props = {
  readonly label: string;
  readonly accent: string;
  readonly background: string;
};

const steps = 8;
const bands = 12;
const barHeight = 360;

function Sequencer({ label, accent, background }: Props) {
  const { frame, film } = useTimeline();
  const tempo = useTempo();

  // Which eighth note this frame belongs to, and how far past its start it is.
  const eighth = Math.max(0, Math.floor(tempo.beatAt(frame) * 2));
  const step = eighth % steps;
  const sinceEighth = frame - tempo.beat(eighth / 2);
  const attack = mapRange(sinceEighth, [0, 8], [1, 0], { clamp: true, ease: easing.easeOut });

  // A one-frame lift on the beat, and a brighter one on the downbeat.
  const pulse = tempo.onBeat(frame) ? 1 : 0;
  const downbeat = tempo.onBeat(frame) && step === 0 ? 1 : 0;
  const out = mapRange(frame, [film.frames - 14, film.frames - 1], [1, 0], { clamp: true, ease: easing.easeIn });

  return (
    <FullFrame style={{ background, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70, opacity: out }}>
      <div style={{ position: "absolute", inset: 0, background: accent, opacity: 0.05 * pulse + 0.1 * downbeat }} />
      <div style={{ font: "800 40px Inter, system-ui, sans-serif", color: "#f3efe7", letterSpacing: "0.36em", opacity: 0.55 + 0.35 * attack }}>
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: barHeight }}>
        {Array.from({ length: bands }, (_value, band) => {
          // A new height per band per eighth, seeded so it is the same every render.
          const target = 0.2 + seededRandom(`band-${String(band)}-${String(eighth)}`) * 0.8;
          const height = barHeight * (0.12 + (target - 0.12) * attack);
          return (
            <div
              key={band}
              style={{ width: 56, height, borderRadius: 12, background: accent, opacity: 0.45 + 0.55 * (height / barHeight) }}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {Array.from({ length: steps }, (_value, pad) => {
          const live = pad === step;
          return (
            <div
              key={pad}
              style={{
                width: 86,
                height: 86,
                borderRadius: 20,
                border: `3px solid ${accent}`,
                background: live ? accent : "transparent",
                opacity: live ? 0.4 + 0.6 * attack : 0.3,
                transform: `scale(${String(live ? 1 + 0.08 * attack : 1)})`,
              }}
            />
          );
        })}
      </div>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "sequencer",
  title: "Sequencer",
  width: 1920,
  height: 1080,
  frameRate: 30,
  // Eight bars of four beats at 128 bpm, rounded up to a whole second.
  frames: 450,
  tempo: { bpm: 128, beatsPerBar: 4 },
  component: Sequencer,
  defaultProps: { label: "EIGHT ON THE FLOOR", accent: "#7a6cff", background: "#0b0c0e" },
  controls: {
    label: { type: "text", label: "Label" },
    accent: { type: "color", label: "Accent" },
    background: { type: "color", label: "Background" },
  },
})];
```

<video src="media/sequencer.mp4" poster="media/sequencer.jpg" controls muted loop playsinline width="720"></video>

Three things are worth pulling out. The step index comes from `beatAt(frame) * 2` — the fractional beat scaled by the subdivision — so the grid and the clock cannot disagree. The decay comes from `frame - tempo.beat(eighth / 2)`, using a fractional beat index, because `beat()` accepts one. And the heights come from `seededRandom` keyed on both the band and the eighth, which makes them arbitrary but fixed: scrub back to frame 120 and the bars stand exactly where they did.

## Working with real music

**A film carries no picture of the sound.** Audio is out of scope here; sound belongs on the host's timeline, next to the clip the film renders to. So the film's tempo is not read from the track, it is asserted about it, and the two only agree because you made them.

Match two numbers. `bpm` is the track's tempo: take it from the file's metadata, your DAW, the store page you bought it from, or count beats over thirty seconds and double it. `offsetSeconds` is where the first downbeat of bar zero falls in the finished edit — the silence before the track starts, plus any pickup before the first downbeat. Get `bpm` slightly wrong and the film drifts out over the length of it; get `offsetSeconds` wrong and it is out by a constant, which is easier to hear and easier to fix.

Pick a frame rate at which a beat is a whole number of frames when you can. At 120 bpm a beat is half a second: 15 frames at 30 fps, 12 at 24. Then every beat lands on an exact frame and there is nothing to round.

When it does not divide — 128 bpm at 30 fps is 14.0625 frames a beat — nothing breaks. Beats land on the nearest frame, which is up to half a frame, about 17 milliseconds, from where the music puts them, and the gap between consecutive beats alternates between 14 and 15 frames. That is below the threshold at which a cut reads as late, and because every beat is computed from its own index the error never accumulates. What you should not do is round it yourself and then count in frames.

If you are working to broadcast rates, note that 29.97 fps is `30000 / 1001`, not 30. Pass the real value as the film's `frameRate` and the clock will follow it.

## Next

- [Composition API](composition-api.md) for the full reference.
- [Thinking in frames](thinking-in-frames.md) for why nothing here reads a clock.
- [Recipes](recipes.md) for the rest of the examples.
- [Interface films](interface-films.md) if the thing you are cutting to music is a product tour.
