---
title: Controls and props
summary: Why film props are JSON, how defaultProps and controls let a host draw an inspector, and what element ids are for.
---
# Controls and props

A film's inputs are its props. They are plain JSON, they have defaults, and they are described well enough that a host can draw an inspector for them. Get that right and a person who has never opened the file can change the name on a lower third, pick a side, and render it.

## Props are JSON, and that is a rule

A film's props are saved into project files, merged from a file on the command line (`--props ./props.json`), and posted between processes — the editor, the renderer's hidden window, the CLI. Everything on that journey is `JSON.stringify`. So the props have to survive it.

`packages/core/src/types.ts` says exactly what that means:

```ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
```

`defineFilm<Props extends JsonObject>` constrains your props to that, and it also checks at runtime — both when the film is defined and again on every `render()`. What is out:

- **Functions.** No render callbacks, no easing function passed in, no formatter. A film takes data and decides what to do with it.
- **Dates.** A `Date` survives `stringify` as a string and comes back as a string, which is a bug waiting for a timezone. Pass a number or an ISO string and parse it in the film.
- **Class instances.** `defineFilm` rejects any object whose prototype is not `Object.prototype` or `null`, because the class is not coming with it.
- **`undefined`, `NaN` and `Infinity`.** Only finite numbers; use `null` for "nothing".
- **Circular references.** Rejected by name rather than hanging.
- **React elements.** They are objects with functions in them. Compose in the film, not through props.

It fails loudly rather than dropping a key quietly, which is the point: a prop that vanished between the preview and the export is the worst kind of bug to find at the end of a render.

## defaultProps

Every prop needs a default, and the type says so — `defaultProps: Props`, not `Partial<Props>`. Two reasons. A film has to be renderable with no input at all, because a thumbnail, a test and an agent poking at it will all do exactly that. And `render()` merges: `{ ...defaultProps, ...inputProps }`, so a host may send only the keys a person touched.

Make the defaults a good film. They are what someone sees the first time they add it, and a default of `""` or `0` looks broken rather than empty.

## controls

`controls` is an optional map from prop name to a description of how to edit it. The type, in full:

```ts
type FilmControl = Readonly<{
  type: "text" | "number" | "color" | "boolean" | "choice";
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
}>;
```

Five types, one required `label`, and the rest apply where they make sense:

| Type | Prop type | Extra fields | Drawn as |
| --- | --- | --- | --- |
| `text` | `string` | — | A text field. |
| `number` | `number` | `min`, `max`, `step` | A slider or stepper, bounded. |
| `color` | `string` | — | A colour swatch and picker. |
| `boolean` | `boolean` | — | A switch. |
| `choice` | `string` | `options` | A menu of `options`. |

There is no `object` or `array` control, deliberately. A control is a thing a person can move; a list of data points is not.

**Every prop should have a control.** The controls are the whole difference between a film an editor can use and a film only its author can change. A prop without one is invisible in the inspector, so the only way to alter it is to edit the source or hand-write a props file — which is fine for a computed constant and wrong for anything a person would reach for.

`describeFilm(film)` carries `controls` through into the `FilmDescriptor`, which is what a host receives. ZXN Studio's inspector reads that map, draws one row per entry in the order the object declares, and sends back a partial props object containing only what changed. `min`, `max` and `step` bound the slider, so a film does not have to defend itself against a frame count of -3. Nothing in core draws any UI: core describes, the host decides.

## A lower third, read through its props

<video src="media/lower-third.mp4" poster="media/lower-third.jpg" controls muted loop playsinline width="720"></video>

`examples/recipes/lower-third.tsx` is the case controls were made for: a name strap that a producer will retype for every interview and never want to open a code editor for.

```tsx excerpt=examples/recipes/lower-third.tsx
export const lowerThirdFilm = defineFilm({
  id: "lower-third",
  title: "Lower third",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 150,
  component: LowerThird,
  defaultProps: { name: "Ada Okafor", role: "Lead Animator", accent: "#2ec4b6", side: "left" },
  controls: {
    name: { type: "text", label: "Name" },
    role: { type: "text", label: "Role" },
    accent: { type: "color", label: "Accent" },
    side: { type: "choice", label: "Side", options: ["left", "right"] },
  },
});
```

Four props, four controls, no gaps.

`side` is a `choice` rather than a boolean called `onTheRight`, because the label in the inspector then reads "Side: left / right" instead of asking someone to work out what false means. The prop's type is `string` — a `choice` is always a string, and the film compares it:

