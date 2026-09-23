---
title: Thinking in frames
summary: Why a film must be a pure function of its frame, the hooks and primitives that make that practical, and how to make the motion read well.
---
# Thinking in frames

Most animation you have written before was told to *start*. You attached a CSS transition, called `play()` on a timeline, or ran a `requestAnimationFrame` loop that nudged a value a little each tick. Time moved forwards on its own and the picture followed.

A film works the other way round. Nothing starts, nothing plays and nothing ticks. A host picks a frame number, mounts the tree, takes the picture, and throws the tree away. Frame 47 is a question — *what does this look like at frame 47?* — and the film's only job is to answer it.

## Frames arrive in any order

This is not a stylistic preference. Three things ask for frames, and only one of them asks in order:

- the player, when someone drags the scrubber — backwards, in jumps, landing anywhere;
- the preview, which may re-mount from scratch at whatever frame the playhead is on;
- the export, which walks 0, 1, 2, … but re-mounts at each one.

A value that accumulates is only correct if every earlier frame ran first. Scrub past it and it is wrong; export it and it disagrees with what you approved in the preview. So the rule is the whole design:

> **Every frame is computed from the frame number and the props, and from nothing else.**

Get that right and preview, scrub and export are the same picture by construction, not by testing.

## What that forbids

Here is a film that does everything wrong. It type-checks, it even looks fine if you press play from the beginning, and it will not survive a scrub.

```tsx film expect-warnings
import { useEffect, useState } from "react";
import { FullFrame, defineFilm } from "@matildeene/motion-core";

type Props = { readonly label: string; readonly accent: string };

function Drifting({ label, accent }: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 16);
    return () => clearInterval(timer);
  }, []);

  return (
    <FullFrame style={{ background: "#0b0c0e", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ fontSize: 140, color: accent, opacity: Math.min(1, elapsed / 1000) }}>{label}</h1>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "drifting",
  title: "Drifting",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 90,
  component: Drifting,
  defaultProps: { label: "Wrong", accent: "#ff6f61" },
  controls: { label: { type: "text", label: "Label" }, accent: { type: "color", label: "Accent" } },
})];
```

The checker flags all three habits in it, and the list of things it flags is a good summary of what a film may not do:

| Don't | Do instead |
| --- | --- |
| `Date.now()`, `new Date()`, `performance.now()` | `useTimeline().frame`, or `useVirtualTime().seconds` |
| `setInterval`, `requestAnimationFrame` | Compute the whole picture from the frame |
| `useState`, `useReducer` to carry values between frames | Derive the value; there is nothing to carry |
| `Math.random()` | `seededRandom(seed)` |
| An unseeded noise generator | `createNoise3D(() => seededRandom("field"))` |
| CSS `transition`, `animation`, `@keyframes` | Interpolate the value yourself and set it inline |
| `timeline.play()`, `lottie.play()` | Build it paused and seek it every frame |

The last one is the general case. A library is usable inside a film if it can be seeked and useless if it can only play. GSAP qualifies, and the pattern is two lines:

```tsx excerpt=examples/recipes/gsap-title.tsx
  // After the build effect on the first frame, and on every frame after it.
  useLayoutEffect(() => { timeline.current?.seek(seconds, false); });
```

Lottie qualifies through `goToAndStop(frame, true)`, a video element through `currentTime`, the Web Animations API through its own `currentTime`. A library whose only entry point is "go" does not.

React state is not banned because state is bad; it is banned because a film has nowhere to put it. The component is mounted fresh for a frame it may never see again. `useLayoutEffect` is fine and often necessary — `Canvas2D` and the GSAP recipe both use it — because it runs after the commit and before the host captures, which means it still belongs to the frame that was asked for.

## The time hooks

`useTimeline()` is the one you will use most. It returns `{ frame, absoluteFrame, film }`. `frame` is local to the nearest enclosing `<Cue>`; `absoluteFrame` is always the film's own. `film` carries `width`, `height`, `frameRate`, `frames` and the `tempo` if there is one.

`useFilmConfig()` returns just the `film` part, for a component that needs the size or the frame rate but not the time.

`useVirtualTime()` returns `{ frame, seconds, milliseconds }` for the frame being drawn. Use it whenever something wants time in seconds rather than frames — seeking a library, mostly. It is the honest version of `Date.now()`: it works unchanged in tests, in the editor preview and outside the render sandbox.

## Timing primitives

Four components put things in time without any component having to know where it sits.

`<FullFrame>` fills the film and is a flex container.

