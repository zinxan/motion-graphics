---
title: Recipes
summary: Eight verified example films, what each one teaches, the line worth copying, and what to change first.
---
# Recipes

Every film here lives in [`examples/recipes/`](../examples/recipes) and does one job: it shows a single technique in the smallest film that still looks like something you would ship. Read the one nearest your problem, copy it, change the props.

| Recipe | What it teaches | Technique | Packages |
| --- | --- | --- | --- |
| [Matrix rain](#matrix-rain) | A field of thousands of things costs one element | Canvas | — |
| [Elapsed clock](#elapsed-clock) | Time passing without playing it out | SVG | — |
| [Cartoon television](#cartoon-television) | Squash, stretch and follow-through | SVG + Canvas | — |
| [Bar chart race](#bar-chart-race) | Pure libraries interpolated by the frame | DOM | `d3-scale`, `d3-interpolate` |
| [Noise field](#noise-field) | Seeding a generative library | Canvas | `simplex-noise` |
| [GSAP title](#gsap-title) | Seek a timeline, never play it | DOM | `gsap` |
| [Lower third](#lower-third) | In, hold and out, all from controls | DOM | — |
| [Beat pulse](#beat-pulse) | Cutting on bars and beats | DOM | `culori` |
| [Rocket launch](#rocket-launch) | Cutting a film into beats, a line drawing itself on, a camera shake | SVG + Canvas2D | — |

## These are known to work

`examples/recipes/recipes.test.tsx` mounts every recipe in a real DOM at its first frame, its middle frame, its last frame and one frame asked for out of order. A recipe that throws, logs a React error, renders almost nothing or draws nothing on its canvas fails the suite. It also asserts that the same frame asked for twice produces the same markup, and that every default prop has a control. Then each one is rendered to the video on this page. That is why the excerpts below are quoted from the files rather than retyped: an example cannot change under the page that quotes it.

Render one yourself:

```bash
zxn-motion render examples/recipes/retro-tv.tsx retro-tv out/retro-tv.mp4
```

Every file exports both a named film and a `films` array, so it is a valid CLI entry on its own.

## Matrix rain

<video src="media/matrix-rain.mp4" poster="media/matrix-rain.jpg" controls muted loop playsinline width="720"></video>

Digital rain: streams of glyphs stepping down the screen, each with its own speed, length and start, a near-white head and a trail that fades behind it. It is here to teach the one decision that decides whether a film renders in a minute or an hour — a field of many small things is **one** element, not many. The obvious build, a `<div>` per glyph with a glowing `text-shadow`, is a couple of thousand blurred elements laid out and painted on every frame.

```tsx excerpt=examples/recipes/matrix-rain.tsx
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  for (let column = 0; column < columns; column += 1) {
    // Everything about a stream comes from its column number, so any frame can be drawn on its own.
    const pace = speed * (0.45 + 0.55 * seededRandom(`pace-${column}`));
    const length = 8 + Math.floor(seededRandom(`length-${column}`) * 22);
    // A short gap before a stream comes round again keeps the field full without ever looking like a wall.
    const cycle = rows + length + Math.floor(seededRandom(`gap-${column}`) * rows * 0.4);
    const head = Math.floor(seconds * pace + seededRandom(`start-${column}`) * cycle) % cycle;
```

Nothing is stored between frames. A stream's speed, length and phase are all read back out of `seededRandom` from its column number, so frame 200 can be drawn without having drawn frames 0 to 199 — which is what a scrub does, and what a renderer is allowed to do. `Math.floor(seconds * pace)` is what makes the rain *step* a whole cell at a time instead of sliding; sliding reads as falling text, stepping reads as the rain.

Change first: `speed` and `cell` in the controls — smaller cells are denser, and `cell` is also the glyph size and the glow radius. Then the `glyphs` constant, which is the whole character set. Deeper: [Drawing on canvas](canvas.md) and [Performance](performance.md).

## Elapsed clock

<video src="media/elapsed-clock.mp4" poster="media/elapsed-clock.jpg" controls muted loop playsinline width="720"></video>

An analogue clock that sweeps from one time to another, with a digital readout under the dial and a "three hours later" caption arriving at the end. It teaches how to show a long interval without playing it out: the hands do not tick through three hours, they ease through them. It is also the counterweight to the rain — a dozen crisp shapes is exactly what SVG is good at.

```tsx excerpt=examples/recipes/elapsed-clock.tsx
  const appear = springValue({ frame, frameRate: film.frameRate, stiffness: 120, damping: 14 });
  // Hold on the start time, sweep, then hold on the end so both can be read.
  const progress = mapRange(frame, [24, film.frames - 36], [0, 1], { clamp: true, ease: easing.easeInOut });
  const hours = from + (to - from) * progress;
  const captionIn = mapRange(frame, [film.frames - 40, film.frames - 22], [0, 1], { clamp: true, ease: easing.easeOut });

  const hourAngle = (hours % 12) * 30;
  const minuteAngle = ((hours * 60) % 60) * 6;
```

One number, `hours`, drives the hour hand, the minute hand and the digits, so they cannot disagree — there is no second calculation to keep in step. The stops are written relative to `film.frames`, so lengthening the film lengthens the sweep and leaves the hold at the end alone. `easeInOut` is the point of the device: slow, fast, slow is how a clock speeding up has always been drawn.

Change first: `from` and `to` (hours with a decimal part, so 9.5 is 09:30) and `caption`. Then the `[24, film.frames - 36]` stops, which are the whole rhythm of the film. Deeper: [Thinking in frames](thinking-in-frames.md) and [Controls and props](controls-and-props.md).

## Cartoon television

<video src="media/retro-tv.mp4" poster="media/retro-tv.jpg" controls muted loop playsinline width="720"></video>

A 1960s cartoon TV that drops in, overshoots, squashes on landing and wobbles its antennae a beat later, with static on the screen and a play button that gets pressed. It teaches character: squash and stretch, and follow-through. It also shows both techniques living in one film — SVG for the set, a small `<Canvas2D>` for the static, because "a few thousand random specks that change every frame" is the one thing DOM is worst at.

```tsx excerpt=examples/recipes/retro-tv.tsx
  // The drop: a loose spring, so it overshoots and settles like something with weight.
  const drop = springValue({ frame, frameRate: fps, stiffness: 140, damping: 11 });
  const landing = Math.max(0, 1 - Math.abs(drop - 1) * 6) * mapRange(frame, [6, 22], [1, 0], { clamp: true });
  const squash = 1 - 0.12 * landing;
  // The antennae follow the body a few frames late, which is what makes them look attached by springs.
  const lag = springValue({ frame: frame - 5, frameRate: fps, stiffness: 90, damping: 7 });
  const wobble = (1 - lag) * 38;
```

`landing` is a spike: it is near 1 only while `drop` is close to its target, and the `mapRange` fades the whole effect out after frame 22, so the cabinet squashes on the first landing and not on every later wobble of the same spring. Follow-through is one line — the antennae read the *same* spring at `frame - 5`. Both work under a scrub because `springValue` is closed-form; a stepped simulation would have nothing to say about frame 100 until it had run frames 0 to 99.

Change first: the four colour controls, then `pressAt`, the frame the play button is pressed on, which pulls the static, the glow and the button's own spring with it. Deeper: [Thinking in frames](thinking-in-frames.md) and [Drawing on canvas](canvas.md).

## Bar chart race

<video src="media/bar-chart-race.mp4" poster="media/bar-chart-race.jpg" controls muted loop playsinline width="720"></video>

Bars that grow and overtake each other between yearly snapshots. It teaches how to use a library that is a pile of pure functions: `d3-scale` and `d3-interpolate` take a number and give a number back, which is exactly what a film wants. What it must *not* use is a d3 transition — those run on the real clock.

```tsx excerpt=examples/recipes/bar-chart-race.tsx
        // Bars trade places quickly, in the middle of the step: two bars sharing a row is unreadable, so they
        // spend as little time crossing as looks natural, and the one moving up rides on top while they do.
        const swap = easing.easeInOut(mapRange(within, [0.3, 0.7], [0, 1], { clamp: true }));
        const before = rankIn(from.values, name);
        const after = rankIn(to.values, name);
        const rank = interpolateNumber(before, after)(swap);
        const top = chart.top + (y(0) ?? 0) + rank * y.step();
```

Rank is interpolated as a number, not switched, so a bar glides through the row above rather than jumping into it. The swap is squeezed into the middle 40% of the step because two bars occupying the same row is the unreadable part, and `zIndex: after < before ? 2 : 1` puts the bar that is winning on top while they cross. Each bar is a real DOM element with a `data-zxn-element-id`, on purpose: a chart has a dozen nameable things in it, and a host can then select one.

Change first: the `snapshots` array and `framesPerStep` — the film's length is derived from both, so the film grows with the data. Then `colors` and the `title`/`unit` controls. Deeper: [Using packages](using-packages.md).

## Noise field

<video src="media/noise-field.mp4" poster="media/noise-field.jpg" controls muted loop playsinline width="720"></video>

A drifting field of short lines, each angled by simplex noise, with time as the third noise axis. It teaches the one thing that goes wrong with a generative library: seed it, or you get a different film every render.

```tsx excerpt=examples/recipes/noise-field.tsx
let draws = 0;
const noise = createNoise3D(() => seededRandom(`noise-field-${draws++}`));
```

`createNoise3D()` with no argument builds its permutation table from `Math.random`, so the field is different in the preview, in a scrub and in the export. Handing it a deterministic source fixes that, and building it once at module scope means the table is not rebuilt per frame. Using seconds as the third axis rather than as an offset is what makes the field *drift*: neighbouring frames are neighbouring points in the same smooth volume, so nothing jumps.

Change first: the `drift` control, then `spacing` in the draw function (denser costs more, but it is one element either way) and the `from`/`to` gradient colours. Deeper: [Using packages](using-packages.md) and [Drawing on canvas](canvas.md).

## GSAP title

<video src="media/gsap-title.mp4" poster="media/gsap-title.jpg" controls muted loop playsinline width="720"></video>

A title choreographed with GSAP: a rule wipes in, words rise in a stagger, a subtitle slides, and the whole thing leaves again. It teaches the rule for every time-based library — build it paused and seek it, never play it.

```tsx excerpt=examples/recipes/gsap-title.tsx
  // After the build effect on the first frame, and on every frame after it.
  useLayoutEffect(() => { timeline.current?.seek(seconds, false); });
```

`useVirtualTime()` gives the seconds of the frame being rendered, and GSAP recomputes the entire timeline state for that instant from scratch, so frames can be asked for in any order. The seek is in a layout effect with no dependency array, so it runs after the build effect on the first frame and after every commit thereafter — before the host captures the frame. The same pattern fits anything seekable: `lottie.goToAndStop(frame, true)`, a Web Animations `currentTime`, a video's `currentTime`. A library that can only play cannot be used in a film.

Change first: `line1`, `line2` and `accent`, then the durations and the `"-=0.25"` overlaps in the timeline, and the `3.4` that both exit tweens share — that number is where the film turns around. Deeper: [Using packages](using-packages.md).

## Lower third

<video src="media/lower-third.mp4" poster="media/lower-third.jpg" controls muted loop playsinline width="720"></video>

The name strap that appears under someone talking: a coloured rule, a name, a role, in and out over a transparent background so it composites over footage. It teaches how to write in, hold and out as one readable statement, and why every prop deserves a control.

```tsx excerpt=examples/recipes/lower-third.tsx
  const last = film.frames - 1;
  const slide = springValue({ frame, frameRate: film.frameRate, stiffness: 150, damping: 20, clamp: true });
  const leave = mapRange(frame, [last - 16, last], [0, 1], { clamp: true, ease: easing.easeIn });
  const text = mapRange(frame, [8, 22, last - 20, last - 8], [0, 1, 1, 0], { clamp: true, ease: easing.easeOut });
```

`mapRange` takes matching lists of stops, so four of them describe a fade in, a hold and a fade out on one line. Everything is expressed against `last`, so changing `frames` moves the exit and leaves the entrance where it is. The text starts eight frames after the strap, which is the whole trick of a good strap: the container arrives, then the words fill it.

Change first: `name`, `role`, `accent` and `side` — all four are controls, so an editor never opens the file. Then the `damping: 20` on the slide, which is how much the strap overshoots. Deeper: [Controls and props](controls-and-props.md).

## Beat pulse

<video src="media/beat-pulse.mp4" poster="media/beat-pulse.jpg" controls muted loop playsinline width="720"></video>

Four words cut one per bar, a ring pulsing out on every beat, four dots showing the count, and the background crossfading from one colour to the other. It teaches placing things in bars and beats rather than in frame numbers.

```tsx excerpt=examples/recipes/beat-pulse.tsx
  // How far through the current beat we are: 0 on the beat, 1 just before the next.
  const beat = tempo.beatAt(frame);
  const sinceBeat = frame - tempo.beat(Math.floor(beat));
  const kick = mapRange(sinceBeat, [0, 7], [1, 0], { clamp: true, ease: easing.easeOut });
```

`tempo.beat(n)` converts a beat index to a frame and `tempo.beatAt(frame)` goes the other way, so `sinceBeat` is the film's distance past the last downbeat whatever the bpm is. Every conversion goes through the same function, which is why the word cut and the pulse land on the same frame rather than one apart. The words are placed with `<Cue startBar={index} lengthBars={1}>` — no frame numbers anywhere — so changing `bpm` in the film's `tempo` re-times the entire film.

Change first: `bpm` in `tempo`, and `frames` alongside it. Then the `words` array, and the `from`/`to` colour controls, which are blended in OKLCH by `culori` so the midpoint stays bright instead of going through grey. Deeper: [Tempo and music](tempo-and-music.md).

## Rocket launch

<video src="media/rocket-launch.mp4" poster="media/rocket-launch.jpg" controls muted loop playsinline width="720"></video>

A countdown, ignition, and a rocket climbing away along a trajectory that draws itself on behind it. It teaches three things. `<Cue>` cuts the film into its beats, so the count, the ignition and the climb are each written against a clock that starts at zero. The trajectory is the oldest trick for "a line being drawn": an SVG path with `stroke-dashoffset` set from the frame. And the camera shake is nothing more than a seeded offset of the whole frame that dies away, which sells the weight of the launch better than any amount of flame.

```tsx excerpt=examples/recipes/rocket-launch.tsx
  const thrust = frame < ignition ? 0 : Math.min(1, (frame - ignition) / 8);
  // The shake: a seeded jolt, biggest at ignition, gone by the time the rocket is clear of the pad.
  const shake = Math.max(0, 1 - (frame - ignition) / 40) * (frame >= ignition ? 1 : 0);
  const jolt = { x: (seededRandom(`jx-${frame}`) - 0.5) * 28 * shake, y: (seededRandom(`jy-${frame}`) - 0.5) * 22 * shake };
  // The trajectory draws itself on behind the rocket: the dash offset is how much of the path is still hidden.
  const pathLength = 2400;
  const drawn = mapRange(frame, [liftoff, film.frames], [0, 1], { clamp: true, ease: easing.easeIn });
```

`seededRandom` keyed on the frame is what makes the shake honest: frame 90 jolts the same way every time it is asked for, so a scrub, an export and a preview agree. The smoke is one `<Canvas2D>` -- a hundred and sixty puffs, each born on its own seeded frame at the pad, rolling out along the ground and rising -- drawn whole from the frame number with nothing carried over.

Change first: the four controls, then `ignition` and `liftoff`, the two frames the whole film is cut around. Deeper: [Thinking in frames](thinking-in-frames.md) and [Drawing on canvas](canvas.md).

## Ideas to build next

Each of these is one technique away from something above.

- **A vinyl record with a tonearm.** The label is a rotating SVG group; the arm is one spring swinging onto the lead-in groove and then creeping across on a slow `mapRange`.
- **A rocket countdown that shakes on zero.** Digits on `<Cue>`s one second apart, then a seeded shake — `seededRandom` keyed on the frame, driving a translate — that decays over about twelve frames.
- **A typewriter with a carriage return.** `text.slice(0, charactersAt(frame))` on one element, a cursor that blinks from `frame % 20`, and the whole block sliding up a line when the count crosses a wrap point.
- **A loading bar that lies.** One `mapRange` with six stops: fast to 70%, stall, crawl, then snap to 100 — the stops *are* the joke.
- **A weather card with falling snow.** The card is DOM, the snow is one `<Canvas2D>` drawn from seeded per-flake constants, like the rain.
- **A subscribe button pressed by a cursor.** `<Stage>` with a layout, a `<Pointer>` path, and the button drawing its own pressed state from `usePointer(path).pressedOn("subscribe")`.
- **A race between two progress bars.** The bar-chart-race interpolation with two rows and a photo finish: ease the last 10% much harder than the first 90%.
- **A Polaroid that develops.** One picture under a white overlay whose `opacity` and `filter: saturate()` are mapped from the frame, plus a small spring as it lands on the table.
- **A terminal typing a command.** Monospace DOM, the typewriter slice for the prompt, then output lines revealed by stacked `<Cue>`s two frames apart.
- **A clock face turning into a pie chart.** The elapsed-clock dial, with the sweep wedge growing to a real data value and the hands fading out under it.

Start from the nearest recipe, run `zxn-motion render` on it, and change one number at a time. If you are working with an AI agent, [Writing films with an AI agent](ai-agents.md) hands it all of this over MCP.