```tsx excerpt=examples/recipes/lower-third.tsx
  const direction = side === "right" ? 1 : -1;
```

The background is transparent. `<FullFrame>` here sets only layout and padding, no `background`, so rendered to a format with alpha the strap sits over footage in an edit:

```tsx excerpt=examples/recipes/lower-third.tsx
    <FullFrame style={{ alignItems: "flex-end", justifyContent: side === "right" ? "flex-end" : "flex-start", padding: "0 120px 130px" }}>
```

And the whole life of the text — in, hold, out — is one `mapRange` with four stops:

```tsx excerpt=examples/recipes/lower-third.tsx
  const text = mapRange(frame, [8, 22, last - 20, last - 8], [0, 1, 1, 0], { clamp: true, ease: easing.easeOut });
```

`mapRange` takes matching lists of two or more stops, so four in and four out describes rise, hold, fall on one line. The timing is readable at a glance and there is no chain of nested ternaries to get wrong. Note that the last two stops are derived from `film.frames`, not typed as literals: change the film's length and the exit still lands on the end.

## Numeric controls

<video src="media/elapsed-clock.mp4" poster="media/elapsed-clock.jpg" controls muted loop playsinline width="720"></video>

`examples/recipes/elapsed-clock.tsx` sweeps a clock from one time to another. Both times are numbers, so they get bounds:

```tsx excerpt=examples/recipes/elapsed-clock.tsx
  controls: {
    from: { type: "number", label: "From (hours)", min: 0, max: 24, step: 0.25 },
    to: { type: "number", label: "To (hours)", min: 0, max: 48, step: 0.25 },
    face: { type: "color", label: "Face" },
    accent: { type: "color", label: "Accent" },
    caption: { type: "text", label: "Caption" },
  },
```

`step: 0.25` is the meaning of the prop showing through: the hours carry a decimal part, and a quarter of an hour is the unit anyone would actually want. `max: 48` on `to` and `24` on `from` allows a sweep past midnight without allowing a start time that does not exist. The labels say "(hours)" because `from` and `to` alone could be anything.

The film documents the unit on the type as well, which is where a person reading the code will look:

```tsx excerpt=examples/recipes/elapsed-clock.tsx
  /** 24-hour start and end, as hours with a decimal part: 9.5 is 09:30. */
  readonly from: number;
  readonly to: number;
```

## Element ids

Two data attributes mark the parts of a film a person might want to address individually:

- `data-zxn-element-id` — a stable id, unique within the film.
- `data-zxn-name` — a human label for it, for a list in a host's UI.

```tsx excerpt=examples/recipes/lower-third.tsx
      <div data-zxn-element-id="strap" style={{ display: "flex", alignItems: "stretch", transform: `translateX(${direction * ((1 - slide) * 140 + leave * 140)}px)`, opacity: Math.min(slide * 1.4, 1 - leave) }}>
        <div data-zxn-element-id="rule" style={{ width: 12, background: accent, borderRadius: 6, transform: `scaleY(${slide})`, transformOrigin: "50% 100%" }} />
```

A host that knows those ids can let someone click the role line in the preview and keyframe its opacity, or nudge the strap two frames later, without touching anything else. Without them the film is one opaque rectangle.

Two things make an id useful:

**Stable.** The same element carries the same id on every frame and across renders. `bar-${name}` in the chart race is keyed to the data, not to an array position, so a bar that overtakes another keeps its id. An id derived from a loop index would hand a person's keyframes to a different bar the moment the order changed.

**Meaningful.** Put them on the things a person would point at: the title, the strap, the rule, a bar, a callout. Roughly a dozen per film is the right order of magnitude.

**Do not put them on particles.** A rain field, a starfield, a noise field — anything drawn in a loop of hundreds — gets no ids. Nobody is going to select the four hundredth raindrop, the attributes cost DOM on every frame, and a field like that should be one `<Canvas2D>` anyway, where there are no elements to label. See [canvas](canvas.md) and [performance](performance.md).

## A card with all five controls

Every prop here is adjustable, and the film derives everything from the frame.

