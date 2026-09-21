---
title: Canvas
summary: When to draw a frame on a canvas instead of in the DOM, the Canvas2D API, and three worked examples of particle-like work.
---
# Canvas

A host rasterises a film's DOM once per frame, so a film costs what its DOM costs to lay out and paint. That is nothing for a title and ruinous for a thousand particles. `<Canvas2D>` is the escape hatch: one element that paints itself from the frame number, in a single pass, at the same cost whether it draws forty things or four hundred.

## What belongs where

Use DOM and SVG for the dozens of things a person would point at and name: titles, bars, labels, shapes, cards, straps. They lay out for you, they restyle from props, they stay crisp at any size, and they can carry a `data-zxn-element-id` so a host's inspector can select and animate them. See [Performance](performance.md) for what ids are for.

Use a canvas for anything particle-like, where the individual thing has no identity: rain, snow, stars, television static, noise, a field of lines, a plotted curve, a swarm. Nobody will ever select speck 914. Drawing those as elements means the browser doing layout and paint work for every one of them, every frame, for no benefit.

The two mix freely. `examples/recipes/retro-tv.tsx` is a cabinet in SVG with a canvas behind the glass, which is exactly the right division of labour.

## The API

```tsx
import { Canvas2D } from "@zxn/motion-core";

<Canvas2D draw={paint} width={960} height={540} className="screen" style={{ opacity: 0.8 }} />;
```

| Prop | Meaning |
| --- | --- |
| `draw` | A `CanvasDraw`. Required. |
| `width`, `height` | Drawing units across and down. Default to the film's own size. |
| `className` | Passed to the `<canvas>`. |
| `style` | Merged over the element's own styles. |

The element is absolutely positioned at `inset: 0` and stretched to `width: 100%`, `height: 100%` of its parent, so its drawing units and its displayed size are independent. That is what lets you draw a small surface and blow it up.

`draw` has this shape:

```ts
type CanvasDraw = (context: CanvasRenderingContext2D, frame: CanvasFrame) => void;
```

`CanvasFrame` carries everything a drawing needs to know:

| Field | Meaning |
| --- | --- |
| `frame` | The frame, local to the enclosing `<Cue>`. |
| `absoluteFrame` | The film's own frame. |
| `seconds` | `frame / frameRate`, for anything that thinks in seconds. |
| `film` | The `FilmMetadata`: `width`, `height`, `frameRate`, `frames`, and the rest. |
| `width`, `height` | The size of the drawing surface, in the units `draw` draws in. |

Note that `width` and `height` are the *surface's* size, not the film's. A draw function that uses them works unchanged whether it is painting the whole frame or a 232-pixel screen inside a television.

### Two rules

**The surface is cleared and the context reset to identity before every call.** You never inherit a transform, a clip or last frame's pixels, and a draw that leaves a transform behind cannot skew the next frame.

**`draw` must paint the whole picture from the frame alone.** Frames are asked for in any order — a scrub jumps, a player loops, a renderer may be seeking. Nothing may be carried over from the last call, because there may not have been a last call. This is the same discipline as the rest of the library, and it is what makes a canvas frame reproducible rather than merely plausible. See [Thinking in frames](thinking-in-frames.md).

Drawing happens in a layout effect, after React commits and before the host captures, so the pixels belong to the frame that was asked for.

### Testing a draw function

`paintCanvasFrame(context, draw, frame)` is the same call `<Canvas2D>` makes, exported so a draw function can be exercised against any 2D context, in a test or outside React. It clears and resets the context, calls `draw`, and restores — even if the draw throws, which it then lets through.

```ts
import { paintCanvasFrame } from "@zxn/motion-core";

paintCanvasFrame(context, myDraw, { frame: 15, absoluteFrame: 15, seconds: 0.5, film, width: 320, height: 180 });
```

## Matrix rain, line by line

<video src="media/matrix-rain.mp4" poster="media/matrix-rain.jpg" controls muted loop playsinline width="720"></video>

`examples/recipes/matrix-rain.tsx` is the canonical case. The obvious build — a `<div>` per glyph with a glowing `text-shadow` — is a couple of thousand blurred elements and crawls at any size. Here the field is one element.

