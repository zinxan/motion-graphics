---
title: Using packages
summary: Which libraries a film may import, and how to drive d3, GSAP, simplex-noise and culori from the frame instead of a clock.
---
# Using packages

A film is a pure function of an integer frame. Frames are asked for in any order: a player scrubs backwards, a preview jumps to the middle, an export walks forwards but may retry one. That single fact decides how a third-party library may be used.

**A library is seeked, never played. Anything random is seeded.**

If a library exposes a position you can set — a timeline you can `seek`, a scale you can call, a noise function you can sample at a coordinate — it fits a film perfectly. If it can only run itself forwards on the real clock, it cannot be used at all.

## What a film may import

The checker in `packages/mcp/src/check.ts` holds the list as `allowedPackages`. Anything else is an error, not a warning:

| Package | What it is for |
| --- | --- |
| `react`, `react/jsx-runtime` | The tree itself. |
| `@matildeene/motion-core` | `defineFilm`, `useTimeline`, `Cue`, `mapRange`, `Canvas2D` and the rest. |
| `@matildeene/motion-graphics` | Declarative, frame-deterministic charts and callouts. |
| `@matildeene/motion-text` | Serializable 2D text styles. |
| `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `radix-ui` | Optional interface parts for films that show a product. See [interface films](interface-films.md). |
| `@zxn/ui` | ZXN Studio's private interface package, available only to its own workspace. It is not required by the public motion packages. |
| `d3-scale`, `d3-shape`, `d3-interpolate`, `d3-ease` | Pure maths: values to pixels, points to path data, value to value, progress to progress. |
| `gsap` | Choreography, built paused and seeked. |
| `lottie-web` | A designer's animation, stepped to an exact frame. |
| `simplex-noise` | Smooth generative fields, seeded. |
| `culori` | Colour conversion and interpolation in perceptual spaces. |

Inside ZXN Studio these are bundled with the app: a film imports them and they are there. In your own project you install the public packages you use, at whatever version your lockfile says; `@zxn/ui` is private and not needed for the examples here. Check the installed types before you rely on an API; this page only uses what the verified examples use.

## d3-scale and d3-interpolate: pure functions fit a film

d3 is two different libraries wearing one name. The selection-and-transition half runs on `requestAnimationFrame` and is useless here. The maths half — scales, interpolators, shape generators — takes a number and returns a number, with no state and no clock. That is exactly what a film is.

<video src="media/bar-chart-race.mp4" poster="media/bar-chart-race.jpg" controls muted loop playsinline width="720"></video>

`examples/recipes/bar-chart-race.tsx` puts the frame in charge and lets d3 do the arithmetic. The frame picks a position between two snapshots of the data; the scales turn values into pixels.

```tsx excerpt=examples/recipes/bar-chart-race.tsx
function BarChartRace({ title, unit }: Props) {
  const { frame } = useTimeline();
  const position = Math.min(snapshots.length - 1, frame / framesPerStep);
  const index = Math.min(snapshots.length - 2, Math.floor(position));
  // Ease inside each step so the bars settle on every year instead of sliding through it.
  const within = easing.easeInOut(Math.min(1, position - index));
  const from = snapshots[index]!;
  const to = snapshots[index + 1]!;
```

There is no `.transition()` anywhere in that file and there must not be. A d3 transition would start when the component mounted and run on wall-clock time, so the first frame of an export would catch it mid-flight and a scrub backwards would catch it not at all.

The detail that makes a bar chart race read rather than flicker is that **rank is interpolated as well as value**. If a bar jumped a row the instant it overtook its neighbour, the eye would lose it.

```tsx excerpt=examples/recipes/bar-chart-race.tsx
  const current = names.map((name) => ({ name, value: interpolateNumber(from.values[name], to.values[name])(within) }));
  // Rank is interpolated too, so a bar glides past its neighbour rather than jumping a row.
  const rankIn = (values: Record<Name, number>, name: Name) => [...names].sort((a, b) => values[b] - values[a]).indexOf(name);
  const x = scaleLinear().domain([0, Math.max(...current.map((bar) => bar.value)) * 1.08]).range([0, chart.width]);
  const y = scaleBand<number>().domain(names.map((_, row) => row)).range([0, chart.height]).padding(0.22);
```

`interpolateNumber(a, b)` returns a function; the frame supplies its argument. Nothing is retained between calls, so frame 80 costs the same whether it follows frame 79 or frame 200.

Each bar is its own element with a stable id, on purpose:

```tsx excerpt=examples/recipes/bar-chart-race.tsx
          <div key={name} data-zxn-element-id={`bar-${name}`} data-zxn-name={`${name} bar`} style={{ position: "absolute", left: 0, top, height: y.bandwidth(), width: "100%", zIndex: after < before ? 2 : 1 }}>
```

A chart has a dozen things in it and a person will want to point at one of them. With an id on each bar, a host like ZXN Studio's inspector can select and keyframe a single bar rather than the chart as a whole. See [controls and props](controls-and-props.md) for what those attributes mean and where not to put them.

Five bars is five elements, which is nothing. A field of a thousand particles is not: draw that on one `<Canvas2D>` instead. [Performance](performance.md) has the arithmetic.

## GSAP: build paused, seek every frame

A GSAP timeline is the nicest way to say "this, then that, overlapping by a fifth of a second". It is also, by default, a thing that plays itself. The fix is the whole technique: build it **paused**, and seek it from the frame.

<video src="media/gsap-title.mp4" poster="media/gsap-title.jpg" controls muted loop playsinline width="720"></video>

```tsx excerpt=examples/recipes/gsap-title.tsx
  useLayoutEffect(() => {
    const scope = gsap.context(() => {
      timeline.current = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } })
        .from(".bar", { scaleX: 0, transformOrigin: "0% 50%", duration: 0.6 })
        .from(".word", { yPercent: 110, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.25")
        .from(".sub", { opacity: 0, x: -30, duration: 0.5 }, "-=0.3")
        .to(".bar", { scaleX: 0, transformOrigin: "100% 50%", duration: 0.5, ease: "power3.in" }, 3.4)
        .to(".word, .sub", { opacity: 0, y: -24, duration: 0.4, stagger: 0.04, ease: "power2.in" }, 3.4);
    }, root);
    return () => scope.revert();
  }, [line1, line2]);

  // After the build effect on the first frame, and on every frame after it.
  useLayoutEffect(() => { timeline.current?.seek(seconds, false); });
