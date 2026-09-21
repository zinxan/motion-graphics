import { describe, expect, it } from "vitest";
import { hitTestMotionGraphicElement, layoutMotionGraphicElements } from "./layout";
import type { MotionGraphic } from "./types";

const graphic: MotionGraphic = {
  kind: "chart", chart: "bar", title: "Demand", subtitle: "Annual",
  labels: ["2024", "2026"], series: [{ name: "Power", color: "#22d3ee", values: [10, 20] }],
  background: "#08111f", foreground: "#ffffff", accent: "#22d3ee", showLegend: true,
};

describe("motion graphic element layout", () => {
  it("exposes stable bounds for every independently selectable chart element", () => {
    expect(layoutMotionGraphicElements(graphic, { width: 1280, height: 720 }).map(({ id }) => id)).toEqual([
      "background", "title", "subtitle", "label:0", "label:1", "bar:0:0", "bar:0:1", "legend:0",
    ]);
  });

  it("returns the individual bar above the grouped background", () => {
    const bar = layoutMotionGraphicElements(graphic, { width: 1280, height: 720 })
      .find(({ id }) => id === "bar:0:1");
    expect(bar).toBeDefined();
    expect(hitTestMotionGraphicElement(graphic, { width: 1280, height: 720 }, {
      x: bar!.x + bar!.width / 2, y: bar!.y + bar!.height / 2,
    })?.id).toBe("bar:0:1");
  });
});
