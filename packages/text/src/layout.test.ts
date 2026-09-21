import { describe, expect, it } from "vitest";
import { createTextStyle2D } from "./defaults";
import { alignedLineStart, estimateText2D, measureLine, measureText2D, paintedTextBounds2D } from "./layout";

describe("2D text layout", () => {
  it("includes spacing only between glyphs", () => {
    expect(measureLine("CUT", 4, (value) => value.length * 10)).toBe(38);
    expect(measureLine("", 4, () => 20)).toBe(0);
  });

  it("measures multiline text with its saved line-height and stroke", () => {
    const context = { font: "", measureText: (value: string) => ({ width: value.length * 20 }) };
    const style = createTextStyle2D({ fontSize: 100, lineHeight: 1.1, letterSpacing: 5, stroke: { color: "#fff", width: 3 } });
    const measured = measureText2D(context, "A\nWIDE", style);
    expect(measured.width).toBe(101);
    expect(measured.height).toBeCloseTo(226);
    expect(measured.lineWidths).toEqual([20, 95]);
  });

  it("anchors lines consistently for every alignment", () => {
    expect(alignedLineStart("left", 120)).toBe(0);
    expect(alignedLineStart("center", 120)).toBe(-60);
    expect(alignedLineStart("right", 120)).toBe(-120);
  });

  it("estimates bounds without requiring a browser canvas", () => {
    const style = createTextStyle2D({ fontSize: 50, letterSpacing: 2 });
    const measured = estimateText2D("WIDE", style);
    expect(measured.width).toBeGreaterThan(110);
    expect(measured.height).toBe(46);
  });
});

describe("painted text bounds", () => {
  it("matches the glyph estimate when the style paints no extra layers", () => {
    const style = createTextStyle2D({ fontSize: 40 });
    expect(paintedTextBounds2D("Art", style)).toEqual(estimateText2D("Art", style));
  });

  it("grows by the plate so the visible edge is clickable", () => {
    const plain = createTextStyle2D({ fontSize: 40 });
    const plated = createTextStyle2D({
      fontSize: 40,
      background: { color: "#000", paddingX: 20, paddingY: 12, radius: 8, opacity: 1 },
    });
    const before = estimateText2D("Art", plain);
    const after = paintedTextBounds2D("Art", plated);

    expect(after.width).toBeCloseTo(before.width + 40);
    expect(after.height).toBeCloseTo(before.height + 24);
  });

  it("ignores a fully transparent plate", () => {
    const style = createTextStyle2D({
      fontSize: 40,
      background: { color: "#000", paddingX: 50, paddingY: 50, radius: 0, opacity: 0 },
    });
    expect(paintedTextBounds2D("Art", style)).toEqual(estimateText2D("Art", style));
  });

  it("grows by the outer outline", () => {
    const style = createTextStyle2D({ fontSize: 40, outerStroke: { color: "#000", width: 5 } });
    expect(paintedTextBounds2D("Art", style).width).toBeCloseTo(estimateText2D("Art", style).width + 10);
  });

  it("leaves a soft glow out of the grabbable box", () => {
    const style = createTextStyle2D({ fontSize: 40, glow: { color: "#0ff", blur: 60, intensity: 4 } });
    expect(paintedTextBounds2D("Art", style)).toEqual(estimateText2D("Art", style));
  });
});

describe("bubble bounds", () => {
  it("reaches past the padded box for a shape that paints outside it", () => {
    const boxed = createTextStyle2D({
      fontSize: 40,
      background: { shape: "rect", color: "#000", paddingX: 10, paddingY: 10, radius: 0, opacity: 1 },
    });
    const round = createTextStyle2D({
      fontSize: 40,
      background: { shape: "ellipse", color: "#000", paddingX: 10, paddingY: 10, radius: 0, opacity: 1 },
    });
    expect(paintedTextBounds2D("Art", round).width).toBeGreaterThan(paintedTextBounds2D("Art", boxed).width);
  });

  it("hangs a speech tail below the plate without widening it", () => {
    const boxed = createTextStyle2D({
      fontSize: 40,
      background: { shape: "rect", color: "#000", paddingX: 10, paddingY: 10, radius: 8, opacity: 1 },
    });
    const tailed = createTextStyle2D({
      fontSize: 40,
      background: { shape: "speech", color: "#000", paddingX: 10, paddingY: 10, radius: 8, opacity: 1 },
    });
    expect(paintedTextBounds2D("Art", tailed).width).toBeCloseTo(paintedTextBounds2D("Art", boxed).width);
    expect(paintedTextBounds2D("Art", tailed).height).toBeGreaterThan(paintedTextBounds2D("Art", boxed).height);
  });

  it("counts an offset outer outline in both directions", () => {
    const centred = createTextStyle2D({ fontSize: 40, outerStroke: { color: "#000", width: 4 } });
    const pushed = createTextStyle2D({ fontSize: 40, outerStroke: { color: "#000", width: 4, offsetX: 9, offsetY: 9 } });
    expect(paintedTextBounds2D("Art", pushed).width).toBeCloseTo(paintedTextBounds2D("Art", centred).width + 18);
  });
});
