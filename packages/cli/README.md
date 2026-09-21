# `@zxn/motion-cli`

The ZXN Motion CLI bundles a typed film entry and renders one film to MP4/H.264 or WebM/VP9 in a sandboxed, hidden Electron window. It uses the same deterministic frame renderer as ZXN Studio.

## Entry contract

```tsx
import { defineFilm } from "@zxn/motion-core";

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
zxn-motion render ./films.tsx intro ./out/intro.mp4
zxn-motion render ./films.tsx intro ./out/intro.webm
zxn-motion render ./films.tsx intro ./out/intro.mp4 --props ./props.json --force
```

The extension selects the exact preset. The CLI refuses to replace a file unless `--force` is present and keeps the previous file until its replacement has rendered. Film props must be a JSON object. Codec availability depends on the host operating system and Electron build; the CLI fails instead of substituting another codec.
