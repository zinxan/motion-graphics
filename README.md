# ZXN Motion Graphics

**Motion graphics as React components, rendered frame by frame.** Write a film as a typed component, scrub it in a browser player, and render the very same tree to MP4, MOV or WebM. Every frame is a pure function of its props and an integer frame number, so what you preview is exactly what you export.

This is the open-source film stack behind [ZXN Studio](https://zxn.studio), a desktop screen recorder and video editor. MIT licensed: use it in anything, commercial or not, with no company licence to buy.

```tsx
import { Cue, FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@matildeene/motion-core";

function Title({ text, accent }: { readonly text: string; readonly accent: string }) {
  const { frame, film } = useTimeline();
  const enter = springValue({ frame, frameRate: film.frameRate, stiffness: 125, damping: 16, clamp: true });
  const leave = mapRange(frame, [70, 85], [1, 0], { clamp: true, ease: easing.easeIn });
  return (
    <FullFrame style={{ background: "#0b0c0e", alignItems: "center", justifyContent: "center", opacity: leave }}>
      <h1 style={{ color: accent, fontSize: 160, transform: `translateY(${(1 - enter) * 80}px)` }}>{text}</h1>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "title",
  title: "Title",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 90,
  component: Title,
  defaultProps: { text: "Hello", accent: "#7a6cff" },
})];
```

```bash
npm exec -- zxn-motion render ./films.tsx title ./out/title.mp4
```

## Why another one

- **Exact frames, not wall-clock time.** A film never reads a clock. `useTimeline()` hands it an integer frame; frame 47 is frame 47 in the player, in the editor and in the export. Springs are closed-form (`springValue`), so scrubbing to the middle of one gives the same picture a sequential render does.
- **One tree drives preview and render.** The player and the renderer both mount `FilmSurface`. There is no second implementation to drift.
- **It fails instead of guessing.** An unsupported codec, a missing asset or a frame that cannot be produced is an error with a name on it, never a silently substituted format or a black rectangle that looks deliberate.
- **Props are JSON.** Film inputs cross every boundary as plain data, which makes films easy to drive from a timeline, a CLI, a test or an AI.
- **Small and layered.** Core has no player, renderer, Electron or filesystem dependency. Take only the layer you need.

## Packages

| Package | What it is |
| --- | --- |
| [`@matildeene/motion-core`](packages/core) | `defineFilm`, the frame context (`useTimeline`, `useVirtualTime`, `useTempo`), timing primitives (`Cue`, `Hold`, `Repeat`, `FullFrame`), `Canvas2D` for anything particle-like, animation maths (`mapRange`, `springValue`, `easing`, `seededRandom`), and the interface-film kit: `Stage`, `Camera`, `Pointer`, `Footage`. |
| [`@matildeene/motion-player`](packages/player) | `<FilmPlayer>`: play, pause, seek and loop a film in the browser. Ships its own small CSS; no Tailwind needed. |
| [`@matildeene/motion-renderer`](packages/renderer) | `renderFilm()`: commits each exact frame, rasterises the DOM and encodes H.264 or VP9 through WebCodecs. `canRenderFilm()` checks device support before any work starts. |
| [`@matildeene/motion-cli`](packages/cli) | `zxn-motion render <entry> <film> <output>`: bundles a film entry and renders it in a sandboxed, hidden Electron window. |
| [`@matildeene/motion-graphics`](packages/graphics) | Declarative, frame-deterministic charts and callouts. Definitions are plain data, so they are safe to generate. |
| [`@matildeene/motion-mcp`](packages/mcp) | A Model Context Protocol server for AI agents: the docs, the verified examples and a film checker. |
| [`@matildeene/motion-text`](packages/text) | Serializable 2D text styles (gradients, strokes, shadows, letter spacing) with one renderer for canvas and export. No React dependency. |

Dependencies point inward: CLI → Renderer / Player → Core. Graphics, Text and the MCP server stand alone.

## Getting started

Requires Node 22.12+. In an existing React project:

```bash
npm install @matildeene/motion-core @matildeene/motion-player @matildeene/motion-renderer
npm install --save-dev @matildeene/motion-cli
```

To develop the packages or run the example films from this repository:

```bash
git clone https://github.com/zinxan/motion-graphics.git
cd motion-graphics
npm install
npm run check      # typecheck, tests, build
```

Preview a film in your own React app:

```tsx
import { describeFilm } from "@matildeene/motion-core";
import { FilmPlayer } from "@matildeene/motion-player";
import "@matildeene/motion-player/player.css";
import { films } from "./films";

export const Preview = () => <FilmPlayer film={describeFilm(films[0]!)} loop />;
```

Render it in the browser:

```ts
import { canRenderFilm, renderFilm } from "@matildeene/motion-renderer";

import { describeFilm } from "@matildeene/motion-core";
import { films } from "./films";

const film = describeFilm(films[0]!);
if (await canRenderFilm(film, "mp4-h264")) {
  const bytes = await renderFilm({ film, format: "mp4-h264" });   // also "mov-h264", "webm-vp9"
}
```

Or from the command line. The file extension picks the preset, and an existing file is only replaced with `--force`:

```bash
npm exec -- zxn-motion render ./films.tsx title ./out/title.webm --props ./props.json
```

## Recipes

Nine example films, each there to teach one technique done properly. Every one is mounted at several frames by the test suite and rendered to video, so they are known to work.

[![Cartoon television](docs/media/retro-tv.jpg)](docs/recipes.md)

| Recipe | What it shows |
| --- | --- |
| [Matrix rain](examples/recipes/matrix-rain.tsx) | A field of thousands of glyphs on one `<Canvas2D>`, seeded per column, stepping a cell at a time. |
| [Cartoon television](examples/recipes/retro-tv.tsx) | SVG with squash and stretch and follow-through, canvas static, a play button that gets pressed. |
| [Elapsed clock](examples/recipes/elapsed-clock.tsx) | "Three hours later": an analogue clock sweeping between two times. |
| [Bar chart race](examples/recipes/bar-chart-race.tsx) | `d3-scale` and `d3-interpolate` as pure functions of the frame. |
| [Noise field](examples/recipes/noise-field.tsx) | Seeded `simplex-noise`, with time as the third axis. |
| [GSAP title](examples/recipes/gsap-title.tsx) | A paused GSAP timeline the film seeks every frame: seek, never play. |
| [Lower third](examples/recipes/lower-third.tsx) | A transparent name strap driven entirely by controls. |
| [Beat pulse](examples/recipes/beat-pulse.tsx) | Cuts on bars and a pulse on beats from the film's tempo; OKLCH colour with `culori`. |
| [Rocket launch](examples/recipes/rocket-launch.tsx) | A countdown, ignition, and a trajectory that draws itself behind the rocket. |

```bash
npm exec -- zxn-motion render examples/recipes/retro-tv.tsx retro-tv out/retro-tv.mp4
```

For a larger scene that combines those techniques, try [Tiny Cosmic Disco](examples/tiny-cosmic-disco.tsx): a dancing planet DJ, spinning disco ball, seeded stars, pulsing speakers and a spring-driven title reveal. [Watch the rendered film and read the breakdown](docs/recipes.md#tiny-cosmic-disco-showcase).

```bash
npm exec -- zxn-motion render examples/tiny-cosmic-disco.tsx tiny-cosmic-disco out/tiny-cosmic-disco.mp4
```

## Documentation

Every code block in the docs is compiled: complete films are type-checked against the SDK and must pass the film checker, and quoted excerpts must still match the example they came from (`npm run docs:verify`).

- [Getting started](docs/getting-started.md) and [Thinking in frames](docs/thinking-in-frames.md): the model, and how to make motion read well.
- [Controls and props](docs/controls-and-props.md), [Canvas](docs/canvas.md), [Using packages](docs/using-packages.md), [Tempo and music](docs/tempo-and-music.md), [Interface films](docs/interface-films.md).
- [Performance](docs/performance.md): what makes a film slow, and a budget.
- [Recipes](docs/recipes.md): the gallery, with video.
- [Writing films with an AI agent](docs/ai-agents.md): the MCP server, its tools, and a rules file for your project.
- [Composition API](docs/composition-api.md): the reference.

## Design rules

1. One React tree drives preview and render.
2. Time is an explicit integer frame, never wall-clock state inside a film.
3. Film inputs cross boundaries as JSON.
4. Rendering either produces the requested artifact or fails explicitly.
5. Packages depend inward.

## Relationship to Remotion

ZXN Motion Graphics shares one idea with [Remotion](https://www.remotion.dev) and every other video-as-code tool: a film is a function of a frame number. That idea is not anyone's property. Everything else here was written independently:

- No Remotion source, package, asset or documentation is used or copied, and there is no dependency on it.
- The API is its own and makes no attempt at compatibility: `defineFilm`, `useTimeline`, `Cue`, `Hold`, `springValue` and `mapRange`, not Remotion's hooks and components.
- The licence is different in kind. Remotion is source-available under a company licence; this project is MIT.

If you want Remotion's ecosystem, cloud rendering and years of polish, use Remotion, it is excellent. If you want a small MIT-licensed core you can embed in a product without a licence conversation, this is for you.

## Status

The `0.1.x` packages are published on npm. This is a working vertical slice used inside ZXN Studio; expect the API to move before 1.0.

Known limits: rendering rasterises the DOM, so very heavy DOM (thousands of blurred text nodes at 4K) is slow; draw anything particle-like on a single `<Canvas2D>` instead. Audio is out of scope for a film; sound belongs on a timeline. `<Footage>` needs a frame provider, which the CLI installs and other hosts must supply.

## Contributing

Issues and pull requests are welcome. Run `npm run check` before opening one. Please do not contribute code copied from a project whose licence is not MIT-compatible.

## Licence

[MIT](LICENSE) © 2026 Zinxan and the ZXN Motion Graphics contributors.
