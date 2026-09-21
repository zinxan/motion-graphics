import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Canvas2D, paintCanvasFrame, type CanvasFrame } from "./canvas.js";
import { defineFilm, describeFilm } from "./define-film.js";
import { FilmSurface } from "./frame-context.js";

const film = describeFilm(defineFilm({
  id: "canvas-test", title: "Canvas test", width: 320, height: 180, frameRate: 30, frames: 60,
  component: () => <Canvas2D draw={() => undefined} />, defaultProps: {},
}));

const frame: CanvasFrame = { frame: 15, absoluteFrame: 15, seconds: 0.5, film, width: 320, height: 180 };

const recordingContext = () => {
  const calls: string[] = [];
  const context = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push(`${String(name)}(${args.join(",")})`); } });
  return { calls, context: context as unknown as CanvasRenderingContext2D };
};

describe("Canvas2D", () => {
  it("is one canvas the size of the film, filling it", () => {
    const markup = renderToStaticMarkup(<FilmSurface film={film} frame={0} />);
    expect(markup).toContain('<canvas width="320" height="180"');
    expect(markup.match(/<canvas/g)).toHaveLength(1);
  });

  it("clears and resets the context before every frame, so nothing leaks from the last one", () => {
    const { calls, context } = recordingContext();
    paintCanvasFrame(context, (target) => target.fillRect(1, 2, 3, 4), frame);
    expect(calls).toEqual(["save()", "setTransform(1,0,0,1,0,0)", "clearRect(0,0,320,180)", "fillRect(1,2,3,4)", "restore()"]);
  });

  it("tells the draw function the frame, the time and the surface size", () => {
    const draw = vi.fn();
    paintCanvasFrame(recordingContext().context, draw, frame);
    expect(draw.mock.calls[0]![1]).toMatchObject({ frame: 15, seconds: 0.5, width: 320, height: 180 });
  });

  it("restores the context even when a draw throws, and lets the error through", () => {
    const { calls, context } = recordingContext();
    expect(() => paintCanvasFrame(context, () => { throw new Error("bad draw"); }, frame)).toThrow("bad draw");
    expect(calls.at(-1)).toBe("restore()");
  });
});
