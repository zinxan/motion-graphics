---
title: Writing films with an AI agent
summary: The MCP server that gives a coding agent the authoring rules, the docs, the verified recipes and a checker for what it writes.
---
# Writing films with an AI agent

A film is a good thing to generate. Its inputs are JSON, its output is a typed React component, and correctness is mostly a matter of following a handful of rules. But an agent left to itself writes films that are slow, that flicker, or that render differently from the preview, and it does so for reasons that have nothing to do with how good it is at TypeScript.

**It cannot see the result.** Everything else follows from that. A person writes a blur, looks at it, and turns it down. An agent writes it and moves on.

**It reaches for a DOM element per thing.** Asked for rain, snow, stars or a particle field, the default answer is a `<div>` per particle with a glow on it. That is a thousand elements laid out and painted on every frame, and blur is the most expensive paint there is. It looks fine in a screenshot and takes an hour to render.

**It reaches for real clocks.** `Date.now()`, `setInterval`, `requestAnimationFrame`, a CSS `transition`, `useState` accumulating across renders, `timeline.play()`. All of them are how animation normally works on the web, and all of them are wrong here: a film must draw any frame on its own, in any order, because that is what scrubbing and rendering both do.

**It uses `Math.random()`** — a different picture on every render, so the preview and the export disagree.

**It copies the project's resolution.** ZXN Studio records at 4K, so an agent that has read the surrounding code authors a 3840×2160 film. Four times the pixels is four times the paint on every frame, for something a host was going to scale anyway.

None of that is fixed by a longer prompt. It is fixed by giving the agent the rules, the working examples and a checker, from one source of truth, over MCP.

## The server

`@zxn/motion-mcp` is a Model Context Protocol server, binary `zxn-motion-mcp`, that serves three things:

- **the authoring rules**, short enough to be read at the start of every session;
- **the documentation and the verified recipes** — the same files this site publishes and the test suite mounts, not a copy written for the agent. Nothing it is shown can be an example that has stopped working;
- **a checker** that type-checks source against the real `@zxn/motion-core` declarations and looks for the habits above. Nothing is executed.

### Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `authoring_rules` | — | The rules below, verbatim. |
| `search_docs` | `query` (string, 2+ chars), `limit` (1–12, default 6) | Matching doc sections and examples, best first. Doc hits are headed `## Title › Section (read_doc topic: topic)` and carry up to 1,200 characters of the section; example hits are headed with the id to pass to `get_example`. |
| `list_docs` | — | Every documentation topic with its title and summary. |
| `read_doc` | `topic` | The full Markdown of one topic. An unknown topic returns the list of valid ones. |
| `list_examples` | — | Every verified example with its summary, techniques and packages. |
| `get_example` | `id` | The complete source of one example, with its title, summary and path as a comment on top. |
| `check_film` | `entryFile`, `files` (a record of path → source) | Findings, or `No problems found.` |

`search_docs` splits a page at its `##` headings and scores sections, so a hit points at the paragraph that answers the question rather than at a page the agent then has to read. A section matching every term beats one that says a single term forty times.

`check_film` is the one to call often. `entryFile` is the file exporting `films`; `files` holds every source file keyed by its path relative to that file's directory. It reports:

- **errors** for type errors from the real SDK declarations, for an import a film may not use (it names what *is* available), for an `entryFile` missing from `files`, and for an entry file that does not `export const films =`;
- **warnings** for the habits, each with what to do instead.

The habits it detects, exactly:

- `Array.from({ length: N })` with N of three digits or more — hundreds of elements or more; use one `<Canvas2D>`.
- `setInterval(` or `requestAnimationFrame(` — timers run on a clock.
- `Date.now()`, `new Date()` or `performance.now()` — a film must not read the real clock.
- `Math.random()` — use `seededRandom(seed)`.
- `createNoise2D()`, `createNoise3D()` or `createNoise4D()` called with no argument — an unseeded noise function is a different field every render.
- `.play()`, `.restart()` or `.resume()` — build the library paused and seek it.
- A CSS `transition:`, `animation:` or `@keyframes` — driven by the browser's clock, not the frame.
- `useState(` or `useReducer(` — state that accumulates across frames breaks scrubbing.
- A `textShadow`, `boxShadow`, `filter: "blur…"` or `backdropFilter` appearing within about 1,200 characters after a `.map(` or an `Array.from({ … }, callback)` — a blur applied to every item of a list.
- A `width`/`height` pair of four or more digits each whose product exceeds 1920×1080 — larger than the film needs to be.
- A `defaultProps` key with no matching entry in `controls` — a prop that can only be changed by editing code.