```

Four things are doing work there.

`gsap.context(…, root)` scopes every selector to this film's subtree, so `.word` cannot reach into another film mounted on the same page. `scope.revert()` in the cleanup puts every element back as it was; without it a rebuild would stack tweens on top of half-applied inline styles.

The build effect depends on the text, not on the frame. It runs once and on a prop change, never per frame — rebuilding a timeline sixty times a second would be both slow and pointless.

The seek effect has **no dependency array**, so it runs after every commit, including the first. `seconds` comes from `useVirtualTime()`, which is `frame / frameRate` and nothing else. `seek(seconds, false)` makes GSAP compute the entire state of that instant from scratch, which is why frames may be requested in any order. A layout effect is the right place: it runs after React commits and before the host captures the frame, so the pixels belong to the frame that was asked for.

The same shape fits anything seekable. Lottie is the common one:

```tsx
import { useLayoutEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { useVirtualTime } from "@matildeene/motion-core";

export function useSeekedLottie(animation: AnimationItem | null): void {
  const { frame } = useVirtualTime();
  useLayoutEffect(() => { animation?.goToAndStop(frame, true); });
}
```

The second argument to `goToAndStop` means "this number is a frame, not a millisecond". There is no Lottie recipe in `examples/`; treat that as the pattern, not a verified film.

Anything that only plays is a warning from the checker. This is what it looks like to get it wrong:

```tsx film expect-warnings
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { FullFrame, defineFilm } from "@matildeene/motion-core";

type Props = { readonly label: string };

function PlayedTitle({ label }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Wrong: this runs on the browser's clock, so it is a different picture on
    // every render and nothing at all on a scrub backwards.
    const timeline = gsap.timeline().from(".word", { opacity: 0, y: 40, duration: 0.8 });
    timeline.play();
    return () => { timeline.kill(); };
  }, []);

  return (
    <FullFrame style={{ background: "#0b0c0e", alignItems: "center", justifyContent: "center" }}>
      <div ref={root} className="word" style={{ color: "#f3efe7", fontSize: 140, fontWeight: 900 }}>{label}</div>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "played-title",
  title: "Played title",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 90,
  component: PlayedTitle,
  defaultProps: { label: "Nope" },
  controls: { label: { type: "text", label: "Label" } },
})];
```

## simplex-noise: seed it, and build it once

`createNoise3D()` with no argument draws its permutation table from `Math.random()`. Build it twice and you have two different fields — which means a different film in the preview, in a scrub and in the export. Hand it a deterministic source instead.

<video src="media/noise-field.mp4" poster="media/noise-field.jpg" controls muted loop playsinline width="720"></video>

```tsx excerpt=examples/recipes/noise-field.tsx
let draws = 0;
const noise = createNoise3D(() => seededRandom(`noise-field-${draws++}`));
```

`seededRandom(seed)` from `@matildeene/motion-core` returns the same number for the same seed, for ever. The counter walks the seed so the table is filled with different values, and because the whole thing lives at module scope it is built **once**, when the module loads, not per render. Rebuilding it inside the component would reseed from the same counter at a different starting point and the field would shift.

Time is the third axis, which is what makes the field drift instead of jump:

```tsx excerpt=examples/recipes/noise-field.tsx
      const angle = noise(x / 520, y / 520, seconds * drift) * Math.PI * 2;
