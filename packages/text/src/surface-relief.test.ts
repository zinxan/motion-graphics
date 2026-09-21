import { describe, expect, it } from "vitest";
import {
  createTextStyle2D,
  createTextSurfacePaint,
  createTextSurfaceRelief,
  normalizeTextSurfaceRelief,
} from "./defaults";
import { surfaceReliefShifts, surfaceTextureAlpha } from "./surface-relief";

describe("engraved text surface", () => {
  it("deep-merges serializable relief controls", () => {
    const style = createTextStyle2D({
      surface: createTextSurfaceRelief({ depth: 4, imprintOpacity: 0.02 }),
    });

    expect(style.surface).toMatchObject({
      kind: "engraved",
      depth: 4,
      softness: 0.9,
      imprintOpacity: 0.02,
      textureStrength: 0.42,
      edgeRoughness: 0.28,
    });
  });

  it("places highlight and shadow on opposing internal edges", () => {
    const shifts = surfaceReliefShifts(Math.SQRT2, 135);

    expect(shifts.shadow.x).toBeCloseTo(-1);
    expect(shifts.shadow.y).toBeCloseTo(-1);
    expect(shifts.highlight.x).toBeCloseTo(1);
    expect(shifts.highlight.y).toBeCloseTo(1);
  });

  it("normalizes a zero-depth finish without negative zero", () => {
    expect(surfaceReliefShifts(0, 300)).toEqual({
      shadow: { x: 0, y: 0 },
      highlight: { x: 0, y: 0 },
    });
  });

  it("normalizes older serialized engravings with material defaults", () => {
    const relief = normalizeTextSurfaceRelief({
      kind: "engraved",
      depth: 3,
      imprintOpacity: 0.06,
    });

    expect(relief).toMatchObject({
      kind: "engraved",
      depth: 3,
      imprintOpacity: 0.06,
      finishOpacity: 0.92,
      textureStrength: 0.42,
      edgeRoughness: 0.28,
      wear: 0.08,
    });
  });

  it("creates a thin weathered painted finish", () => {
    expect(createTextSurfacePaint()).toMatchObject({
      kind: "painted",
      depth: 0,
      paintOpacity: 0.48,
      textureStrength: 0.42,
      wear: 0.1,
    });
  });

  it("produces deterministic non-uniform material opacity", () => {
    const relief = createTextSurfaceRelief({
      textureStrength: 0.7,
      wear: 0.2,
      seed: 814,
    });
    const first = Array.from({ length: 64 }, (_, index) =>
      surfaceTextureAlpha(index % 8, Math.floor(index / 8), 1, relief));
    const second = Array.from({ length: 64 }, (_, index) =>
      surfaceTextureAlpha(index % 8, Math.floor(index / 8), 1, relief));

    expect(second).toEqual(first);
    expect(Math.max(...first) - Math.min(...first)).toBeGreaterThan(0.2);
    expect(first.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("leaves an untextured, unworn glyph unchanged", () => {
    const relief = createTextSurfaceRelief({ textureStrength: 0, wear: 0 });
    expect(surfaceTextureAlpha(17, 23, 0.68, relief)).toBeCloseTo(0.68);
  });
});
