# `@matildeene/motion-cli`

The ZXN Motion CLI bundles a typed film entry and renders one film to MP4/H.264, QuickTime MOV/H.264 or WebM/VP9 in a sandboxed, hidden Electron window. It commits each exact film frame and captures Chromium’s native compositor, keeping fonts, images, SVG, CSS and canvas content in the normal browser paint path.

Requires Node 22.12 or newer. In a project that has a film entry:

```bash
npm install --save-dev @matildeene/motion-cli
```

## Entry contract

```tsx
import { defineFilm } from "@matildeene/motion-core";

const intro = defineFilm({
  id: "intro",
  title: "Intro",
  width: 1280,
  height: 720,
  frameRate: 30,
  frames: 150,
  component: Intro,
  defaultProps: { title: "Hello" },
});

export const films = [intro];
```

## Render

```bash
npm exec -- zxn-motion render ./films.tsx intro ./out/intro.mp4
npm exec -- zxn-motion render ./films.tsx intro ./out/intro.webm
npm exec -- zxn-motion render ./films.tsx intro ./out/intro.mp4 --props ./props.json --force
```

The extension selects the exact preset: `.mp4`, `.mov` or `.webm`.

| Option | What it does |
| --- | --- |
| `--props <file.json>` | Merges a JSON object into the film's `defaultProps`. |
| `--footage <id=file>` | Supplies the video for `<Footage asset="id" />`. Repeatable. |
| `--css <file.css>` | Loads a stylesheet beside the film. |
| `--app-root <dir>` | Resolves the `@/` alias, for films that import an app's own components. |
| `--memory-limit <MiB>` | Stops the Electron process tree above this resident-memory ceiling (default: 2048 MiB; minimum: 128). |
| `--force` | Replaces an existing output file. |
The CLI refuses to replace a file unless `--force` is present and keeps the previous file until its replacement has rendered. Film props must be a JSON object. Codec availability depends on the host operating system and Electron build; the CLI fails instead of substituting another codec.

Output streams to a temporary file with backpressure and positioned writes, then commits only after encoding succeeds. Frame captures are sequential and reuse the browser canvas. Only one CLI render can run per user at a time; a second job fails explicitly. Cancellation, renderer failure, timeout, parent termination and the memory ceiling stop the job and discard its partial output. The ceiling samples the aggregate Electron process working set every 250 ms; it is a guard, not an exact allocation quota. The bundling Node process is outside that measurement.

Each job reports its sampled peak as `ZXN_MEMORY peak=…MiB limit=…MiB`. Keep the default ceiling unless a measured workload needs more; increasing it permits more memory use.

After building, run the opt-in Electron integration tests with `ZXN_RENDER_INTEGRATION=1 npx vitest run packages/cli/src/render-cli.integration.test.ts --maxWorkers=1`. They exercise all containers, footage, memory-limit cleanup, overlap prevention, cancellation and film errors. They require a desktop Electron environment with H.264 and VP9 encoding support.
