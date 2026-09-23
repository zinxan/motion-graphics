---
title: Performance
summary: Why a film costs what it costs, the true story of a Matrix rain built from 1,800 divs, and a budget you can hold a film to.
---
# Performance

A film is not a shader and it is not a video. Every frame, a host mounts the React tree at one exact frame, lets the browser lay it out and paint it, and rasterises the result. So a film costs what its DOM costs to lay out and paint — multiplied by the number of frames, which for a ten-second film at 30fps is three hundred.

That makes performance unusually predictable. There is no mystery hot loop. There are four things that cost money.

## What costs time

**Element count.** Every element is layout work and paint work, every frame. A few hundred is fine. A few thousand is not, and the cost does not go away when the elements are small or off screen.

**Layout.** A tree of absolutely positioned boxes is cheap to lay out. Deep nesting, flex inside flex inside grid, and text that has to be measured and wrapped are not. Films mostly place things at known coordinates, which is the cheap case — stay in it.

**Paint, and specifically blur.** Blur is the expensive paint, by a wide margin: `filter: blur()`, `backdrop-filter`, and large `text-shadow` or `box-shadow` radii. The cost scales with the radius and with the area, and it is paid once per element that has one. One blurred panel is nothing. A blurred shadow on every item of a list is the single most common way to make a film crawl.

**Resolution.** Paint cost goes with pixels. 4K is four times the paint of 1080p on every frame, and a host scales a film to fit anyway, so the extra pixels usually go straight in the bin. Author at 1920×1080 unless someone has actually asked for more.

## The rain that crawled

This is where the library's canvas primitive came from.

An AI assistant was asked, inside the editor, for "Matrix rain". It produced something that was recognisably right and completely unusable. The field was built the obvious way: one `<div>` per glyph, about 1,800 of them. Each carried a blurred `text-shadow` for the green glow. Each had its own `data-zxn-element-id`, because the assistant had been told that things in a film get ids. And the film was 3840×2160.

Every one of those multiplies against the others. 1,800 elements is bad; 1,800 blurred elements is much worse; 1,800 blurred elements at four times the pixel count is a frame that takes seconds. The editor's scrubber became unusable, and an export that should have taken a minute did not finish in the time anyone was prepared to watch.

The second problem was more interesting, because it was not about speed at all. The rain *looked* slow. Streams advanced 3 to 8 pixels a frame down a 2,160-pixel frame, which is fourteen seconds to cross the screen, and they slid smoothly between positions. Real digital rain steps a whole glyph cell at a time. Smooth sub-pixel motion reads as drifting; stepping reads as fast, even at the same underlying speed. Making the film faster and making it look right turned out to be the same change.

Here is the approach, compressed. The checker rejects it:

```tsx film expect-warnings
import { FullFrame, defineFilm, seededRandom, useTimeline } from "@matildeene/motion-core";

type Props = { readonly color: string };

/* Do not do this. One element per glyph, each blurred, at 4K. */
function SlowRain({ color }: Props) {
  const { frame } = useTimeline();
  const glyphs = Array.from({ length: 1800 }, (_, index) => {
    const column = index % 60;
    const row = Math.floor(index / 60);
    const speed = 3 + seededRandom(`speed-${column}`) * 5;
    const y = (row * 72 + frame * speed) % 2160;
    return (
      <div
        key={index}
        data-zxn-element-id={`glyph-${index}`}
        style={{ position: "absolute", left: column * 64, top: y, color, fontSize: 48, textShadow: `0 0 14px ${color}` }}
      >
        {index % 2 === 0 ? "0" : "1"}
      </div>
    );
  });
  return <FullFrame style={{ background: "#020806" }}>{glyphs}</FullFrame>;
}

export const films = [defineFilm({
  id: "slow-rain",
  title: "Slow rain",
  width: 3840,
  height: 2160,
  frameRate: 30,
  frames: 240,
  component: SlowRain,
  defaultProps: { color: "#1dff78" },
  controls: { color: { type: "color", label: "Rain" } },
})];
```

The version that works is `examples/recipes/matrix-rain.tsx`: the same picture on one `<Canvas2D>`, at 1920×1080, stepping a cell at a time, with a glow on the heads only. It costs about the same whether there are forty columns or four hundred. [Canvas](canvas.md) walks through it.

