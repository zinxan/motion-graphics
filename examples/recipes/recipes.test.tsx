// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilmSurface, describeFilm } from "@zxn/motion-core";
import { films } from "./index";
import manifest from "./manifest.json";

/*
 * Every recipe is mounted for real, at its first, middle and last frame and at
 * a frame asked for out of order, in a DOM. A recipe that throws, logs a React
 * error, renders nothing, or draws nothing on its canvas fails here -- which is
 * what lets the docs quote these files without ever quoting something broken.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let drawCalls = 0;
const recordingContext = (): CanvasRenderingContext2D => new Proxy({} as Record<string, unknown>, {
  get: (target, name) => {
    if (name in target) return target[name as string];
    return (..._args: unknown[]) => { drawCalls += 1; return name === "createLinearGradient" || name === "createRadialGradient" ? { addColorStop: () => undefined } : undefined; };
  },
  set: (target, name, value) => { target[name as string] = value; return true; },
}) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  drawCalls = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(recordingContext as never);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

it("lists every recipe in the manifest, so the docs and the MCP server know about all of them", () => {
  expect(manifest.map((entry) => entry.id).sort()).toEqual(films.map((film) => film.id).sort());
});

describe.each(films.map((film) => [film.id, film] as const))("recipe %s", (_id, film) => {
  // The list mixes films with different props; describing one only needs it to be some film.
  const descriptor = describeFilm(film as never);
  // The manifest already says which recipes draw on a canvas; a new one is covered without touching this file.
  const usesCanvas = manifest.find((entry) => entry.id === film.id)?.techniques.includes("Canvas2D") ?? false;

  it("declares a sensible film", () => {
    expect(film.width).toBe(1920);
    expect(film.height).toBe(1080);
    expect(film.frames).toBeGreaterThan(30);
    // Every default prop has a control, so nothing is only reachable by editing code.
    expect(Object.keys(film.controls ?? {}).sort()).toEqual(Object.keys(film.defaultProps).sort());
  });

  it("renders its first, middle and last frame, and a frame asked for out of order", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    for (const frame of [0, Math.floor(film.frames / 2), film.frames - 1, 7]) {
      act(() => root.render(<FilmSurface film={descriptor} frame={frame} />));
      expect(host.innerHTML.length).toBeGreaterThan(100);
    }
    expect(console.error).not.toHaveBeenCalled();
    if (usesCanvas) expect(drawCalls).toBeGreaterThan(50);
    act(() => root.unmount());
    host.remove();
  });

  it("draws the same thing every time it is asked for the same frame", () => {
    const markupAt = (frame: number): string => {
      const host = document.createElement("div");
      const root = createRoot(host);
      act(() => root.render(<FilmSurface film={descriptor} frame={frame} />));
      const markup = host.innerHTML;
      act(() => root.unmount());
      return markup;
    };
    const frame = Math.floor(film.frames / 3);
    expect(markupAt(frame)).toBe(markupAt(frame));
  });
});
