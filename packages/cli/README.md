# `@matildeene/motion-cli`

The ZXN Motion CLI bundles a typed film entry and renders one film to MP4/H.264, QuickTime MOV/H.264 or WebM/VP9 in a sandboxed, hidden Electron window. It uses the same deterministic frame renderer as ZXN Studio.

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
| `--force` | Replaces an existing output file. |
The CLI refuses to replace a file unless `--force` is present and keeps the previous file until its replacement has rendered. Film props must be a JSON object. Codec availability depends on the host operating system and Electron build; the CLI fails instead of substituting another codec.
