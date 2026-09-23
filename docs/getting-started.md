---
title: Getting started
summary: Install the packages, write your first film, preview it in the browser player, and render it to MP4 or WebM from code or the command line.
---
# Getting started

A film is a React component that draws one frame: it is handed an integer frame number and some JSON props, and it returns the picture for exactly that frame. Because a film never reads a clock or keeps state between frames, frame 47 looks the same whether you scrubbed to it, played into it or exported it.

That is the whole idea. Everything else here — the player, the renderer, the CLI — is machinery for asking a film for frames and doing something with the answers.

<video src="media/lower-third.mp4" poster="media/lower-third.jpg" controls muted loop playsinline width="720"></video>

## Install

You need Node 22.12 or newer. In an existing React project, install the packages you need:

```bash
npm install @matildeene/motion-core @matildeene/motion-player @matildeene/motion-renderer
npm install --save-dev @matildeene/motion-cli
```

For the example films and development tooling, clone the public repository:

```bash
git clone https://github.com/zinxan/motion-graphics.git
cd motion-graphics
npm install
npm run check      # typecheck, tests, build
```

The clone links its workspace packages together. Work in `examples/`, or use the published packages in your own app.

## Your first film

A film is `defineFilm({...})` wrapped around a component. The definition carries the facts a host needs before it renders anything: the size, the frame rate, how many frames there are, and the props the component expects. An entry module exports them as an array named `films`.

```tsx film
import { FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@matildeene/motion-core";

type Props = {
  readonly headline: string;
  readonly subtitle: string;
  readonly accent: string;
};

function Opener({ headline, subtitle, accent }: Props) {
  const { frame, film } = useTimeline();
  const last = film.frames - 1;
  const rise = springValue({ frame, frameRate: film.frameRate, stiffness: 150, damping: 18, clamp: true });
  const sub = mapRange(frame, [10, 26], [0, 1], { clamp: true, ease: easing.easeOut });
  const out = mapRange(frame, [last - 18, last], [1, 0], { clamp: true, ease: easing.easeIn });

  return (
    <FullFrame style={{ background: "#0b0c0e", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, opacity: out }}>
      <h1 style={{ margin: 0, fontFamily: "Inter, system-ui, sans-serif", fontSize: 150, fontWeight: 900, letterSpacing: "-0.04em", color: "#f3efe7", transform: `translateY(${(1 - rise) * 90}px)` }}>
        {headline}
      </h1>
      <p style={{ margin: 0, fontFamily: "Inter, system-ui, sans-serif", fontSize: 52, fontWeight: 500, color: accent, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        {subtitle}
      </p>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "opener",
  title: "Opener",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 120,
  component: Opener,
  defaultProps: { headline: "Frame by frame", subtitle: "A film is a function of time", accent: "#7a6cff" },
  controls: {
    headline: { type: "text", label: "Headline" },
    subtitle: { type: "text", label: "Subtitle" },
    accent: { type: "color", label: "Accent" },
  },
})];
```

<video src="media/opener.mp4" poster="media/opener.jpg" controls muted loop playsinline width="720"></video>

Four things in that file are worth naming.

`useTimeline()` returns `{ frame, absoluteFrame, film }`. `frame` is the frame being drawn, `film` carries `width`, `height`, `frameRate` and `frames`. Nothing else in the component knows what time it is.

`<FullFrame>` fills the film and is a flex container, which is why `alignItems` and `justifyContent` centre the text.

`springValue` and `mapRange` turn the frame number into the numbers the style needs. `springValue` is closed-form: it solves the spring's position at a frame rather than stepping a simulation forwards, so scrubbing into the middle of one gives the same picture a sequential render does. `mapRange` takes matching lists of two or more stops, so one call can describe an in, a hold and an out.

`controls` describes each prop to a host that wants to draw an inspector — `text`, `number`, `color`, `boolean` or `choice`. Give every default prop a control and an editor can change the film without opening the code. Props have to be JSON, because they are saved in project files, passed on a command line and sent between processes.

At 30 fps, `frames: 120` is a four-second film.

## Preview it

`@matildeene/motion-player` gives you `<FilmPlayer>`: a viewport that scales the film to fit, a play/pause button, a restart and a scrubber. It takes a `FilmDescriptor`, which is what `describeFilm()` returns.

```tsx
import { describeFilm } from "@matildeene/motion-core";
import { FilmPlayer } from "@matildeene/motion-player";
import "@matildeene/motion-player/player.css";
import { films } from "./films";

export const Preview = () => <FilmPlayer film={describeFilm(films[0]!)} loop />;
```

