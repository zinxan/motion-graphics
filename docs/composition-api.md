---
title: Composition API
summary: Reference for films, time, timing primitives, animation maths, stage and camera, pointer, tempo and footage.
---
# Composition API

Everything here is exported from `@zxn/motion-core` unless it says otherwise.

## A film

A film is a React component plus the facts a host needs to show it: its size, its cadence and how many frames it has. `defineFilm` checks those facts and returns the film; an entry module exports an array of them.

```tsx
import { defineFilm, FullFrame, useTimeline } from "@zxn/motion-core";

type Props = { readonly title: string; readonly color: string };

function Intro({ title, color }: Props) {
  const { frame } = useTimeline();
  return <FullFrame style={{ background: color }}><h1>{title} — {frame}</h1></FullFrame>;
}

export const films = [defineFilm({
  id: "intro",
  title: "Intro",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 150,
  defaultProps: { title: "Hello", color: "#111827" },
  controls: {
    title: { type: "text", label: "Title" },
    color: { type: "color", label: "Background" },
  },
  component: Intro,
})];
```

Props must be JSON: they are saved in project files, passed on a command line and sent between processes. `controls` describes them to a host that wants to draw an inspector (`text`, `number`, `color`, `boolean`, `choice`).

`describeFilm(film)` returns the `FilmDescriptor` the player and renderer take. `FilmSurface` mounts a film at one exact frame; hosts use it, films do not.

## Time

| Hook | Gives |
| --- | --- |
| `useTimeline()` | `{ frame, absoluteFrame, film }`. `frame` is local to the enclosing `<Cue>`; `absoluteFrame` is the film's. `film` carries `width`, `height`, `frameRate`, `frames`. |
| `useFilmConfig()` | Just the `film` part. |
| `useVirtualTime()` | `{ frame, seconds, milliseconds }` for the frame being rendered. Use it to seek time-based libraries: `timeline.seek(seconds)`, `lottie.goToAndStop(...)`. |
| `useTempo()` | The film's musical clock; see Tempo. |

A film must not read a real clock. Drive everything from the frame and it renders the same in the player, under a scrub and in an export.

## Timing primitives

- `<FullFrame>` fills the film. It is a flex container, so `alignItems` and `justifyContent` centre its content.
- `<Cue start length>` shows its children for `length` frames from `start`, and restarts `frame` at zero inside it, so a component animates the same wherever it is placed. With a tempo declared it also takes `startBar`/`startBeat` and `lengthBars`/`lengthBeats`.
- `<Hold frame>` freezes its children at one frame.
- `<Repeat every>` loops its children's local time.

## Animation maths

```ts
mapRange(frame, [0, 30], [0, 1], { clamp: true, ease: easing.easeOut });
springValue({ frame, frameRate: film.frameRate, stiffness: 170, damping: 26, clamp: true });
seededRandom("stream-7");          // the same number every time, for this seed
```

`mapRange` takes matching lists of two or more stops, so one call can describe in, hold and out. `springValue` is closed-form: it computes the spring's position at a frame rather than stepping a simulation, which is why a scrub into the middle of a spring matches a sequential render. `easing` has `linear`, `easeIn`, `easeOut` and `easeInOut`.

## Stage, camera and pointer

A film that shows an interface needs somewhere to put it and something to look at it with. `<Stage>` is a fixed-size board in its own coordinate space; everything on it is placed by one `layout` table, and that same table is what the camera frames and the cursor travels between.

```tsx
const layout = { panel: { x: 400, y: 300, width: 600, height: 400 }, "export-button": { x: 1716, y: 112, width: 92, height: 32 } };

<Stage width={1920} height={1080} layout={layout} shots={shots} contain vignette>
  <StageItem id="panel">…</StageItem>
  <StageItem id="sky" depth={0.6} />
  <Pointer path={path} />
</Stage>
```

**Nothing measures the DOM.** Layout is not available before a film's first paint, so a camera that measured would frame the wrong thing on frame zero of every export. Declaring a rect once is what makes "the camera looks at it, the cursor lands on it, and it reacts" a single fact rather than three kept in step by hand.

`<Camera shots>` takes a shot list: `{ at, look, zoom, tilt?, settle?, hold?, padding? }`. `look` is a board point or the id of something the stage has placed; a named element is framed from its bounds plus `padding`, so nobody types pixel coordinates. `settle` is `"spring"` (the default), `"ease"` or `"cut"`; zoom interpolates multiplicatively, so a 1×→4× move spends as long crossing 1–2 as 2–4. `contain` stops a shot showing past the board's edge. `idle` adds a seeded drift so a held shot is not perfectly dead.

**One deliberate move per shot, then hold.** A camera that arrives and is already leaving reads as nervous. `reviewCameraShots()` checks for it. It is a warning, not an error: a deliberate whip between two beats is a real thing to want.

Parallax is the `depth` prop on `<StageItem>`: 0 moves with the board, 1 is far enough away that the camera's travel does not move it at all. `useCamera()` returns the current view for anything that wants to react to it.

`<Pointer path>` draws a cursor in board space, so the camera carries it. Keys are `{ at, to, press?, drag? }`, `to` being a point or an element id. Travel is eased and bowed slightly off the straight line, because a cursor that slides at constant speed reads as a diagram. `reviewPointerPath()` warns about travel too fast to read as a hand.

`usePointer(path).pressedOn("export-button")` is true on exactly the frames the cursor is pressing it, so a component draws its own pressed state from the same path that moves the cursor. Nothing has to be aligned by hand.

## Tempo

A film may declare `tempo: { bpm, beatsPerBar = 4, offsetSeconds = 0 }`. `useTempo()` then gives `bar(n)`, `beat(n)`, `barAt(frame)`, `beatAt(frame)` and `onBeat(frame, division?)`.

Every conversion goes through one function, so a scene change and a flash on the same downbeat land on the same frame rather than one frame apart. Each beat is computed from its own index rather than by adding a beat's worth of frames to the last one: accumulating rounds once per beat and the error compounds, and by bar 200 of a 29.97fps film it is whole frames out. `onBeat` is true on exactly one frame per subdivision, so a flash lasts a frame instead of flickering across two.

## Footage

`<Footage asset="ASSET_ID" from? speed? duration? fit? muted />` shows a video inside the film, so it can sit in a tilted card, be masked, or have type laid over it.

It is a canvas, not a `<video>`: a video element seeks on its own schedule and "close enough" is not a frame. `<Footage>` declares which asset and which instant it wants, and the host fills every such canvas from a **frame provider** installed as `globalThis.zxnFootage`, waiting for all of them before it captures. A missing provider, or a frame the provider cannot supply, fails visibly and names the asset.

The command-line renderer installs a file-backed provider: `zxn-motion render … --footage <id>=<file>`. Other hosts supply their own. `from` and `speed` map the film's frame onto the source, and the last frame is held rather than run past. Audio is out of scope: a film is a picture.

## Keeping a film fast

The renderer rasterises the DOM once per frame, so a film costs what its DOM costs to lay out and paint.

- Prefer a few large elements to thousands of small ones. A particle field or character rain built from one element per particle is slow at any resolution; draw it on a single `<canvas>` from the frame number instead.
- Blur is the expensive paint: `filter: blur()`, `backdrop-filter` and large `text-shadow`/`box-shadow` radii, multiplied by every element that has one.
- Author at 1920×1080 unless you need more. A host can scale a film; four times the pixels is four times the paint.
- Compute from the frame; do not accumulate state across frames. Frames may be requested in any order.
