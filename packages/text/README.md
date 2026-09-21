# `@zxn/motion-text`

Deterministic, serializable text styles for ZXN Motion projects. The package is independent of React and the editor, so the same style data and renderer are used by the live canvas and exported frames.

## 2D text

```ts
import { createTextStyle2D, renderText2D } from "@zxn/motion-text";

const style = createTextStyle2D({
  fontSize: 96,
  fill: { kind: "linear-gradient", angle: 90, colors: ["#ffffff", "#5ad7ff"] },
  stroke: { color: "#07111f", width: 3 },
  shadow: { color: "#00000080", blur: 24, offsetX: 0, offsetY: 12 },
});

renderText2D(context, "FRAME\nFORWARD", style);
```

`measureText2D()` returns the bounds used by editor hit testing and transform handles. Letter spacing, multiline layout, solid/gradient fills, outlines, italics, and shadows are part of the saved style.

### Surface finishes

Engraved text is an alpha-derived surface finish rather than opaque 3D geometry. Its centre remains transparent so the photographed surface texture survives, while opposing internal highlight and shadow edges create the recessed profile. Deterministic edge breakup, material-opacity variation, and wear stop the glyph silhouette looking mathematically perfect:

```ts
import { createTextStyle2D, createTextSurfaceRelief } from "@zxn/motion-text";

const engraved = createTextStyle2D({
  fontSize: 64,
  surface: createTextSurfaceRelief({
    depth: 5.2,
    angle: 135,
    textureStrength: 0.48,
    edgeRoughness: 0.34,
    wear: 0.08,
  }),
});
```

`createTextSurfacePaint()` provides the complementary thin-paint finish. Paint colour and density remain editable, while finish opacity, surface texture, edge breakup, wear, edge softness, and a deterministic texture seed are shared controls. Engravings additionally expose depth, light angle, cavity shadow, bevel highlight, and cavity tone.

The finish renders before planar homography, so it follows the same tracked physical plane as the glyphs. Engraved centres preserve filmed pixels by drawing only the cavity tone and bevel edges. Painted pixels use partial alpha, retaining local footage contrast during normal compositing. The procedural breakup varies material coverage; it does not inspect or synthesize the underlying footage. Preview and export call the same renderer, and no AI model is required.

### Installed-font catalog

`textFontCatalog` provides categorized system, sans-serif, serif, display, and monospace choices. Every option is an ordered, serializable CSS font-family stack ending in a generic fallback. The package stores only family names: it does not contain, copy, sublicense, or install Apple, Microsoft, or other third-party font files.

The catalog includes generic system choices plus common and macOS-oriented stacks. A named face is used only when it is installed on the render machine, then the saved stack advances in a fixed order. For pixel-identical output across machines, install and license the same chosen font on every render host; system-font metrics can differ by platform. See the [CSS Fonts specification](https://www.w3.org/TR/css-fonts-4/#generic-font-families) and [Apple's system-font catalog](https://developer.apple.com/fonts/system-fonts/) for platform behavior and availability.

## 3D model

`TextStyle3D` defines serializable font selection, extrusion, bevel, and material settings. Applications supply camera, lighting, anchor, and shadow-catcher values to the optional `@zxn/motion-text-three` adapter. That dependency is intentionally kept out of the 2D package surface. Built-in adapter fonts use stable IDs, while the string-based font reference also permits an application to register reviewed custom typeface data without coupling saved projects to Three.js objects.
