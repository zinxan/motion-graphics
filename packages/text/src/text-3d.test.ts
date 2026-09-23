import { describe, expect, it } from "vitest";
import { createTextStyle3D, defaultTextStyle3D } from "./defaults.js";
import { textMaterialPresets } from "./presets.js";

describe("3D text styles", () => {
  it("creates deeply independent geometry, material, camera, and lighting values", () => {
    const first = createTextStyle3D();
    const second = createTextStyle3D();

    expect(first).toEqual(defaultTextStyle3D);
    expect(first.geometry).not.toBe(second.geometry);
    expect(first.geometry.bevel).not.toBe(second.geometry.bevel);
    expect(first.material).not.toBe(second.material);
    expect(first.camera).not.toBe(second.camera);
    expect(first.lighting).not.toBe(second.lighting);
  });

  it("starts from the selected named material before applying deep overrides", () => {
    const style = createTextStyle3D({
      fontSize: 120,
      geometry: { depth: 42, bevel: { size: 3 } },
      material: { preset: "gold", roughness: 0.35 },
      lighting: { rimIntensity: 2.2 },
    });

    expect(style.geometry).toMatchObject({
      depth: 42,
      curveSegments: defaultTextStyle3D.geometry.curveSegments,
      bevel: { ...defaultTextStyle3D.geometry.bevel, size: 3 },
    });
    expect(style.material).toMatchObject({
      ...textMaterialPresets.gold,
      roughness: 0.35,
    });
    expect(style.lighting).toEqual({
      ...defaultTextStyle3D.lighting,
      rimIntensity: 2.2,
    });
  });

  it("publishes a complete, distinct definition for every named preset", () => {
    expect(Object.keys(textMaterialPresets)).toEqual([
      "clay",
      "gold",
      "chrome",
      "glass",
      "neon",
      "toon",
      "iridescent",
    ]);
    expect(new Set(Object.values(textMaterialPresets).map((preset) => preset.frontColor)).size).toBe(7);
  });
});
