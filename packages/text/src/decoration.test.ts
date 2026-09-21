import { describe, expect, it } from "vitest";
import { isBackdropDecoration, renderTextDecoration, textDecorationOverflow, type TextDecoration } from "./decoration";

const rect = { left: -100, top: -30, width: 200, height: 60 };

function recordingContext() {
  const calls: string[] = [];
  const context = {
    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    beginPath() { calls.push("beginPath"); },
    closePath() {},
    moveTo() {}, lineTo() {}, arc() { calls.push("arc"); },
    quadraticCurveTo() {}, bezierCurveTo() {},
    translate() {}, rotate() {},
    fill() { calls.push("fill"); },
    stroke() { calls.push("stroke"); },
    fillRect() { calls.push("fillRect"); },
    globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
  return { context, calls };
}

const decoration = (over: Partial<TextDecoration> = {}): TextDecoration => ({
  kind: "snow", colors: ["#fff"], density: 1, seed: 7, opacity: 1, ...over,
});

describe("text decoration", () => {
  it("draws nothing when turned down to zero", () => {
    const none = recordingContext();
    renderTextDecoration(none.context, decoration({ opacity: 0 }), rect);
    expect(none.calls.filter((call) => call === "fill" || call === "stroke")).toHaveLength(0);

    const empty = recordingContext();
    renderTextDecoration(empty.context, decoration({ density: 0 }), rect);
    expect(empty.calls.filter((call) => call === "fill" || call === "stroke")).toHaveLength(0);
  });

  it("is deterministic, so a title does not crawl with noise during playback", () => {
    const first = recordingContext();
    const second = recordingContext();
    renderTextDecoration(first.context, decoration({ kind: "confetti" }), rect);
    renderTextDecoration(second.context, decoration({ kind: "confetti" }), rect);
    expect(first.calls).toEqual(second.calls);
  });

  it("gives different seeds different layouts", () => {
    const a = recordingContext();
    const b = recordingContext();
    renderTextDecoration(a.context, decoration({ kind: "bubbles", seed: 1 }), rect);
    renderTextDecoration(b.context, decoration({ kind: "bubbles", seed: 2 }), rect);
    // Same call shapes, but the arcs land in different places, so at minimum
    // the run must not be byte-identical the way two same-seed runs are.
    expect(a.calls.length).toBeGreaterThan(0);
    expect(renderedPositions(decoration({ kind: "bubbles", seed: 1 }))).not.toEqual(
      renderedPositions(decoration({ kind: "bubbles", seed: 2 })),
    );
  });

  it("spreads more motifs across a wider title", () => {
    const narrow = recordingContext();
    const wide = recordingContext();
    renderTextDecoration(narrow.context, decoration({ kind: "stars" }), rect);
    renderTextDecoration(wide.context, decoration({ kind: "stars" }), { ...rect, width: 900 });
    expect(wide.calls.filter((c) => c === "fill").length).toBeGreaterThan(narrow.calls.filter((c) => c === "fill").length);
  });

  it("keeps motifs clear of the middle, where the words are", () => {
    // Bubbles report their centres, so this reads where they actually landed.
    const centre = rect.top + rect.height / 2;
    const keepClear = rect.height * 0.3;
    const ys = renderedPositions(decoration({ kind: "bubbles", density: 3 }))
      .map((pair) => Number(pair.split(",")[1]));

    expect(ys.length).toBeGreaterThan(4);
    for (const y of ys) expect(Math.abs(y - centre)).toBeGreaterThanOrEqual(keepClear);
  });

  it("reports an overflow for scattered motifs and none for a backdrop", () => {
    expect(textDecorationOverflow("snow").y).toBeGreaterThan(0);
    expect(textDecorationOverflow("sunburst")).toEqual({ x: 0, y: 0 });
  });

  it("treats only sun rays as a backdrop", () => {
    expect(isBackdropDecoration("sunburst")).toBe(true);
    expect(isBackdropDecoration("snow")).toBe(false);
    expect(isBackdropDecoration("flame")).toBe(false);
  });
});

/** Records where each motif actually landed, which is what a seed controls. */
function renderedPositions(spec: TextDecoration): readonly string[] {
  const positions: string[] = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {},
    translate() {}, rotate() {}, fill() {}, stroke() {}, fillRect() {},
    arc(x: number, y: number) { positions.push(`${x.toFixed(2)},${y.toFixed(2)}`); },
    globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
  renderTextDecoration(context, spec, rect);
  return positions;
}
