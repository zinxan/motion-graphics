import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defineFilm, describeFilm } from "./define-film.js";
import { FilmSurface, useTimeline } from "./frame-context.js";
import { Cue, Hold, Repeat } from "./primitives.js";

function FrameLabel() {
  const { frame, absoluteFrame } = useTimeline();
  return <span>{frame}:{absoluteFrame}</span>;
}

function TestFilm() {
  return <><FrameLabel /><Cue start={10} length={10} layout="none"><FrameLabel /></Cue></>;
}

const film = describeFilm(defineFilm({
  id: "cue-test",
  title: "Cue test",
  width: 100,
  height: 100,
  frameRate: 10,
  frames: 30,
  component: TestFilm,
  defaultProps: {},
}));

describe("Cue", () => {
  it("mounts only in range and shifts child-local time", () => {
    expect(renderToStaticMarkup(<FilmSurface film={film} frame={9} />)).toContain("9:9");
    expect(renderToStaticMarkup(<FilmSurface film={film} frame={9} />)).not.toContain("0:9");
    expect(renderToStaticMarkup(<FilmSurface film={film} frame={10} />)).toContain("0:10");
    expect(renderToStaticMarkup(<FilmSurface film={film} frame={20} />)).not.toContain("10:20");
  });
});

describe("timing validation", () => {
  it("rejects fractional or negative frame contracts", () => {
    const BadFilm = () => <Cue start={-1}><span /></Cue>;
    const badCue = describeFilm(defineFilm({ id: "bad-cue", title: "Bad", width: 1, height: 1, frameRate: 1, frames: 2, component: BadFilm, defaultProps: {} }));
    expect(() => renderToStaticMarkup(<FilmSurface film={badCue} frame={0} />)).toThrow("Cue.start");

    const BadHold = () => <Hold frame={0.5}><span /></Hold>;
    const badHold = describeFilm(defineFilm({ id: "bad-hold", title: "Bad", width: 1, height: 1, frameRate: 1, frames: 2, component: BadHold, defaultProps: {} }));
    expect(() => renderToStaticMarkup(<FilmSurface film={badHold} frame={0} />)).toThrow("Hold.frame");
  });
});

describe("Repeat", () => {
  it("wraps local frames without changing absolute time", () => {
    const LoopFilm = () => <Repeat every={4}><FrameLabel /></Repeat>;
    const loop = describeFilm(defineFilm({ id: "loop", title: "Loop", width: 1, height: 1, frameRate: 1, frames: 20, component: LoopFilm, defaultProps: {} }));
    expect(renderToStaticMarkup(<FilmSurface film={loop} frame={11} />)).toContain("3:11");
  });
});