```tsx film
import { FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@zxn/motion-core";

/*
 * A stat card: one number, said well.
 *
 * Every prop has a control, so the whole card is editable from an inspector --
 * the wording, the figure, the colour, whether the change chip is shown, and
 * which corner it sits in. Nothing is a constant that only the author can reach.
 */

type Props = {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly change: number;
  readonly accent: string;
  readonly showChange: boolean;
  readonly corner: string;
};

function StatCard({ label, value, unit, change, accent, showChange, corner }: Props) {
  const { frame, film } = useTimeline();
  const last = film.frames - 1;
  const rise = springValue({ frame, frameRate: film.frameRate, stiffness: 140, damping: 18, clamp: true });
  const leave = mapRange(frame, [last - 14, last], [0, 1], { clamp: true, ease: easing.easeIn });
  // The figure counts up, then holds long enough to be read.
  const count = mapRange(frame, [10, 58], [0, value], { clamp: true, ease: easing.easeOut });
  const chip = mapRange(frame, [52, 68], [0, 1], { clamp: true, ease: easing.easeOut });
  const onRight = corner === "right";

  return (
    <FullFrame style={{ background: "#0f1117", alignItems: "center", justifyContent: onRight ? "flex-end" : "flex-start", padding: "0 160px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div
        data-zxn-element-id="card"
        data-zxn-name="Stat card"
        style={{
          width: 760, padding: "56px 64px 62px", borderRadius: 32,
          background: "rgba(255,255,255,.04)", border: `2px solid ${accent}`,
          opacity: Math.min(rise, 1 - leave),
          transform: `translateY(${(1 - rise) * 60 + leave * 40}px)`,
        }}
      >
        <div data-zxn-element-id="label" style={{ fontSize: 38, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(243,239,231,.55)" }}>{label}</div>
        <div data-zxn-element-id="figure" style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 14, color: "#f3efe7" }}>
          <span style={{ fontSize: 190, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.round(count)}</span>
          <span style={{ fontSize: 76, fontWeight: 700, color: accent }}>{unit}</span>
        </div>
        {showChange ? (
          <div
            data-zxn-element-id="change"
            data-zxn-name="Change chip"
            style={{
              marginTop: 26, display: "inline-flex", alignItems: "center", gap: 12,
              padding: "12px 26px", borderRadius: 999, fontSize: 36, fontWeight: 700,
              background: change < 0 ? "rgba(255,111,97,.16)" : "rgba(46,196,182,.16)",
              color: change < 0 ? "#ff6f61" : "#2ec4b6",
              opacity: chip, transform: `translateY(${(1 - chip) * 16}px)`,
            }}
          >
            <span>{change < 0 ? "▼" : "▲"}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.abs(change)}%</span>
            <span style={{ fontWeight: 500, opacity: 0.75 }}>on last quarter</span>
          </div>
        ) : null}
      </div>
    </FullFrame>
  );
}

export const films = [defineFilm({
  id: "stat-card",
  title: "Stat card",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 120,
  component: StatCard,
  defaultProps: { label: "Renders this month", value: 1284, unit: "clips", change: 23, accent: "#7a6cff", showChange: true, corner: "left" },
  controls: {
    label: { type: "text", label: "Label" },
    value: { type: "number", label: "Value", min: 0, max: 100000, step: 1 },
    unit: { type: "text", label: "Unit" },
    change: { type: "number", label: "Change (%)", min: -100, max: 100, step: 1 },
    accent: { type: "color", label: "Accent" },
    showChange: { type: "boolean", label: "Show change" },
    corner: { type: "choice", label: "Corner", options: ["left", "right"] },
  },
})];
```

<video src="media/stat-card.mp4" poster="media/stat-card.jpg" controls muted loop playsinline width="720"></video>

Seven props, seven controls. `change` is signed and the film picks both the arrow and the colour from its sign, so one number carries the whole idea; a separate `isNegative` boolean would be a second source of truth to keep in step. `showChange` is a boolean because it is genuinely two-state; `corner` is a choice because "left or right" has names.

## Props on the command line

The CLI merges a JSON file over the defaults, so the same film renders a hundred cards from a hundred files:

```bash
zxn-motion render ./films.tsx stat-card ./out/q3.mp4 --props ./q3.json
```

```json
{ "label": "Renders in Q3", "value": 4102, "change": -6, "corner": "right" }
```

Only the keys you send are overridden. The file must be a JSON object, and a value that is not JSON is an error, not a coercion.

## Next

- [Composition API](composition-api.md): the full reference for films, time and animation maths.
- [Using packages](using-packages.md): driving d3, GSAP and friends from the frame.
- [Interface films](interface-films.md): stage, camera and pointer, where ids do a second job.
- [Recipes](recipes.md): every example quoted here, in full.