<video src="media/matrix-rain.mp4" poster="media/matrix-rain.jpg" controls muted loop playsinline width="720"></video>

## A budget

Rough, honest numbers rather than a formula:

- **Tens to low hundreds of elements.** A title card is a handful. A chart with twenty bars, their labels and an axis is perhaps eighty. An interface film with a stage, a panel and its contents might reach two hundred. Past a few hundred you should be able to say why; at a thousand, something is wrong.
- **Blur on a handful of elements, never in a loop.** One glow on a title, one soft shadow under a card, one `backdrop-filter` on one panel. If a blur is inside a `.map()`, move it to a shared parent or move the whole list onto a canvas.
- **Author at 1920×1080, 30fps.** Go bigger only when the delivery genuinely needs it, and expect to pay four times over for 4K.
- **One canvas beats a thousand elements, always.** A field of particles is one element with one draw call loop, and the draw loop is far cheaper than layout and paint per node.

None of this is about micro-optimisation. It is about not asking the browser to do work nobody will ever see.

## Element ids

`data-zxn-element-id` marks something a host can select, name and animate — the title, a bar, a label, a shape, a strap. `examples/recipes/lower-third.tsx` gives ids to `strap`, `rule`, `name` and `role`: four things a person might want to grab. `<StageItem id>` adds one for you.

Do not give ids to particles. An id on each of 1,800 glyphs is 1,800 entries in an inspector nobody will ever open, an attribute the browser carries on every node, and a promise that speck 914 is a thing worth addressing. It is not.

The test is simple: would a person ever click it and expect something to be selected? Then it gets an id. Otherwise it should probably not be an element at all.

## Determinism is performance

Frames are asked for in any order. A scrub jumps, a player loops, a renderer may seek. So a film computes its picture from the frame rather than stepping a simulation forward, and that discipline pays twice.

The obvious payment is correctness: `springValue` is closed-form and `seededRandom` is a pure function of its seed, so frame 200 drawn cold is identical to frame 200 reached by playing from zero.

The less obvious payment is speed. A film that accumulates cannot draw frame 200 without drawing the 199 before it. A film that derives can draw any frame immediately, which is what makes scrubbing responsive and what lets a host render frames out of order or in parallel. `useState`, `setInterval`, `requestAnimationFrame`, `Date.now()` and CSS `transition`/`animation` all fail this test — see [Thinking in frames](thinking-in-frames.md).

## Checklist

- Anything particle-like on a `<Canvas2D>`, not in the DOM.
- Element count in the tens or low hundreds.
- Blur on a handful of elements; none inside a loop.
- 1920×1080 unless there is a reason.
- Ids on things a person would select, not on particles.
- Everything derived from the frame: no state, no clock, no unseeded randomness.
- Libraries built paused and seeked every frame, never played.

## What the checker catches

`check_film` in the MCP server (see [AI agents](ai-agents.md)) runs the type checker and a short list of habit rules over a film's source without executing it, so most of this page is enforced rather than remembered. It flags:

- `Array.from({ length: N })` with three or more digits — hundreds of elements or more, which belongs on a canvas.
- `setInterval` or `requestAnimationFrame` — a clock instead of the frame.
- `Date.now()`, `new Date()` or `performance.now()` — reading the real clock.
- `Math.random()` — use `seededRandom(seed)` so a frame always draws the same thing.
- `createNoise3D()` and friends called with no argument — an unseeded field is a different film every render.
- `.play()`, `.restart()` or `.resume()` — build a library's timeline paused and seek it.
- CSS `transition:`, `animation:` or `@keyframes` — the browser's clock, which will not match the export.
- `useState(` or `useReducer(` — state that accumulates across frames breaks scrubbing.
- A `textShadow`, `boxShadow`, `filter: blur` or `backdropFilter` inside a `.map()` or an `Array.from({ … }, callback)` — blur multiplied by a list.
- A film larger than 1920×1080.
- A prop in `defaultProps` with no control.

It also reports type errors against the real SDK declarations, and refuses imports outside the allowed set. Warnings are advice; errors are not. A deliberate 4K deliverable can ship with a warning against its name, but it should be deliberate.
