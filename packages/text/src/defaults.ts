import { createTextMaterial3D } from "./presets.js";
import { defaultTextFontFamily } from "./font-catalog.js";
import type { TextDecoration } from "./decoration.js";
import type { TextBackground, TextGlow, TextStyle2D, TextStyle2DOverrides, TextStyle3D, TextStyle3DOverrides, TextSurfaceRelief } from "./types.js";

export const defaultTextSurfaceRelief: TextSurfaceRelief = {
  kind: "engraved",
  depth: 2.2,
  softness: 0.9,
  angle: 135,
  shadowOpacity: 0.22,
  highlightOpacity: 0.08,
  imprintOpacity: 0.035,
  finishOpacity: 0.92,
  textureStrength: 0.42,
  edgeRoughness: 0.28,
  wear: 0.08,
  seed: 2718,
  paintColor: "#d8cdb9",
  paintOpacity: 0.58,
};

export function createTextSurfaceRelief(
  overrides: Partial<Omit<TextSurfaceRelief, "kind">> = {},
): TextSurfaceRelief {
  return { ...defaultTextSurfaceRelief, ...overrides, kind: "engraved" };
}

export const defaultTextSurfacePaint: TextSurfaceRelief = {
  ...defaultTextSurfaceRelief,
  kind: "painted",
  depth: 0,
  softness: 0.65,
  shadowOpacity: 0,
  highlightOpacity: 0,
  imprintOpacity: 0,
  finishOpacity: 0.84,
  textureStrength: 0.42,
  edgeRoughness: 0.3,
  wear: 0.1,
  paintOpacity: 0.48,
};

export function createTextSurfacePaint(
  overrides: Partial<Omit<TextSurfaceRelief, "kind">> = {},
): TextSurfaceRelief {
  return { ...defaultTextSurfacePaint, ...overrides, kind: "painted" };
}

export function normalizeTextSurfaceRelief(
  surface: Partial<TextSurfaceRelief> & Pick<TextSurfaceRelief, "kind">,
): TextSurfaceRelief {
  return surface.kind === "painted"
    ? createTextSurfacePaint(surface)
    : createTextSurfaceRelief(surface);
}

export const defaultTextBackground: TextBackground = {
  shape: "rect",
  color: "#101114",
  paddingX: 28,
  paddingY: 14,
  radius: 16,
  opacity: 1,
};

export const defaultTextDecoration: TextDecoration = {
  kind: "sparkle",
  colors: ["#ffffff"],
  density: 1,
  seed: 1,
  opacity: 1,
};

export const defaultTextGlow: TextGlow = {
  color: "#22d3ee",
  blur: 28,
  intensity: 3,
};

export const defaultTextStyle2D: TextStyle2D = {
  mode: "2d",
  fontFamily: defaultTextFontFamily,
  fontSize: 96,
  fontWeight: 700,
  fontStyle: "normal",
  align: "center",
  lineHeight: 0.92,
  letterSpacing: 0,
  fill: { kind: "solid", color: "#f5f7fb" },
  stroke: { color: "#00000000", width: 0 },
  shadow: { color: "#0000004d", blur: 24, offsetX: 0, offsetY: 8 },
};

export const defaultTextStyle3D: TextStyle3D = {
  mode: "3d",
  fontId: "helvetiker",
  fontSize: 96,
  align: "center",
  lineHeight: 0.95,
  geometry: {
    depth: 24,
    curveSegments: 8,
    bevel: { enabled: true, thickness: 2, size: 1.5, segments: 5 },
  },
  material: createTextMaterial3D("clay"),
  camera: { fieldOfView: 35 },
  lighting: { ambientIntensity: 0.75, keyIntensity: 3, rimIntensity: 1.4 },
};

export function createTextStyle2D(overrides: TextStyle2DOverrides = {}): TextStyle2D {
  return {
    ...defaultTextStyle2D,
    ...overrides,
    mode: "2d",
    fill: overrides.fill ?? defaultTextStyle2D.fill,
    stroke: { ...defaultTextStyle2D.stroke, ...overrides.stroke },
    shadow: { ...defaultTextStyle2D.shadow, ...overrides.shadow },
    /*
     * These three stay absent unless asked for. Defaulting them in would put a
     * plate behind every title and a halo around every glyph, so `undefined`
     * has to mean "no such layer" rather than "the default one".
     */
    outerStroke: overrides.outerStroke
      ? { ...defaultTextStyle2D.stroke, ...overrides.outerStroke }
      : undefined,
    glow: overrides.glow ? { ...defaultTextGlow, ...overrides.glow } : undefined,
    background: overrides.background
      ? { ...defaultTextBackground, ...overrides.background }
      : undefined,
    decoration: overrides.decoration
      ? { ...defaultTextDecoration, ...overrides.decoration }
      : undefined,
    surface: overrides.surface
      ? normalizeTextSurfaceRelief(overrides.surface)
      : undefined,
  };
}

export function createTextStyle3D(overrides: TextStyle3DOverrides = {}): TextStyle3D {
  const preset = overrides.material?.preset ?? defaultTextStyle3D.material.preset;
  return {
    ...defaultTextStyle3D,
    ...overrides,
    mode: "3d",
    geometry: {
      ...defaultTextStyle3D.geometry,
      ...overrides.geometry,
      bevel: {
        ...defaultTextStyle3D.geometry.bevel,
        ...overrides.geometry?.bevel,
      },
    },
    material: createTextMaterial3D(preset, overrides.material),
    camera: { ...defaultTextStyle3D.camera, ...overrides.camera },
    lighting: { ...defaultTextStyle3D.lighting, ...overrides.lighting },
  };
}