The draw function is a closure over the props, which is what lets `<Canvas2D>` stay a single prop:

```tsx excerpt=examples/recipes/matrix-rain.tsx
const rain = ({ color, background, cell, speed }: Props): CanvasDraw => (context, { seconds, width, height }) => {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.font = `600 ${Math.round(cell * 0.92)}px ui-monospace, "SF Mono", Menlo, monospace`;
  context.textAlign = "center";
  context.textBaseline = "top";
```

The background is painted rather than cleared to nothing, and the font and text alignment are set once, outside both loops.

Every stream is then derived from its column number. There is no per-stream state anywhere:

```tsx excerpt=examples/recipes/matrix-rain.tsx
    // Everything about a stream comes from its column number, so any frame can be drawn on its own.
    const pace = speed * (0.45 + 0.55 * seededRandom(`pace-${column}`));
    const length = 8 + Math.floor(seededRandom(`length-${column}`) * 22);
    // A short gap before a stream comes round again keeps the field full without ever looking like a wall.
    const cycle = rows + length + Math.floor(seededRandom(`gap-${column}`) * rows * 0.4);
    const head = Math.floor(seconds * pace + seededRandom(`start-${column}`) * cycle) % cycle;
```

`seededRandom` returns the same number for the same seed, for ever, so `pace-7` is one fixed speed for column seven in the preview, in a scrub and in the export. The head position is a modulo of elapsed seconds, not an accumulator: frame 200 can be drawn without having drawn frames 0 to 199.

The `Math.floor` around the head is what makes it read as *that* rain. The stream steps a whole cell at a time and never slides between cells. Smooth sub-pixel motion is what makes a naive version look sluggish; stepping looks fast even when it is not.

Inside a stream, each glyph picks itself from a flicker counter that ticks a few times a second on its own beat, so the field shimmers instead of changing in unison:

```tsx excerpt=examples/recipes/matrix-rain.tsx
      // A glyph changes a few times a second, each on its own beat.
      const flicker = Math.floor(seconds * (3 + 5 * seededRandom(`flicker-${column}-${row}`)));
      const glyph = glyphs[Math.floor(seededRandom(`glyph-${column}-${row}-${flicker}`) * glyphs.length)]!;
      const fade = 1 - step / length;
      // The trail stays readable most of its length and only dies away at the very end.
      context.globalAlpha = step === 0 ? 1 : 0.12 + 0.88 * Math.sqrt(fade);
      context.fillStyle = step === 0 ? "#eaffef" : color;
```

The trail fades with a square root rather than linearly, which keeps most of its length readable and dies away only at the very end. A linear fade makes a stream look half as long as it is.

Then the one deliberate expense:

```tsx excerpt=examples/recipes/matrix-rain.tsx
      // One soft glow on the head only: blur is the expensive part of any paint.
      context.shadowColor = color;
      context.shadowBlur = step === 0 ? cell * 0.9 : step < 3 ? cell * 0.25 : 0;
```

Sixty glowing heads is affordable. Two thousand glowing glyphs is not, and it would not look better: the glow is what says "this one is the head", and a glow on everything says nothing.

## Static behind glass

<video src="media/retro-tv.mp4" poster="media/retro-tv.jpg" controls muted loop playsinline width="720"></video>

`examples/recipes/retro-tv.tsx` puts both techniques in one film. The cabinet, antennae, dials and play button are a few dozen SVG shapes with thick ink outlines — crisp at any size, restyled from four colour props. The screen's static is a canvas, because "a few thousand random specks that change every frame" is exactly what DOM is bad at.

```tsx excerpt=examples/recipes/retro-tv.tsx
/** Coarse, chunky static: big specks read as "old TV", fine noise reads as "broken GPU". */
const staticNoise = (strength: number): CanvasDraw => (context, { frame, width, height }) => {
  const speck = 8;
  for (let y = 0; y < height; y += speck) {
    for (let x = 0; x < width; x += speck) {
      const value = seededRandom(`${frame}-${x}-${y}`);
      context.fillStyle = `rgba(255,255,255,${(value * 0.85 * strength).toFixed(3)})`;
      context.fillRect(x, y, speck, speck);
    }
  }
```

The seed is the frame and the cell's position, so the static is noisy in space and in time but identical every time frame 41 is drawn.