`controls={false}` hides the transport, `inputProps` overrides the film's defaults, and `onFrameChange` tells you where the playhead is. The player ships its own small stylesheet; there is no Tailwind to configure.

Drag the scrubber. A film that looks right playing and wrong under a scrub is a film that is reading something other than the frame, and that is the bug the whole design exists to make visible early.

## Render it in the browser

`@matildeene/motion-renderer` mounts the same tree the player mounts, commits each exact frame, rasterises the DOM and encodes it through WebCodecs. Ask first whether the device can encode what you want:

```ts
import { canRenderFilm, renderFilm } from "@matildeene/motion-renderer";
import { describeFilm } from "@matildeene/motion-core";
import { films } from "./films";

const film = describeFilm(films[0]!);
if (await canRenderFilm(film, "mp4-h264")) {
  const bytes = await renderFilm({
    film,
    format: "mp4-h264",                      // also "mov-h264", "webm-vp9"
    onProgress: ({ ratio }) => console.log(ratio),
  });
}
```

`renderFilm` resolves to a `Uint8Array` of the finished file. It also takes `inputProps` and an `AbortSignal` as `signal`. If the device cannot encode the format, or a frame throws, or the encoder returns nothing, it rejects with an error that names the problem. It does not fall back to another codec and it does not hand you a black frame — a substituted format that nobody asked for is worse than a failure.

## Render it from the command line

`@matildeene/motion-cli` bundles a film entry and renders it in a sandboxed, hidden Electron window, which is the right shape for CI and for scripts.

```bash
npm exec -- zxn-motion render ./films.tsx opener ./out/opener.mp4
npm exec -- zxn-motion render ./films.tsx opener ./out/opener.webm --props ./props.json
npm exec -- zxn-motion render ./films.tsx opener ./out/opener.mp4 --force
```

The three positional arguments are the entry module, the film's `id` and the output path. The extension picks the preset: `.mp4` and `.mov` are H.264, `.webm` is VP9. Anything else is an error rather than a guess.

`--props <file.json>` merges a JSON object into the film's `defaultProps`. `--force` is required to replace a file that already exists, and the previous file is kept until its replacement has rendered. `--footage <id>=<file>` supplies a video for each `<Footage asset="id" />` in the film; the flag repeats, once per asset. `--help` prints the rest.

Codec availability depends on the host operating system and the Electron build. As in the browser, the CLI fails and says so rather than substituting a codec.

## How the packages fit together

| Package | What it gives you |
| --- | --- |
| `@matildeene/motion-core` | `defineFilm`, the frame hooks, the timing primitives, the animation maths, `Canvas2D`, and the interface-film kit: `Stage`, `Camera`, `Pointer`, `Footage`. |
| `@matildeene/motion-player` | `<FilmPlayer>`: play, pause, seek and loop in the browser. |
| `@matildeene/motion-renderer` | `renderFilm()` and `canRenderFilm()`. |
| `@matildeene/motion-cli` | `zxn-motion render`. |
| `@matildeene/motion-graphics` | Declarative, frame-deterministic charts and callouts. |
| `@matildeene/motion-text` | Serializable 2D text styles, with one renderer for canvas and export. |

Dependencies point inward: CLI → renderer and player → core. Core has no player, renderer, Electron or filesystem dependency, so a host that only needs to define and mount films takes core alone.

The player and the renderer both mount `FilmSurface`, the same component, at one exact frame. That is why the preview and the export agree: there is no second implementation to drift.

## Where to go next

- [Thinking in frames](thinking-in-frames.md) — the mental model, the timing primitives, and how to make motion read well.
- [Composition API](composition-api.md) — the reference: films, time, stage and camera, pointer, tempo, footage.
- [Controls and props](controls-and-props.md) — designing a film's inputs so a person or a machine can drive it.
- [Canvas](canvas.md) — when DOM is the wrong tool and `<Canvas2D>` is the right one.
- [Using packages](using-packages.md) — d3, GSAP, Lottie, simplex-noise and culori inside a film.
- [Tempo and music](tempo-and-music.md) — cutting to bars and beats.
- [Interface films](interface-films.md) — stage, camera and pointer for showing software.
- [Performance](performance.md) — what a frame costs and how to spend less.
- [Recipes](recipes.md) — nine verified recipes and the Tiny Cosmic Disco showcase film to read and remix.
- [AI agents](ai-agents.md) — generating films, and the checker that grades them.