```

Nearby frames are nearby points in the same smooth volume, so the picture moves continuously without anything being carried over from the last frame. Divide the coordinates to set the feature size — bigger divisor, broader shapes — and multiply the third axis by a speed. A field of lines like this belongs on a `<Canvas2D>`; see [canvas](canvas.md).

## culori: interpolate colour in OKLCH

Blending two saturated colours in RGB takes the mid-point through grey. The channels are not perceptual, so lightness sags in the middle and the hue drifts. OKLCH is built so that a straight line between two colours looks like a straight line.

<video src="media/beat-pulse.mp4" poster="media/beat-pulse.jpg" controls muted loop playsinline width="720"></video>

```tsx excerpt=examples/recipes/beat-pulse.tsx
  const blend = interpolate([from, to], "oklch");
```

```tsx excerpt=examples/recipes/beat-pulse.tsx
  const background = formatHex(blend(frame / (film.frames - 1))) ?? from;
```

`interpolate(colours, mode)` returns a function from 0–1 to a colour object; `formatHex` turns that object into a string the DOM understands. It returns `undefined` for a colour it cannot express, so the `?? from` is not decoration. The progress argument is derived from the frame, so the blend is another pure lookup.

## What cannot be used, and why

The checker warns about each of these, and every warning names the thing to do instead.

- **Anything that only plays on a real clock.** `setInterval`, `requestAnimationFrame`, a d3 transition, a Web Animation left running, an un-paused GSAP tween. There is no frame to attach the result to.
- **CSS `transition` and `animation`.** Same problem, one layer down: the browser interpolates on its own clock and the renderer captures whatever happens to be on screen. Compute the value from the frame and set it directly.
- **Anything that reads the wall clock.** `Date.now()`, `new Date()`, `performance.now()`. Use `useTimeline().frame` or `useVirtualTime().seconds`. A clock face is a film about time, not a film that reads the time — `elapsed-clock.tsx` takes its hours as props.
- **Anything that needs the network.** `fetch`, an analytics SDK, a font or map tile loaded at runtime, an icon set pulled from a CDN. A render must produce frame 4,000 as reliably as frame 1, on a machine with no network and no cache. Data belongs in props; see [controls and props](controls-and-props.md).
- **Node built-ins.** `node:fs`, `node:path`, `node:crypto` and friends. A film runs in a browser surface in the player, in the editor and in the renderer's hidden window. The CLI is what touches the filesystem, through `--props` and `--footage`.
- **Anything that keeps state between frames.** `useState`, `useReducer`, a module-level counter that advances per render, a physics engine stepped by `world.step()`, a particle array mutated in place. Frames are requested out of order, so "the previous frame" is not a thing that exists. Anything that looks like simulation has to be closed-form — which is why `springValue` computes a spring's position at a frame rather than stepping one.
- **`Math.random()`.** Different on every render. `seededRandom(seed)` instead, with the seed derived from whatever makes the item distinct.

The rule underneath all of them is the same: nothing may depend on how the frame was reached.

## Combining two libraries

Nothing stops a film using several of these at once, as long as each is used as a function. Here d3-shape draws the path and d3-scale places it, and the stroke is revealed by the frame.

```tsx film
import { scaleLinear } from "d3-scale";
import { curveCatmullRom, line } from "d3-shape";
import { FullFrame, defineFilm, easing, mapRange, useTimeline } from "@matildeene/motion-core";