`<Cue start length>` shows its children for `length` frames from `start` — and, crucially, **restarts `frame` at zero inside it**. A component written to animate from frame 0 animates identically wherever you place it; you never add an offset by hand and you never subtract one back out. `layout="none"` keeps the cue in its parent's flow instead of filling the frame, and `length` is optional: leave it off and the cue runs to the end. With a tempo declared, a cue can be placed musically instead:

```tsx excerpt=examples/recipes/beat-pulse.tsx
        <Cue key={word} startBar={index} lengthBars={1}>
```

`<Hold frame>` freezes its children at one frame — useful for a still of something that animates, or for authoring a pose.

`<Repeat every>` loops its children's local time, so a cycle written once plays for as long as you leave it on screen.

## Animation maths

```ts
mapRange(frame, [0, 30], [0, 1], { clamp: true, ease: easing.easeOut });
springValue({ frame, frameRate: 30, stiffness: 170, damping: 26, clamp: true });
seededRandom("stream-7");
```

`mapRange` maps a value from one list of stops to another. The lists must be the same length, at least two long, and the input must increase strictly. Two stops is a ramp; four is an entire in-hold-out on one readable line:

```tsx excerpt=examples/recipes/lower-third.tsx
  const slide = springValue({ frame, frameRate: film.frameRate, stiffness: 150, damping: 20, clamp: true });
  const leave = mapRange(frame, [last - 16, last], [0, 1], { clamp: true, ease: easing.easeIn });
  const text = mapRange(frame, [8, 22, last - 20, last - 8], [0, 1, 1, 0], { clamp: true, ease: easing.easeOut });
```

`clamp: true` holds the end values outside the range, which is nearly always what you want; without it the line keeps extrapolating and your opacity goes to 3.

`easing` has `linear`, `easeIn`, `easeOut` and `easeInOut`, and `ease` takes any function from progress to progress, so a custom curve is one closure.

`springValue` takes `{ frame, frameRate, from, to, mass, stiffness, damping, velocity, clamp }` and returns the spring's position at that frame. It is **closed-form**: it evaluates the analytic solution for the damped oscillator at `frame / frameRate` instead of stepping a simulation. That matters for exactly one reason, and it is the reason this whole page exists — a stepped spring only knows where it is because of every step before it, so scrubbing to the middle of one shows a different picture than playing into it, and the export disagrees with the preview. A closed-form spring has no memory to be wrong about.

Low damping overshoots and settles. High damping arrives and stops. `clamp: true` cuts the overshoot off entirely, which is right for opacity and wrong for anything with weight.

`seededRandom(seed)` hashes a string or number to a stable number in [0, 1). The trick is to seed with whatever identifies the thing you are drawing, including the frame when you want it to change:

```tsx excerpt=examples/recipes/retro-tv.tsx
      const value = seededRandom(`${frame}-${x}-${y}`);
```

That is television static that flickers every frame and is nonetheless the same static every time you render frame 40.

## Making motion read well

Everything above makes a film correct. None of it makes a film good. The rest of this page is craft, and it is as mechanical as it sounds — these are the numbers that separate motion that looks designed from motion that looks like a value going up.

**Ease everything.** Nothing in the physical world starts and stops at full speed. A linear move reads as a diagram; `easing.easeOut` for arrivals, `easing.easeIn` for departures, `easeInOut` for a journey with both ends on screen. If you find yourself using `linear`, it should be for a continuous loop that must not pulse at the seam.

**Use springs when something has weight.** An ease is a curve you drew. A spring is a thing landing. Reach for `springValue` when an object arrives — a card, a panel, a title dropping in — and let it overshoot a little by keeping `damping` low relative to `stiffness`. Around `stiffness: 150, damping: 20` is a confident arrival; `damping: 11` is a bounce you will notice:

```tsx excerpt=examples/recipes/retro-tv.tsx
  // The drop: a loose spring, so it overshoots and settles like something with weight.
  const drop = springValue({ frame, frameRate: fps, stiffness: 140, damping: 11 });
```

**Hold long enough to read.** The most common fault in generated motion is text that leaves before anyone has finished it. Budget roughly **one second per three words** of on-screen hold, after the entrance has finished and before the exit begins. A six-word line needs two seconds of stillness — 60 frames at 30 fps — which is why a lower third is 150 frames and not 60. Write the hold as explicit stops rather than hoping the gap between an in and an out is long enough:

```tsx excerpt=examples/recipes/elapsed-clock.tsx
  // Hold on the start time, sweep, then hold on the end so both can be read.
  const progress = mapRange(frame, [24, film.frames - 36], [0, 1], { clamp: true, ease: easing.easeInOut });
```