The habit rules are patterns over the source with its comments blanked out, so a comment that says "never call `Date.now()`" is not reported as a call to it. They are still patterns: a method of your own called `play()` will be flagged, and that warning can be ignored.

Only source the agent supplied is reported; a library's own declarations are not its business. If `@zxn/motion-core` cannot be resolved beside the server or in the directory it was started from, types are not checked and the result says so rather than reporting no type errors. A package a film may import but which is not installed beside the checker, such as `lottie-web` in a fresh clone, is reported as a warning that its code could not be type-checked, not as an error in the film.

### The rules it serves

`authoring_rules` returns this, and the server also sends it as its MCP instructions, so a client that reads those has it before the first tool call.

```text
# Writing a ZXN Motion film

1. A film is a pure function of its props and an integer frame. Read the frame with useTimeline(); never a clock, a timer, state that accumulates, or Math.random(). Frames are requested in any order.
2. Export `const films = [defineFilm({ id, title, width, height, frameRate, frames, component, defaultProps, controls })]`. Author at 1920×1080 and 30 fps unless asked otherwise; a host scales the film.
3. Give every prop a control, so a person can change it without opening the code.
4. Few large elements, not thousands of small ones. Anything particle-like (rain, snow, stars, noise, a field of lines) goes on ONE <Canvas2D draw={(ctx, frame) => ...}>. Blur and shadows are the expensive paint: never inside a loop.
5. Use DOM or SVG for things a person would select: titles, bars, labels, shapes. Give those a stable data-zxn-element-id. Do not give ids to particles.
6. Libraries are seeked, never played: build a GSAP timeline paused and call timeline.seek(seconds); lottie.goToAndStop(frame, true). Seed any noise or random source with seededRandom().
7. Motion that reads well: ease everything (easing.easeOut in, easeIn out); springValue for arrivals with weight; hold long enough to read (about 1 s per 3 words); stagger related items 2–4 frames apart; move things far enough to notice, quickly enough to feel deliberate (a full-screen travel in 0.4–0.8 s).
8. Before proposing source: call search_docs for the technique, get_example for the nearest recipe, then check_film on what you wrote and fix every error and warning.
```

The list ends with the packages a film may import: `react`, `react/jsx-runtime`, `@zxn/motion-core`, `@zxn/motion-graphics`, `@zxn/motion-text`, `@zxn/ui`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `radix-ui`, `d3-scale`, `d3-shape`, `d3-interpolate`, `d3-ease`, `gsap`, `lottie-web`, `simplex-noise` and `culori`.

## Setup

The package is not on npm yet, so it runs from a clone. Node 22 or later.

```bash
git clone https://github.com/zinxan/motion-graphics.git
cd motion-graphics
npm install && npm run build
```

That produces `packages/mcp/dist/bin.js`. Run it with an absolute path — an agent's working directory is not yours.

Claude Code:

```bash
claude mcp add zxn-motion -- node /absolute/path/to/motion-graphics/packages/mcp/dist/bin.js
```

The same thing as a checked-in `.mcp.json` at the root of the project you are making films in:

```json
{
  "mcpServers": {
    "zxn-motion": {
      "command": "node",
      "args": ["/absolute/path/to/motion-graphics/packages/mcp/dist/bin.js"]
    }
  }
}
```

Cursor, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zxn-motion": {
      "command": "node",
      "args": ["/absolute/path/to/motion-graphics/packages/mcp/dist/bin.js"]
    }
  }
}
```

Any other stdio client wants the same two facts — command `node`, one argument, the absolute path to `bin.js`. The server talks MCP on stdout and prints `zxn-motion MCP server ready.` on stderr; a client that treats stderr as a failure is misreading it.

Run the server from the clone and it reads `docs/` and `examples/recipes/` directly, so editing a page is live without a rebuild. Keep the clone's `node_modules` in place: that is how `check_film` finds the SDK's declarations and can report type errors at all.

## The workflow

An agent that follows this order writes a good film on the first attempt more often than not.

1. **`authoring_rules`**, once per session, before writing anything.
2. **`search_docs`** for the technique — "canvas particles", "spring overshoot", "gsap seek", "tempo beats", "controls props". Broad and topic-like beats a sentence.
3. **`list_examples`**, then **`get_example`** for the nearest one. Starting from a working film beats starting from nothing, and the recipes already encode the decisions the rules only describe.
4. **Write** the film. One entry file exporting `films`, every prop given a control.
5. **`check_film`** on exactly what it is about to propose.
6. **Fix** every error and every warning, and check again. A warning always says what to do instead, so there is nothing to interpret.
7. **Propose** the source, and say which frames to look at. A person still has to watch it.

A prompt worth pasting:

> Write a ZXN Motion film: a 6-second title card for "Field Notes", dark, with a line of small drifting particles behind the type. Use the zxn-motion tools — read the authoring rules, search the docs for the technique, start from the nearest example, and run check_film on your source until it reports no problems before you show it to me. Then tell me which frames to scrub to.

Naming `check_film` in the prompt matters more than anything else in it.

## A rules file for your project

Put this in your `AGENTS.md` or `CLAUDE.md` so it applies without being asked.

```markdown
## Motion films

