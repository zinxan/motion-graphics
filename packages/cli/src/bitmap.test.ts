import { describe, expect, it } from "vitest";
import { identifyPixelOrder, normalizeBitmap } from "./bitmap.js";

describe("native bitmap conversion", () => {
  it.each([
    [[255, 0, 0, 255], "rgba"], [[0, 0, 255, 255], "bgra"],
  ] as const)("identifies native red pixel %s as %s", (pixel, order) => {
    expect(identifyPixelOrder(Uint8Array.from(pixel))).toBe(order);
  });
  it("converts every pixel in place without changing green or alpha", () => {
    const bitmap = Uint8Array.from([1, 2, 3, 255, 10, 20, 30, 255]);
    expect(normalizeBitmap(bitmap, "bgra")).toBe(bitmap);
    expect([...bitmap]).toEqual([3, 2, 1, 255, 30, 20, 10, 255]);
  });
  it("preserves RGBA input", () => {
    const bitmap = Uint8Array.from([1, 2, 3, 255]);
    expect(normalizeBitmap(bitmap, "rgba")).toBe(bitmap);
    expect([...bitmap]).toEqual([1, 2, 3, 255]);
  });
  it.each([{ pixel: [0, 0, 0, 0] }, { pixel: [255, 0, 0] }, { pixel: [1, 2, 3, 255] }])("rejects unknown pixel layouts %s", ({ pixel }) => {
    expect(() => identifyPixelOrder(Uint8Array.from(pixel))).toThrow("layout");
  });
  it("rejects incomplete pixels", () => {
    expect(() => normalizeBitmap(Uint8Array.of(1), "bgra")).toThrow("length");
  });
});