The surface itself is tiny and scaled up:

```tsx excerpt=examples/recipes/retro-tv.tsx
          <Canvas2D width={232} height={225} draw={staticNoise(staticStrength)} style={{ imageRendering: "pixelated" }} />
```

232×225 drawing units stretched across a 464×450 hole, with `imageRendering: "pixelated"` so the browser does not smooth the enlargement away. A quarter of the pixels, and the chunkiness is the look rather than a compromise.

## Seeded noise

<video src="media/noise-field.mp4" poster="media/noise-field.jpg" controls muted loop playsinline width="720"></video>

`examples/recipes/noise-field.tsx` steers a grid of short lines with simplex noise. The thing to get right is the seeding:

```tsx excerpt=examples/recipes/noise-field.tsx
let draws = 0;
const noise = createNoise3D(() => seededRandom(`noise-field-${draws++}`));
```

`createNoise3D()` with no argument draws on `Math.random` and builds a different field every time, which means a different film on every render. Handing it a deterministic source fixes the field, and building it once outside the component keeps it fixed across re-renders.

Time is the noise's third axis, which is what makes the field drift rather than jump — nearby frames are nearby points in the same smooth volume:

```tsx excerpt=examples/recipes/noise-field.tsx
      const angle = noise(x / 520, y / 520, seconds * drift) * Math.PI * 2;
      const reach = 16 + 26 * (noise(x / 300, y / 300, seconds * drift + 40) * 0.5 + 0.5);
```

## A canvas from scratch

A starfield, complete, for the shape of it:

```tsx film
import { Canvas2D, FullFrame, defineFilm, seededRandom, type CanvasDraw } from "@zxn/motion-core";

type Props = { readonly background: string; readonly count: number; readonly drift: number };

const stars = ({ background, count, drift }: Props): CanvasDraw => (context, { seconds, width, height }) => {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#fdfdff";
  for (let index = 0; index < count; index += 1) {
    // Depth decides brightness, size and speed together, so the field reads as layered.
    const depth = 0.25 + seededRandom(`depth-${index}`) * 0.75;
    const x = (seededRandom(`x-${index}`) * width + seconds * drift * depth) % width;
    const y = seededRandom(`y-${index}`) * height;
    context.globalAlpha = 0.25 + 0.75 * depth;
    context.fillRect(x, y, depth * 3, depth * 3);
  }
};

function Starfield(props: Props) {
  return <FullFrame><Canvas2D draw={stars(props)} /></FullFrame>;
}

export const films = [defineFilm({
  id: "starfield",
  title: "Starfield",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 180,
  component: Starfield,
  defaultProps: { background: "#05060a", count: 700, drift: 60 },
  controls: {
    background: { type: "color", label: "Background" },
    count: { type: "number", label: "Stars", min: 50, max: 2000, step: 50 },
    drift: { type: "number", label: "Drift", min: 0, max: 400, step: 10 },
  },
})];
```

<video src="media/starfield.mp4" poster="media/starfield.jpg" controls muted loop playsinline width="720"></video>

Seven hundred stars, one element.

## Practical tips

- **Set `font`, `fillStyle`, `strokeStyle` and `lineWidth` outside inner loops.** Assigning them is not free, and assigning them seven hundred times to the same value is seven hundred times too many. The rain sets its font once and only switches `fillStyle` where the colour genuinely changes.
- **`shadowBlur` is expensive.** Every blurred draw costs many times an unblurred one. Put a glow on a handful of draws, the way the rain glows only the head, and set `shadowBlur = 0` for the rest — it stays set until you change it.
- **Draw at a lower internal resolution when the look allows it.** The television's static is 232×225 for a 464×450 hole. Set `width` and `height` to what the drawing needs, not to the film.
- **Gradients are created per frame.** `createLinearGradient` returns an object tied to the context, so it is built inside `draw` and cannot be hoisted to module scope. Build it once per call, outside the loops, as the noise field does.
- **Reach for a canvas at the first "one element per…".** If you are about to write a loop that returns JSX per particle, you want this page.

Next: [Performance](performance.md) for the budget the whole film has to fit inside, and [Recipes](recipes.md) for the rest of the examples.