/*
 * A line chart that draws itself.
 *
 * d3-shape turns points into path data and d3-scale turns values into pixels.
 * Neither knows anything about time; the frame does the animating. The stroke
 * is revealed with pathLength={1}, which normalises the path to one unit, so
 * the reveal never has to measure the DOM -- measuring is not available before
 * the first paint, and frame zero of an export is a first paint.
 */

type Props = { readonly title: string; readonly accent: string };

const readings: number[] = [4, 9, 7, 15, 12, 22, 19, 29, 35, 32, 44, 51];
const plot = { left: 220, top: 280, width: 1480, height: 560 };

function DrawnLine({ title, accent }: Props) {
  const { frame } = useTimeline();
  const x = scaleLinear().domain([0, readings.length - 1]).range([plot.left, plot.left + plot.width]);
  const y = scaleLinear().domain([0, Math.max(...readings) * 1.1]).range([plot.top + plot.height, plot.top]);
  const path = line<number>().x((_, index) => x(index)).y((value) => y(value)).curve(curveCatmullRom.alpha(0.6))(readings) ?? "";

  const reveal = mapRange(frame, [12, 96], [0, 1], { clamp: true, ease: easing.easeInOut });
  const fade = mapRange(frame, [0, 14], [0, 1], { clamp: true, ease: easing.easeOut });
  // Which reading the head has reached, so the dots land as the line passes them.
  const reached = reveal * (readings.length - 1);

  return (
    <FullFrame style={{ background: "#0f1117", color: "#f3efe7", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div data-zxn-element-id="title" style={{ position: "absolute", left: plot.left, top: 130, fontSize: 68, fontWeight: 800, opacity: fade }}>{title}</div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => (
          <line key={step} x1={plot.left} x2={plot.left + plot.width} y1={plot.top + plot.height * step} y2={plot.top + plot.height * step}
            stroke="rgba(255,255,255,.10)" strokeWidth={2} />
        ))}
        <path data-zxn-element-id="trend" data-zxn-name="Trend line" d={path} fill="none" stroke={accent} strokeWidth={10}
          strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - reveal} />
        {readings.map((value, index) => (
          <circle key={index} cx={x(index)} cy={y(value)} r={12 * mapRange(reached, [index - 0.25, index + 0.35], [0, 1], { clamp: true, ease: easing.easeOut })}
            fill="#0f1117" stroke={accent} strokeWidth={6} />
        ))}
      </svg>
      <div data-zxn-element-id="readout" style={{ position: "absolute", right: 220, top: 140, fontSize: 96, fontWeight: 900, color: accent, fontVariantNumeric: "tabular-nums", opacity: fade }}>
        {Math.round(mapRange(reveal, [0, 1], [readings[0] ?? 0, readings.at(-1) ?? 0]))}
      </div>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "drawn-line",
  title: "Drawn line",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 130,
  component: DrawnLine,
  defaultProps: { title: "Weekly renders", accent: "#3ff0d6" },
  controls: {
    title: { type: "text", label: "Title" },
    accent: { type: "color", label: "Accent" },
  },
})];
```

<video src="media/drawn-line.mp4" poster="media/drawn-line.jpg" controls muted loop playsinline width="720"></video>

Twelve circles and one path is a small DOM, so SVG is the right medium here. Past a few hundred marks the same chart belongs on a canvas.

## Next

- [Thinking in frames](thinking-in-frames.md): why out-of-order frames are the constraint everything follows from.
- [Canvas](canvas.md): drawing many things in one pass.
- [Controls and props](controls-and-props.md): making a film adjustable without opening it.
- [Recipes](recipes.md): the verified examples quoted on this page, in full.