**Stagger related items by 2–4 frames.** A list whose rows arrive together is one event; a list whose rows arrive 20 frames apart is a queue you are waiting in. Two to four frames at 30 fps reads as one gesture with direction in it. `<Cue>` makes this trivial, because each row animates from its own frame zero:

```tsx film
import { Cue, FullFrame, defineFilm, springValue, useTimeline } from "@matildeene/motion-core";

type Props = { readonly heading: string; readonly steps: string; readonly accent: string };

function Row({ label, accent }: { readonly label: string; readonly accent: string }) {
  const { frame, film } = useTimeline();
  const enter = springValue({ frame, frameRate: film.frameRate, stiffness: 180, damping: 18, clamp: true });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: Math.min(1, enter * 1.6), transform: `translateX(${(1 - enter) * 60}px)` }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: accent }} />
      <span style={{ fontSize: 64, fontWeight: 500, color: "#c9c5bd" }}>{label}</span>
    </div>
  );
}

function Checklist({ heading, steps, accent }: Props) {
  const { frame, film } = useTimeline();
  const titleIn = springValue({ frame, frameRate: film.frameRate, stiffness: 160, damping: 20, clamp: true });
  const rows = steps.split(",").map((step) => step.trim()).filter((step) => step.length > 0);

  return (
    <FullFrame style={{ background: "#0b0c0e", flexDirection: "column", justifyContent: "center", padding: "0 180px", gap: 40, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 104, fontWeight: 800, letterSpacing: "-0.03em", color: "#f3efe7", opacity: titleIn, transform: `translateY(${(1 - titleIn) * 40}px)` }}>{heading}</h1>
      {rows.map((row, index) => (
        <Cue key={row} start={26 + index * 3} layout="none">
          <Row label={row} accent={accent} />
        </Cue>
      ))}
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "checklist",
  title: "Checklist",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 150,
  component: Checklist,
  defaultProps: { heading: "Three steps", steps: "Record, Edit, Export", accent: "#2ec4b6" },
  controls: {
    heading: { type: "text", label: "Heading" },
    steps: { type: "text", label: "Steps (comma separated)" },
    accent: { type: "color", label: "Accent" },
  },
})];
```

<video src="media/checklist.mp4" poster="media/checklist.jpg" controls muted loop playsinline width="720"></video>

**Anticipate, overshoot, follow through.** A move is more legible if something happens just before it, just after it, and a beat late. Anticipation is a few frames of the opposite direction before the move. Overshoot comes free from a spring. Follow-through is a secondary element running the same spring a few frames behind the primary one, which is what makes two parts look attached:

```tsx excerpt=examples/recipes/retro-tv.tsx
  // The antennae follow the body a few frames late, which is what makes them look attached by springs.
  const lag = springValue({ frame: frame - 5, frameRate: fps, stiffness: 90, damping: 7 });
  const wobble = (1 - lag) * 38;
```

Note the technique: the same spring, offset by five frames. `springValue` clamps negative frames to zero internally, so the lagging element simply sits still until its turn.

**Make distance and duration agree.** A move across the whole frame should take about **0.4 to 0.8 seconds** — 12 to 24 frames at 30 fps. Faster than 12 and the eye cannot follow it; slower than 30 and the film feels like it is waiting for something. Short moves should be short: an element sliding 40 pixels into place wants 8–12 frames, not the same 20 you gave the full-screen one. Entrances that travel a long way should also fade, so the eye is not asked to track something crossing the frame at speed.

**One idea at a time.** If two things move at once, the viewer picks one and misses the other. Bring the headline in, let it settle, then bring the subtitle. Move the camera, then reveal what it is looking at. The temptation with a frame-addressable film is to choreograph everything in parallel because you can; resist it.

**Don't animate everything.** Stillness is what makes motion read. A frame where one element moves and eight are stationary directs attention; a frame where all nine move is noise. If a background is drifting, the foreground should be still, and vice versa. The same applies to properties: animating position and scale and rotation and colour and opacity on one element rarely looks like five times as much craft.

**Prefer transform and opacity.** They are the cheap ones, and the renderer pays for every frame's layout and paint. Animating width, height, margin or `filter: blur()` costs real time per frame, and a blur inside a `.map` is the single most reliable way to make a film crawl.

## Where to go next

- [Composition API](composition-api.md) — the full reference.
- [Canvas](canvas.md) — when a field of many things belongs on one `<Canvas2D>`.
- [Tempo and music](tempo-and-music.md) — placing cues on bars and beats.
- [Using packages](using-packages.md) — seeking GSAP, Lottie, d3 and simplex-noise from the frame.
- [Performance](performance.md) — what a frame costs.
- [Recipes](recipes.md) — the verified examples quoted throughout this page.
