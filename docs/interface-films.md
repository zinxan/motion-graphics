---
title: Interface films
summary: Product tours and feature walkthroughs: a fixed board, a shot list that names what to look at, and a cursor a control can read its own pressed state from.
---
# Interface films

A film that shows an interface is a different job from a title card. Something has to be placed, something has to look at it, and a cursor has to travel to it and press it — and all three have to agree about where "it" is. The stage kit is three components and one rule: say where everything is once, in board pixels, and let the camera and the cursor read that table.

Everything here comes from `@zxn/motion-core`.

## The board

`<Stage width height layout>` is a fixed-size board in its own coordinate space. `layout` is one table of `{ x, y, width, height }` rects keyed by id, and `<StageItem id>` draws itself at the rect its id names.

```tsx
const layout = {
  window: { x: 160, y: 120, width: 1600, height: 840 },
  "export-button": { x: 1568, y: 146, width: 160, height: 44 },
};
```

A stage with no `shots` is just a board: items sit at their rects and the film is drawn at 1:1. Given `shots`, the stage puts a `<Camera>` in front of the board and passes its layout through, so shots and pointer keys can name ids. `<StageItem>` throws if its id has no entry, naming the id, rather than drawing at the origin.

**Nothing measures the DOM.** This is the decision the rest of the kit rests on. Layout is not available before a film's first paint: a camera that called `getBoundingClientRect()` would have nothing to read on frame zero and would frame the wrong thing on the first frame of every export, then correct itself on frame one. Worse, it would make a film's picture depend on the order frames were asked for, which is exactly what this library refuses to do. Declaring the rect once also means "the camera looks at it, the cursor lands on it, and it draws itself pressed" is a single fact rather than three coordinates kept in step by hand.

## The camera

`<Camera shots>` — or the `shots` prop on `<Stage>` — takes a list of shots in the order they happen. Each shot is:

| Field | Meaning |
| --- | --- |
| `at` | The frame the camera has **arrived**. A non-negative integer; shots must be listed in order. |
| `look` | A board point `{ x, y }`, or the id of something the stage has placed. |
| `zoom` | How close. Omitted for a named element, the camera frames that element's bounds plus `padding`; omitted for a point, the board is shown at 1:1. Must be positive. |
| `tilt` | `{ x, y }` degrees of rotation, for a card-like perspective. |
| `settle` | How the camera travelled here from the shot before it: `"spring"` (the default), `"ease"` or `"cut"`. |
| `hold` | Frames to sit still after arriving, before leaving for the next shot. |
| `padding` | Board pixels kept around a framed element. Defaults to 64. |

Before the first shot the camera is already sitting on it, and after the last it stays there, so there is no drift into or out of the film. Between two shots it holds for the earlier shot's `hold`, then travels, arriving exactly as the later shot's `at` comes up. `settle` belongs to the shot being travelled *to*, because it describes the arrival.

Zoom interpolates multiplicatively: a move from 1× to 4× is halfway at 2×, not 2.5×, so it spends as long crossing 1–2 as 2–4. Linear zoom reads as a lurch that starts fast and crawls at the end.

`contain` stops a shot showing past the board's edge. A shot framing something near a corner otherwise puts the board's border in the middle of the picture with nothing beyond it; containing clamps the viewport's centre instead, so the subject sits off-centre and the frame stays full. An axis the viewport cannot fit on is centred, because no clamp would help.

`idle` adds a seeded drift — `{ amplitude, rate, seed }`, six board pixels at 0.08 cycles a second by default — so a held shot is not perfectly dead. It is breath, not motion. `vignette` darkens the edges of the viewport and is off by default.

**One deliberate move per shot, then hold.** A camera that arrives and is already leaving reads as nervous, and an audience that has not finished reading the last thing will not follow the next. `reviewCameraShots(shots, frameRate)` checks for it: it reports shots closer together than about four tenths of a second, and holds that leave no time to travel. The warnings are surfaced on the camera element as `data-zxn-warnings` rather than thrown, because a deliberate whip between two beats is a real thing to want.

`useCamera()` returns the current `{ x, y, zoom, tiltX, tiltY }` for anything that wants to react to the view — fading a label out as the camera pushes in, say.

## Parallax

`depth` on `<StageItem>` is a counter-move against the camera's travel: 0 moves with the board, 1 is far enough away that the camera's travel does not move it at all. Put a backdrop at 0.4–0.6 and the board will feel like it is in front of something rather than pasted onto it. Use it on background texture, not on anything the cursor touches — a control that slides relative to the board it belongs to looks broken.

## The cursor

