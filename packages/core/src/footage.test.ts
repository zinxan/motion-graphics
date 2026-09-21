import { describe, expect, it, vi } from "vitest";
import {
  fitRect, footageAssetAttribute, footageFitAttribute, footageTimeAttribute,
  footageTimeAt, paintFootageFrames, type FootageProvider,
} from "./footage.js";

describe("mapping a film frame onto its source", () => {
  it("starts at the source's start and advances a frame at a time", () => {
    expect(footageTimeAt({ frame: 0, frameRate: 30 })).toBe(0);
    expect(footageTimeAt({ frame: 30, frameRate: 30 })).toBeCloseTo(1, 9);
  });

  it("offsets by the trim the clip was given", () => {
    expect(footageTimeAt({ frame: 0, frameRate: 30, from: 2.5 })).toBe(2.5);
    expect(footageTimeAt({ frame: 15, frameRate: 30, from: 2.5 })).toBeCloseTo(3, 9);
  });

  it("scales by the playback rate", () => {
    expect(footageTimeAt({ frame: 30, frameRate: 30, speed: 2 })).toBeCloseTo(2, 9);
    expect(footageTimeAt({ frame: 30, frameRate: 30, speed: 0.5 })).toBeCloseTo(0.5, 9);
  });

  it("combines a trim and a rate the way a clip does", () => {
    expect(footageTimeAt({ frame: 60, frameRate: 30, from: 1, speed: 1.5 })).toBeCloseTo(4, 9);
  });

  it("holds the last frame rather than running past the end", () => {
    const held = footageTimeAt({ frame: 600, frameRate: 30, duration: 8 });

    expect(held).toBeCloseTo(8 - 1 / 30, 9);
  });

  it("never asks for a negative instant", () => {
    expect(footageTimeAt({ frame: -20, frameRate: 30, from: 0 })).toBe(0);
  });

  it.each([
    [{ frame: 0, frameRate: 0 }, /frameRate/],
    [{ frame: 0, frameRate: 30, speed: 0 }, /speed/],
    [{ frame: 0, frameRate: 30, speed: -1 }, /speed/],
    [{ frame: 0, frameRate: 30, from: -1 }, /from/],
  ])("rejects %j", (timing, message) => {
    expect(() => footageTimeAt(timing)).toThrow(message);
  });
});

describe("fitting a source into its box", () => {
  const box = { width: 400, height: 200 };

  it("fills the box exactly when asked to fill", () => {
    expect(fitRect({ width: 100, height: 100 }, box, "fill"))
      .toEqual({ x: 0, y: 0, width: 400, height: 200 });
  });

  it("covers the box, overflowing the axis that does not fit", () => {
    const rect = fitRect({ width: 100, height: 100 }, box, "cover");

    expect(rect.width).toBe(400);
    expect(rect.height).toBe(400);
    expect(rect.y).toBe(-100);
  });

  it("contains the source, letterboxing the axis that is short", () => {
    const rect = fitRect({ width: 100, height: 100 }, box, "contain");

    expect(rect.width).toBe(200);
    expect(rect.height).toBe(200);
    expect(rect.x).toBe(100);
  });

  it("falls back to filling a source with no size", () => {
    expect(fitRect({ width: 0, height: 0 }, box, "cover"))
      .toEqual({ x: 0, y: 0, width: 400, height: 200 });
  });
});

/** A canvas the paint step can find, with a drawing context that records calls. */
function fakeCanvas(assetId: string, seconds: string): {
  canvas: HTMLCanvasElement;
  drawn: unknown[][];
} {
  const drawn: unknown[][] = [];
  const attributes = new Map<string, string>([
    [footageAssetAttribute, assetId],
    [footageTimeAttribute, seconds],
    [footageFitAttribute, "fill"],
  ]);
  const canvas = {
    width: 200,
    height: 100,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    getContext: () => ({
      clearRect: () => undefined,
      drawImage: (...args: unknown[]) => { drawn.push(args); },
    }),
  } as unknown as HTMLCanvasElement;
  return { canvas, drawn };
}

const rootOf = (canvases: readonly HTMLCanvasElement[]): ParentNode =>
  ({ querySelectorAll: () => canvases } as unknown as ParentNode);

describe("the readiness handshake", () => {
  it("does nothing, and needs no provider, for a film with no footage", async () => {
    await expect(paintFootageFrames(rootOf([]), undefined)).resolves.toBeUndefined();
  });

  it("asks the provider for the instant the canvas declared", async () => {
    const { canvas, drawn } = fakeCanvas("dog", "2.500000");
    const frameAt = vi.fn<FootageProvider["frameAt"]>()
      .mockResolvedValue({ width: 100, height: 50 } as unknown as CanvasImageSource);

    await paintFootageFrames(rootOf([canvas]), { frameAt });

    expect(frameAt).toHaveBeenCalledWith({ assetId: "dog", seconds: 2.5 });
    expect(drawn).toHaveLength(1);
  });

  it("waits for every canvas before it resolves", async () => {
    const first = fakeCanvas("a", "0");
    const second = fakeCanvas("b", "1");
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    const frameAt = vi.fn<FootageProvider["frameAt"]>().mockImplementation(async ({ assetId }) => {
      if (assetId === "b") await gate;
      return { width: 10, height: 10 } as unknown as CanvasImageSource;
    });
    let settled = false;

    const painting = paintFootageFrames(rootOf([first.canvas, second.canvas]), { frameAt })
      .then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    release?.();
    await painting;
    expect(settled).toBe(true);
    expect(first.drawn).toHaveLength(1);
    expect(second.drawn).toHaveLength(1);
  });

  it("names the assets when there is no provider at all", async () => {
    const { canvas } = fakeCanvas("dog", "0");

    await expect(paintFootageFrames(rootOf([canvas]), undefined))
      .rejects.toThrow(/dog.*no frame provider/s);
  });

  it("fails visibly rather than drawing a blank box when a frame is missing", async () => {
    const { canvas } = fakeCanvas("dog", "9.5");
    const frameAt = vi.fn<FootageProvider["frameAt"]>().mockResolvedValue(undefined);

    await expect(paintFootageFrames(rootOf([canvas]), { frameAt }))
      .rejects.toThrow(/Footage "dog" has no frame at 9\.500s/);
  });
});
