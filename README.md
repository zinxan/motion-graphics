# ZXN Motion Graphics

**Motion graphics as React components, rendered frame by frame.** Write a film as a typed component, scrub it in a browser player, and render the very same tree to MP4, MOV or WebM. Every frame is a pure function of its props and an integer frame number, so what you preview is exactly what you export.

This is the open-source film stack behind [ZXN Studio](https://zxn.studio), a desktop screen recorder and video editor. MIT licensed: use it in anything, commercial or not, with no company licence to buy.

```tsx
import { Cue, FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@zxn/motion-core";

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
zxn-motion render ./films.tsx title ./out/title.mp4
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
| [`@zxn/motion-core`](packages/core) | `defineFilm`, the frame context (`useTimeline`, `useVirtualTime`, `useTempo`), timing primitives (`Cue`, `Hold`, `Repeat`, `FullFrame`), animation maths (`mapRange`, `springValue`, `easing`, `seededRandom`), and the interface-film kit: `Stage`, `Camera`, `Pointer`, `Footage`. |
| [`@zxn/motion-player`](packages/player) | `<FilmPlayer>`: play, pause, seek and loop a film in the browser. Ships its own small CSS; no Tailwind needed. |
| [`@zxn/motion-renderer`](packages/renderer) | `renderFilm()`: commits each exact frame, rasterises the DOM and encodes H.264 or VP9 through WebCodecs. `canRenderFilm()` checks device support before any work starts. |
| [`@zxn/motion-cli`](packages/cli) | `zxn-motion render <entry> <film> <output>`: bundles a film entry and renders it in a sandboxed, hidden Electron window. |
| [`@zxn/motion-graphics`](packages/graphics) | Declarative, frame-deterministic charts and callouts. Definitions are plain data, so they are safe to generate. |
| [`@zxn/motion-text`](packages/text) | Serializable 2D text styles (gradients, strokes, shadows, letter spacing) with one renderer for canvas and export. No React dependency. |

Dependencies point inward: CLI → Renderer / Player → Core. Graphics and Text stand alone.

## Getting started

Requires Node 22+.

```bash
git clone https://github.com/zinxan/motion-graphics.git
cd motion-graphics
npm install
npm run check      # typecheck, tests, build
```

Preview a film in your own React app:

```tsx
import { describeFilm } from "@zxn/motion-core";
import { FilmPlayer } from "@zxn/motion-player";
import "@zxn/motion-player/player.css";
import { films } from "./films";

export const Preview = () => <FilmPlayer film={describeFilm(films[0]!)} loop />;
```

Render it in the browser:

```ts
import { canRenderFilm, renderFilm } from "@zxn/motion-renderer";

import { describeFilm } from "@zxn/motion-core";
import { films } from "./films";

const film = describeFilm(films[0]!);
if (await canRenderFilm(film, "mp4-h264")) {
  const bytes = await renderFilm({ film, format: "mp4-h264" });   // also "mov-h264", "webm-vp9"
}
```

Or from the command line. The file extension picks the preset, and an existing file is only replaced with `--force`:

```bash
zxn-motion render ./films.tsx title ./out/title.webm --props ./props.json
```

## Learn the API

- [Composition API](docs/composition-api.md): films, timing, animation maths, stage and camera, pointer, tempo, footage.
- [`examples/`](examples): `kinetic-type.tsx` (springs and cues), `coding-tutorial.tsx`, `cinematic-overlay.tsx`.

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

`0.1.0`: a working vertical slice, used in production inside ZXN Studio. Expect the API to move before 1.0. Not yet published to npm; build from source for now.

Known limits: rendering rasterises the DOM, so very heavy DOM (thousands of blurred text nodes at 4K) is slow, and a canvas drawing primitive is planned. Audio is out of scope for a film; sound belongs on a timeline. `<Footage>` needs a frame provider, which the CLI installs and other hosts must supply.

## Contributing

Issues and pull requests are welcome. Run `npm run check` before opening one. Please do not contribute code copied from a project whose licence is not MIT-compatible.

## Licence

[MIT](LICENSE) © 2026 Zinxan and the ZXN Motion Graphics contributors.