Films in this project are ZXN Motion films: a React component that is a pure
function of its props and an integer frame.

Before writing or editing one, use the `zxn-motion` MCP server:

- `authoring_rules` first, every session.
- `search_docs` for the technique, then `get_example` for the nearest recipe
  from `list_examples`. Start from a working film, not from nothing.
- `check_film` on the source before proposing it. Fix every error and every
  warning, then run it again. Do not show me source that has not passed.

Never use `Date.now()`, `setInterval`, `requestAnimationFrame`, `Math.random()`,
CSS transitions or `useState` in a film. Author at 1920×1080 and 30 fps.
Anything particle-like goes on one `<Canvas2D>`.
```

## What the checker catches

This is the film an unguided agent writes when asked for falling snow. It compiles, and every frame of it is wrong in a different way.

```tsx film expect-warnings
import { FullFrame, defineFilm, useTimeline } from "@zxn/motion-core";

type Props = { readonly color: string };

function Snow({ color }: Props) {
  const { frame } = useTimeline();
  const drift = Math.sin(Date.now() / 1000) * 20;
  const flakes = Array.from({ length: 1200 }, (_, index) => ({
    id: index,
    x: Math.random() * 3840,
    y: (Math.random() * 2160 + frame * 7) % 2160,
  }));

  return (
    <FullFrame style={{ background: "#0b1020" }}>
      {flakes.map((flake) => (
        <div
          key={flake.id}
          style={{
            position: "absolute",
            left: flake.x + drift,
            top: flake.y,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: color,
            textShadow: `0 0 14px ${color}`,
          }}
        />
      ))}
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "snow",
  title: "Snow",
  width: 3840,
  height: 2160,
  frameRate: 30,
  frames: 300,
  component: Snow,
  defaultProps: { color: "#ffffff" },
  controls: { color: { type: "color", label: "Flake" } },
})];
```

`check_film` on it:

```text
0 error(s), 6 warning(s).

WARNING film.tsx:8  This builds hundreds of elements or more. DOM costs layout and paint per element on every frame: draw a field of many things on one <Canvas2D> instead.
WARNING film.tsx:7  A film must not read the real clock. Use useTimeline().frame or useVirtualTime().seconds.
WARNING film.tsx:10  Math.random() differs on every render outside ZXN Studio's sandbox. Use seededRandom(seed) so a frame always draws the same thing.
WARNING film.tsx:11  Math.random() differs on every render outside ZXN Studio's sandbox. Use seededRandom(seed) so a frame always draws the same thing.
WARNING film.tsx:8  A blur or shadow is applied to every item of a list. Blur is the most expensive thing to paint; put one on a shared parent, or draw the list on a <Canvas2D>.
WARNING film.tsx:38  Larger than 1920×1080. A host scales a film to fit; four times the pixels is four times the paint on every frame. Author at 1920×1080 unless asked otherwise.
```

Six warnings, each naming its line and its remedy. The fix is one `<Canvas2D>` whose flake positions come from `seededRandom`, at 1920×1080 — which is the [matrix rain recipe](recipes.md#matrix-rain) with different glyphs, and why `get_example` comes before writing rather than after.

## What is not here yet

No tool renders frames and hands them back to the agent as images. Everything above narrows the gap between what an agent writes and what works; none of it closes the first and largest one, which is that the agent still cannot see its own film. It can be told that a blur is expensive; it cannot be told that the type is too small, that the exit is a beat late, or that the colour is ugly. A person has to watch it.

Frames back to the agent is the next thing to build. Until then: render the recipe, watch it, and say what is wrong.

## See also

- [Recipes](recipes.md) — the eight examples `get_example` serves.
- [Composition API](composition-api.md) — the reference the docs tools search.
- [Thinking in frames](thinking-in-frames.md) — why none of the rules above are negotiable.
- [Performance](performance.md) — what the habit warnings are protecting.
