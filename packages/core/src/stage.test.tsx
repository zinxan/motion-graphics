import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defineFilm, describeFilm } from "./define-film.js";
import { FilmSurface } from "./frame-context.js";
import type { StageLayout } from "./camera.js";
import type { PointerKey } from "./pointer.js";
import { Camera, Pointer, Stage, StageItem, usePointer } from "./stage.js";
import { Cue } from "./primitives.js";

const layout: StageLayout = {
  panel: { x: 400, y: 300, width: 600, height: 400 },
  "export-button": { x: 820, y: 620, width: 160, height: 40 },
  sky: { x: 0, y: 0, width: 1920, height: 300 },
};

const shots = [
  { at: 0, look: { x: 960, y: 540 }, zoom: 1, hold: 20 },
  { at: 60, look: "export-button", zoom: 2, settle: "ease" as const },
];

const path: readonly PointerKey[] = [
  { at: 0, to: { x: 200, y: 200 } },
  { at: 60, to: "export-button", press: true },
];

function PressLabel() {
  const pointer = usePointer(path);
  return <span data-testid="pressed">{pointer.pressedOn("export-button") ? "down" : "up"}</span>;
}

function Board() {
  return (
    <Stage width={1920} height={1080} layout={layout} shots={shots} vignette>
      <StageItem id="sky" depth={0.6} />
      <StageItem id="panel">panel</StageItem>
      <StageItem id="export-button"><PressLabel /></StageItem>
      <Pointer path={path} />
    </Stage>
  );
}

const film = describeFilm(defineFilm({
  id: "stage-test",
  title: "Stage test",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 120,
  component: Board,
  defaultProps: {},
}));

const markup = (frame: number) => renderToStaticMarkup(<FilmSurface film={film} frame={frame} />);

describe("Stage", () => {
  it("places each item at the rect the layout gives its id", () => {
    expect(markup(0)).toContain("left:400px;top:300px;width:600px;height:400px");
  });

  it("names every item as a selectable element", () => {
    expect(markup(0)).toContain('data-zxn-element-id="panel"');
    expect(markup(0)).toContain('data-zxn-element-id="export-button"');
  });

  it("refuses an item the layout does not place", () => {
    const Broken = () => <Stage width={100} height={100} layout={{}}><StageItem id="ghost" /></Stage>;
    const broken = describeFilm(defineFilm({
      id: "broken", title: "Broken", width: 100, height: 100, frameRate: 30, frames: 1,
      component: Broken, defaultProps: {},
    }));

    expect(() => renderToStaticMarkup(<FilmSurface film={broken} frame={0} />))
      .toThrow(/ghost/);
  });

  it("refuses a board with no size", () => {
    const Broken = () => <Stage width={0} height={100}><span /></Stage>;
    const broken = describeFilm(defineFilm({
      id: "broken", title: "Broken", width: 100, height: 100, frameRate: 30, frames: 1,
      component: Broken, defaultProps: {},
    }));

    expect(() => renderToStaticMarkup(<FilmSurface film={broken} frame={0} />))
      .toThrow(/positive numbers/);
  });
});

describe("Camera", () => {
  it("aims the board at the first shot and holds it", () => {
    const first = markup(0);

    expect(first).toContain("translate(960px, 540px)");
    expect(first).toContain("scale(1)");
    expect(first).toContain("translate(-960px, -540px)");
  });

  it("has travelled to the second shot by its frame", () => {
    expect(markup(60)).toContain("scale(2)");
    expect(markup(60)).toContain("translate(-900px, -640px)");
  });

  it("draws a vignette only when asked", () => {
    expect(markup(0)).toContain("Vignette");
  });

  it("moves a deeper item less than the board", () => {
    const skyOffset = (frame: number): number => {
      const found = /data-zxn-element-id="sky"[^>]*?translate\((-?[\d.]+)px/.exec(markup(frame));
      return Number(found?.[1] ?? Number.NaN);
    };

    // On the opening shot the camera sits at the board's centre, so there is
    // no travel for a parallax item to give back.
    expect(skyOffset(0)).toBe(0);
    // By the second shot the camera sits on the export button's centre, 60px
    // left of the board's, and the sky at depth 0.6 gives back 0.6 of that.
    expect(skyOffset(60)).toBeCloseTo((900 - 960) * 0.6, 6);
  });

  it("surfaces a crowded shot list rather than failing the film", () => {
    const Crowded = () => (
      <Stage width={100} height={100} shots={[{ at: 0, look: { x: 0, y: 0 } }, { at: 2, look: { x: 50, y: 0 } }]}>
        <span />
      </Stage>
    );
    const crowded = describeFilm(defineFilm({
      id: "crowded", title: "Crowded", width: 100, height: 100, frameRate: 30, frames: 10,
      component: Crowded, defaultProps: {},
    }));

    expect(renderToStaticMarkup(<FilmSurface film={crowded} frame={0} />)).toContain("data-zxn-warnings");
  });

  it("works outside a Stage when given a layout of its own", () => {
    const Standalone = () => (
      <Camera shots={[{ at: 0, look: "panel", zoom: 1 }]} layout={layout} board={{ width: 1920, height: 1080 }}>
        <span>free</span>
      </Camera>
    );
    const standalone = describeFilm(defineFilm({
      id: "standalone", title: "Standalone", width: 1920, height: 1080, frameRate: 30, frames: 10,
      component: Standalone, defaultProps: {},
    }));

    expect(renderToStaticMarkup(<FilmSurface film={standalone} frame={0} />)).toContain("translate(-700px, -500px)");
  });
});

describe("Pointer", () => {
  it("rides the board, so the camera carries it", () => {
    expect(markup(0)).toContain('data-zxn-pointer=""');
  });

  it("is over its target and pressed on the frame it lands", () => {
    expect(markup(59)).toContain(">up<");
    expect(markup(60)).toContain(">down<");
  });

  it("shows the click ring only after the press", () => {
    expect(markup(59)).not.toContain("border-radius:50%");
    expect(markup(60)).toContain("border-radius:50%");
  });
});

describe("Cue on the musical grid", () => {
  const Musical = () => (
    <>
      <Cue startBar={1} lengthBars={1} layout="none"><span>bar-one</span></Cue>
      <Cue start={0} length={5} layout="none"><span>frames</span></Cue>
    </>
  );
  const musical = describeFilm(defineFilm({
    id: "musical", title: "Musical", width: 100, height: 100, frameRate: 30, frames: 240,
    tempo: { bpm: 120 }, component: Musical, defaultProps: {},
  }));
  const show = (frame: number) => renderToStaticMarkup(<FilmSurface film={musical} frame={frame} />);

  it("starts on the bar and ends a bar later", () => {
    // 120bpm, four beats to the bar: a bar is two seconds, so bar one is frame 60.
    expect(show(59)).not.toContain("bar-one");
    expect(show(60)).toContain("bar-one");
    expect(show(119)).toContain("bar-one");
    expect(show(120)).not.toContain("bar-one");
  });

  it("still takes plain frames", () => {
    expect(show(0)).toContain("frames");
    expect(show(5)).not.toContain("frames");
  });

  it("refuses bars on a film with no tempo", () => {
    const Untimed = () => <Cue startBar={1} layout="none"><span /></Cue>;
    const untimed = describeFilm(defineFilm({
      id: "untimed", title: "Untimed", width: 100, height: 100, frameRate: 30, frames: 10,
      component: Untimed, defaultProps: {},
    }));

    expect(() => renderToStaticMarkup(<FilmSurface film={untimed} frame={60} />)).toThrow(/tempo/);
  });
});
