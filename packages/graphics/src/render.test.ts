import { describe, expect, it, vi } from "vitest";
import { renderMotionGraphic } from "./render.js";

describe("renderMotionGraphic", () => {
  it("draws a deterministic animated chart from plain data", () => {
    const roundRect = vi.fn();
    const fillText = vi.fn();
    const context = {
      fillStyle: "", strokeStyle: "", lineWidth: 0, lineCap: "butt", lineJoin: "miter",
      globalAlpha: 1, textAlign: "left", textBaseline: "top", font: "",
      beginPath: vi.fn(), roundRect, fill: vi.fn(), fillText,
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(),
      measureText: vi.fn(() => ({ width: 42 })),
    } as unknown as CanvasRenderingContext2D;
    renderMotionGraphic(context, {
      kind: "chart", chart: "bar", title: "Energy", labels: ["2024", "2030"],
      series: [{ name: "AI", color: "#22d3ee", values: [10, 25] }],
      background: "#07111f", foreground: "#ffffff", accent: "#22d3ee", showLegend: true,
    }, { width: 1280, height: 720, localSeconds: 1, durationSeconds: 8 });
    expect(roundRect).toHaveBeenCalledTimes(3);
    expect(fillText).toHaveBeenCalledWith("Energy", -560, -296, 1120);
    expect(fillText).toHaveBeenCalledWith("2030", 280, 314, 504);
  });
});
