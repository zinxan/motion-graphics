import type { TextDecoration } from "./decoration";

export type TextAlign = "left" | "center" | "right";
export type TextFill =
  | Readonly<{ kind: "solid"; color: string }>
  | Readonly<{ kind: "linear-gradient"; angle: number; colors: readonly [string, string, ...string[]] }>;

export type TextStroke = Readonly<{
  color: string;
  width: number;
  /** Overrides `color` when present, so an outline can carry a gradient. */
  gradient?: TextFill;
  /*
   * Offsetting an outline from the glyphs fakes extrusion: a dark ring pushed
   * down-right reads as a solid slab behind the letters. Only the outer ring
   * offsets -- moving the inner one just detaches it.
   */
  offsetX?: number;
  offsetY?: number;
}>;
export type TextShadow = Readonly<{
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}>;

export type TextSurfaceRelief = Readonly<{
  kind: "engraved" | "painted";
  depth: number;
  softness: number;
  angle: number;
  shadowOpacity: number;
  highlightOpacity: number;
  imprintOpacity: number;
  finishOpacity: number;
  textureStrength: number;
  edgeRoughness: number;
  wear: number;
  seed: number;
  paintColor: string;
  paintOpacity: number;
}>;

/*
 * A filled plate behind the text -- CapCut calls these "bubbles". Padding and
 * radius are in the same units as fontSize so a style scales as one piece.
 */
/*
 * The plate's outline. CapCut's bubbles are nearly all a fill plus a contrasting
 * border, and a border is what stops a light plate dissolving into light footage.
 */
export type TextBackgroundStroke = Readonly<{ color: string; width: number }>;

/*
 * Plate shapes.
 *
 * `rect` covers captions and lower thirds; the rest are the speech-balloon
 * family. They are drawn as paths around the measured text box rather than as
 * bitmaps, so a bubble stretches to whatever the title says instead of being a
 * fixed-size sticker the text has to fit inside.
 */
export type TextBackgroundShape =
  | "rect"
  | "pill"
  | "ellipse"
  | "burst"
  | "cloud"
  | "banner"
  | "tag"
  | "speech"
  | "note";

/** How the plate's edge is drawn: ruled, felt-pen, or ripped paper. */
export type TextBackgroundEdge = "clean" | "sketch" | "torn";
/** The outline's line style. */
export type TextBackgroundOutline = "solid" | "dashed" | "double";
/** Small motifs stamped in a corner of the plate. */
export type TextBackgroundDecor = "hearts" | "stars" | "sparkles";

export type TextBackgroundShadow = Readonly<{
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}>;

export type TextBackground = Readonly<{
  shape: TextBackgroundShape;
  color: string;
  /** Overrides `color` when present, so a plate can carry a gradient. */
  gradient?: TextFill;
  paddingX: number;
  paddingY: number;
  radius: number;
  opacity: number;
  stroke?: TextBackgroundStroke;
  /*
   * What makes a plate a sticker rather than a box. All optional and all
   * absent on the plain plates, so a project saved before they existed
   * draws exactly as it did.
   */
  edge?: TextBackgroundEdge;
  outline?: TextBackgroundOutline;
  /** A paper grain over the fill, 0–1. */
  texture?: number;
  shadow?: TextBackgroundShadow;
  /** Degrees; a sticker slapped on slightly askew. */
  tilt?: number;
  decor?: TextBackgroundDecor;
  /** Seeds the edge noise so the same plate tears the same way every frame. */
  seed?: number;
}>;

/*
 * A glow is not a drop shadow with the offset zeroed.
 *
 * Canvas draws one shadow per pass, and a single blurred pass gives a thin,
 * washed-out halo. Real bloom comes from compositing several passes, so
 * `intensity` is a pass count rather than an opacity -- that is what separates
 * a neon sign from grey mush behind the glyphs.
 */
export type TextGlow = Readonly<{
  color: string;
  blur: number;
  intensity: number;
}>;

export type TextStyle2D = Readonly<{
  mode: "2d";
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  fill: TextFill;
  stroke: TextStroke;
  shadow: TextShadow;
  /** Drawn under `stroke`, so the two together read as a double outline. */
  outerStroke?: TextStroke;
  glow?: TextGlow;
  background?: TextBackground;
  /*
   * Decorative motifs -- snow, flames, confetti. Deliberately a sibling of
   * `background` rather than a field inside it, because flames around bare
   * letters are as common as confetti over a plate, and nesting would have made
   * the plate a prerequisite for the decoration.
   */
  decoration?: TextDecoration;
  surface?: TextSurfaceRelief;
}>;

export type TextMaterialPreset =
  | "clay"
  | "gold"
  | "chrome"
  | "glass"
  | "neon"
  | "toon"
  | "iridescent";

export type TextBevel3D = Readonly<{
  enabled: boolean;
  thickness: number;
  size: number;
  segments: number;
}>;

export type TextGeometry3D = Readonly<{
  depth: number;
  curveSegments: number;
  bevel: TextBevel3D;
}>;

export type TextMaterial3D = Readonly<{
  preset: TextMaterialPreset;
  frontColor: string;
  sideColor: string;
  metalness: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  transmission: number;
  thickness: number;
  ior: number;
  iridescence: number;
}>;

export type TextStyle3D = Readonly<{
  mode: "3d";
  fontId: string;
  fontSize: number;
  align: TextAlign;
  lineHeight: number;
  geometry: TextGeometry3D;
  material: TextMaterial3D;
  camera: Readonly<{ fieldOfView: number }>;
  lighting: Readonly<{
    ambientIntensity: number;
    keyIntensity: number;
    rimIntensity: number;
  }>;
}>;

export type TextStyle3DOverrides =
  Partial<Omit<TextStyle3D, "mode" | "geometry" | "material" | "camera" | "lighting">>
  & Readonly<{
    geometry?: Partial<Omit<TextGeometry3D, "bevel">> & Readonly<{ bevel?: Partial<TextBevel3D> }>;
    material?: Partial<TextMaterial3D>;
    camera?: Partial<TextStyle3D["camera"]>;
    lighting?: Partial<TextStyle3D["lighting"]>;
  }>;

/*
 * What a caller may hand `createTextStyle2D`.
 *
 * The nested layers arrive partial and are merged onto their own defaults, so a
 * preset can say `background: { shape: "burst", color: "#f00" }` without
 * restating padding, radius and opacity every time -- the same bargain
 * TextStyle3DOverrides already makes for geometry and material.
 */
export type TextStyle2DOverrides =
  Partial<Omit<TextStyle2D, "mode" | "stroke" | "outerStroke" | "shadow" | "glow" | "background" | "decoration">>
  & Readonly<{
    stroke?: Partial<TextStroke>;
    outerStroke?: Partial<TextStroke>;
    shadow?: Partial<TextShadow>;
    glow?: Partial<TextGlow>;
    background?: Partial<TextBackground>;
    decoration?: Partial<TextDecoration>;
  }>;

export type TextStyle = TextStyle2D | TextStyle3D;
export type TextBounds = Readonly<{ width: number; height: number; lineWidths: readonly number[] }>;
