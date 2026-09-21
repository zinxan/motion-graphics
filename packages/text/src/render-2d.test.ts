import { describe, expect, it } from "vitest";
import { createTextStyle2D } from "./defaults";
import { textBackgroundOutline } from "./background-shape";
import { renderText2D } from "./render-2d";

type Call = Readonly<{ op: string; detail?: string }>;

/*
 * A recording 2D context.
 *
 * The layered styles are defined by the order their passes are drawn and by
 * which shadow state each pass carries, neither of which a pixel comparison
 * expresses clearly. Recording the calls states the intent directly: the plate
 * lands before the glyphs, the glow does not inherit the drop shadow, and so on.
 */
function recordingContext() {
  const calls: Call[] = [];
  const state = {
    font: "", textAlign: "", textBaseline: "", lineJoin: "", miterLimit: 0,
    // A gradient fill is an object here; recording it by name is enough to tell
    // the passes apart, and keeps the record readable.
    fillStyle: "" as string | object, strokeStyle: "" as string | object, lineWidth: 0, globalAlpha: 1,
    shadowColor: "", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
  };
  const name = (value: string | object): string => typeof value === "string" ? value : "<gradient>";
  const context = {
    ...state,
    save() { calls.push({ op: "save" }); },
    restore() { calls.push({ op: "restore" }); },
    beginPath() { calls.push({ op: "beginPath" }); },
    translate(x: number, y: number) { calls.push({ op: "translate", detail: `${x},${y}` }); },
    ellipse() { calls.push({ op: "ellipse" }); },
    arc() { calls.push({ op: "arc" }); },
    rect() { calls.push({ op: "rect" }); },
    moveTo() { calls.push({ op: "moveTo" }); },
    lineTo() { calls.push({ op: "lineTo" }); },
    quadraticCurveTo() { calls.push({ op: "quadraticCurveTo" }); },
    closePath() { calls.push({ op: "closePath" }); },
    stroke() { calls.push({ op: "stroke", detail: `${name(context.strokeStyle)}|${context.lineWidth}` }); },
    roundRect(...args: readonly number[]) { calls.push({ op: "roundRect", detail: args.join(",") }); },
    fill(rule?: string) { calls.push({ op: "fill", detail: `${name(context.fillStyle)}|${rule ?? ""}` }); },
    measureText: (value: string) => ({ width: value.length * 10 }),
    fillText(value: string) {
      calls.push({ op: "fillText", detail: `${value}|${name(context.fillStyle)}|${context.shadowColor}@${context.shadowBlur}` });
    },
    strokeText(value: string) {
      calls.push({ op: "strokeText", detail: `${value}|${name(context.strokeStyle)}|${context.lineWidth}|${context.shadowColor}@${context.shadowBlur}` });
    },
    createLinearGradient: () => ({ addColorStop() {} }),
  } as unknown as CanvasRenderingContext2D & { readonly calls: Call[] };
  return { context, calls };
}

const ops = (calls: readonly Call[], op: string) => calls.filter((call) => call.op === op);

describe("renderText2D layers", () => {
  it("draws nothing extra for a plain style", () => {
    const { context, calls } = recordingContext();
    renderText2D(context, "Art", createTextStyle2D({ fontSize: 40 }));

    expect(ops(calls, "roundRect")).toHaveLength(0);
    expect(ops(calls, "strokeText")).toHaveLength(0);
    expect(ops(calls, "fillText")).toHaveLength(1);
  });

  it("draws the background plate before any glyph", () => {
    const { context, calls } = recordingContext();
    renderText2D(context, "Art", createTextStyle2D({
      fontSize: 40,
      background: { color: "#123456", paddingX: 10, paddingY: 6, radius: 8, opacity: 0.9 },
    }));

    // The plate is traced as a polyline, so its first move is where it starts.
    const plate = calls.findIndex((call) => call.op === "moveTo");
    const glyph = calls.findIndex((call) => call.op === "fillText");
    expect(plate).toBeGreaterThanOrEqual(0);
    expect(glyph).toBeGreaterThan(plate);
  });

  it("clamps a background radius to the plate it has to fit inside", () => {
    /*
     * A radius larger than the plate must not blow the outline up: the
     * rounded corners are clamped to half the shorter side, so every point of
     * the traced outline stays inside the padded box.
     */
    const rect = { left: -50, top: -20, width: 100, height: 40 };
    const outline = textBackgroundOutline("rect", rect, 9_999);
    for (const path of outline) {
      for (const point of path) {
        expect(point.x).toBeGreaterThanOrEqual(rect.left - 1e-6);
        expect(point.x).toBeLessThanOrEqual(rect.left + rect.width + 1e-6);
        expect(point.y).toBeGreaterThanOrEqual(rect.top - 1e-6);
        expect(point.y).toBeLessThanOrEqual(rect.top + rect.height + 1e-6);
      }
    }
  });

  it("composites a glow as repeated passes rather than one washed-out halo", () => {
    const { context, calls } = recordingContext();
    renderText2D(context, "Art", createTextStyle2D({
      fontSize: 40,
      glow: { color: "#22d3ee", blur: 20, intensity: 4 },
    }));

    // Four glow passes plus the single real fill.
    const glowPasses = ops(calls, "fillText").filter((call) => call.detail?.includes("#22d3ee@20"));
    expect(glowPasses).toHaveLength(4);
  });

  it("keeps the glow out of the drop shadow and the drop shadow out of the fill", () => {
    const { context, calls } = recordingContext();
    renderText2D(context, "Art", createTextStyle2D({
      fontSize: 40,
      stroke: { color: "#000000", width: 6 },
      shadow: { color: "#ff0000", blur: 12, offsetX: 0, offsetY: 4 },
      glow: { color: "#00ff00", blur: 20, intensity: 2 },
    }));

    // The glow passes carry the glow's own shadow, never the drop shadow.
    expect(ops(calls, "fillText").filter((call) => call.detail?.includes("#ff0000"))).toHaveLength(0);
    // The drop shadow is cast once, under the stroke, not a second time by the fill.
    expect(ops(calls, "strokeText").filter((call) => call.detail?.includes("#ff0000@12"))).toHaveLength(1);
  });

  it("widens the outer outline so the inner one cannot swallow it", () => {
    const { context, calls } = recordingContext();
    renderText2D(context, "Art", createTextStyle2D({
      fontSize: 40,
      stroke: { color: "#ffffff", width: 6 },
      outerStroke: { color: "#000000", width: 4 },
    }));

    const outer = ops(calls, "strokeText").find((call) => call.detail?.includes("#000000"));
    // Canvas centres a stroke on the glyph edge, so 4px of visible outer ring
    // needs the inner ring's 6px added on top.
    expect(outer?.detail).toContain("|10|");
  });
});