`<Pointer path>` draws a cursor in board space, so the camera carries it: at 2× zoom the cursor is twice the size on screen, as a real recording would be. `size` and `color` are the only other props.

A path is a list of keys, each `{ at, to, press?, drag? }`. `to` is a point or an element id; `at` is the frame the cursor arrives; `press` clicks on arrival; `drag` holds the button down from that key until the next one.

Travel between keys is eased in and out and bowed slightly off the straight line — the bow peaks halfway and is zero at both ends, so the cursor still arrives exactly on its target. The direction alternates by key index rather than by chance, so a path always curves the same way. A cursor that slides at constant speed down a straight line reads as a diagram, not as someone using a product.

`reviewPointerPath(path, frameRate, layout)` warns about travel above 4200 board pixels a second, which stops reading as a hand, and about keys on the same frame as the one before them, which teleport. Like the camera's review it is surfaced on the element, not thrown.

`usePointer(path)` gives the cursor's state this frame — `x`, `y`, `pressed`, `pressPhase`, `ringPhase`, `dragging`, `over` — plus `pressedOn(id)`, true on exactly the frames a press on that id is held. That is the piece that matters: a button draws its own pressed state from the same path that moves the cursor, so it goes down on exactly the frame the cursor lands on it, and stays in step when you move the key.

## A product tour

Here is the whole kit doing its job: a mock application window, four shots, and a cursor that goes to the Export button and presses it.

```tsx film
import { defineFilm, Pointer, Stage, StageItem, usePointer, useTimeline } from "@zxn/motion-core";
import type { CameraShot, PointerKey, StageLayout } from "@zxn/motion-core";

type Props = {
  readonly appName: string;
  readonly fileName: string;
  readonly accent: string;
  readonly surface: string;
};

const layout: StageLayout = {
  backdrop: { x: 0, y: 0, width: 1920, height: 1080 },
  window: { x: 160, y: 120, width: 1600, height: 840 },
  toolbar: { x: 160, y: 120, width: 1600, height: 92 },
  "export-button": { x: 1568, y: 146, width: 160, height: 44 },
  sidebar: { x: 160, y: 212, width: 340, height: 748 },
  canvas: { x: 500, y: 212, width: 1260, height: 748 },
  artboard: { x: 620, y: 300, width: 1020, height: 560 },
};

const shots: readonly CameraShot[] = [
  { at: 0, look: "window", padding: 90, hold: 40 },
  { at: 110, look: "sidebar", padding: 36, hold: 30, settle: "ease" },
  { at: 210, look: "artboard", padding: 40, hold: 26 },
  { at: 300, look: "export-button", zoom: 2.4, hold: 40 },
];

const path: readonly PointerKey[] = [
  { at: 0, to: { x: 900, y: 1010 } },
  { at: 120, to: "sidebar" },
  { at: 225, to: "artboard" },
  { at: 318, to: "export-button", press: true },
];

const layers = ["Opening", "Sequence 01", "Callout", "Export preset", "Audio bed"];
const sans = "Inter, system-ui, sans-serif";

function ExportButton({ accent }: { readonly accent: string }) {
  const down = usePointer(path).pressedOn("export-button");
  return (
    <div
      style={{
        width: "100%", height: "100%", borderRadius: 10,
        background: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        font: `700 20px ${sans}`, color: "#0b0c0e",
        opacity: down ? 0.82 : 1,
        transform: `translateY(${String(down ? 2 : 0)}px) scale(${String(down ? 0.96 : 1)})`,
      }}
    >
      Export
    </div>
  );
}

function Tour({ appName, fileName, accent, surface }: Props) {
  const { frame } = useTimeline();
  // The selected layer follows the cursor's visit to the sidebar.
  const selected = frame >= 120 ? 1 : 0;

  return (
    <Stage width={1920} height={1080} layout={layout} shots={shots} idle={{ amplitude: 4, rate: 0.06, seed: "tour" }} contain vignette>
      <StageItem id="backdrop" depth={0.5} style={{ background: "radial-gradient(circle at 30% 20%, #1b2030 0%, #08090c 70%)" }} />

      <StageItem id="window" style={{ background: surface, borderRadius: 22, border: "1px solid rgba(255,255,255,0.09)" }} />

      <StageItem id="toolbar" style={{ display: "flex", alignItems: "center", gap: 22, padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((light) => (
            <div key={light} style={{ width: 14, height: 14, borderRadius: "50%", background: light, opacity: 0.85 }} />
          ))}
        </div>
        <div style={{ font: `600 20px ${sans}`, color: "#f3efe7" }}>{appName}</div>
        <div style={{ font: `400 18px ${sans}`, color: "rgba(243,239,231,0.45)" }}>{fileName}</div>
      </StageItem>

      <StageItem id="sidebar" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20, borderRight: "1px solid rgba(255,255,255,0.08)" }}>
        {layers.map((layer, index) => (
          <div
            key={layer}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              height: 52, padding: "0 14px", borderRadius: 10,
              background: index === selected ? "rgba(255,255,255,0.09)" : "transparent",
              font: `500 17px ${sans}`,
              color: index === selected ? "#f3efe7" : "rgba(243,239,231,0.55)",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, background: index === selected ? accent : "rgba(243,239,231,0.3)" }} />
            {layer}
          </div>
        ))}
      </StageItem>

      <StageItem id="canvas" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0f13" }} />

      <StageItem id="artboard" style={{ background: "#f6f4ef", borderRadius: 14, padding: 56, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ width: 300, height: 14, borderRadius: 7, background: accent }} />
        <div style={{ font: `800 64px ${sans}`, color: "#14161a", letterSpacing: "-0.03em" }}>Ship it</div>
        <div style={{ width: 640, height: 12, borderRadius: 6, background: "rgba(20,22,26,0.18)" }} />
        <div style={{ width: 520, height: 12, borderRadius: 6, background: "rgba(20,22,26,0.12)" }} />
      </StageItem>

      <StageItem id="export-button"><ExportButton accent={accent} /></StageItem>

      <Pointer path={path} size={36} />
    </Stage>
  );
}

export const films = [defineFilm({
  id: "product-tour",
  title: "Product tour",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 380,
  component: Tour,
  defaultProps: { appName: "Studio", fileName: "launch-film.zxn", accent: "#7a6cff", surface: "#14161a" },
  controls: {
    appName: { type: "text", label: "App name" },
    fileName: { type: "text", label: "File name" },
    accent: { type: "color", label: "Accent" },
    surface: { type: "color", label: "Window surface" },
  },
})];
```

<video src="media/product-tour.mp4" poster="media/product-tour.jpg" controls muted loop playsinline width="720"></video>

**The layout table.** Seven rects, and no pixel coordinate appears anywhere else in the film. Moving the Export button is one edit: the camera's last shot, the cursor's last key and the button's own position all follow, because all three name `"export-button"`.

**The shot list.** Four shots, each one move and a hold. The film opens on the whole window with 90 pixels of padding — no `zoom`, so the camera works out the zoom that fits those bounds — holds 40 frames for the audience to take it in, then eases over to the sidebar, springs to the artboard, and finally pushes to 2.4× on the button. `reviewCameraShots(shots, 30)` returns nothing for this list: the gaps are 110, 100 and 90 frames and no hold eats its own travel. `contain` matters on the last shot in particular, because the button sits near the top-right corner and at 2.4× an uncontained camera would show 300 pixels of nothing beyond the board.

**The backdrop.** One `<StageItem>` at `depth={0.5}`, filling the board, giving back half of every move the camera makes. It is the only thing in the film that is not part of the interface, and it is what stops the pushes feeling like a flat image being scaled.

**The cursor.** Four keys. It starts below the window, arrives at the sidebar on frame 120, crosses to the artboard, then travels to the button and presses on frame 318 — inside the last shot's 40-frame hold, so the camera is already still when the click lands. Nothing in the path exceeds 250 board pixels a second, well under the speed at which `reviewPointerPath` starts complaining.

**The button.** `usePointer(path).pressedOn("export-button")` is the whole of its state. There is no press frame written in the component: move the key to frame 280 and the button goes down on 280. The sidebar's selected row uses a plain frame comparison for contrast — that is the version you have to keep in step by hand, and the one that goes wrong when the timing changes.

## Practical notes

Author the board at the film's size unless you actually need to push past 1:1; a 1920×1080 board in a 1920×1080 film means shot one can be the real thing rather than a slightly soft scale-up. Build the mock interface from plain elements and inline styles, and keep blur and large shadows off anything that repeats — see [performance](performance.md).

Depth of field and motion blur are deliberately absent. Both need a real post pass over the rendered frame, which belongs to the renderer, not to a DOM transform; the view `useCamera()` returns carries everything such a pass would need, so it can arrive without changing a film.

## Next

- [Composition API](composition-api.md) for the full reference.
- [Tempo and music](tempo-and-music.md) if the tour should cut to a track.
- [Controls and props](controls-and-props.md) to drive a tour's copy from JSON.
- [Recipes](recipes.md) for more complete films.
