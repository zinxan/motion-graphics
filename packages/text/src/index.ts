export {
  isBackdropDecoration,
  renderTextDecoration,
  textDecorationKinds,
  textDecorationOverflow,
  textDecorationLabels,
  type TextDecoration,
  type TextDecorationKind,
} from "./decoration.js";
export {
  evaluateTextAnimation,
  restingTextAnimation,
  textAnimationIds,
  textAnimationLabels,
  textLoopIds,
  textLoopLabels,
  type TextAnimation,
  type TextAnimationId,
  type TextAnimationOptions,
  type TextAnimationState,
  type TextAnimationStep,
  type TextLoop,
  type TextLoopId,
} from "./animation.js";
export { roughenOutline, textBackgroundOutline, textBackgroundOverflow, textBackgroundPath, traceOutline, type PlateOutline, type PlatePoint, type PlateRect } from "./background-shape.js";
export {
  createTextStyle2D,
  createTextStyle3D,
  createTextSurfacePaint,
  createTextSurfaceRelief,
  defaultTextBackground,
  defaultTextDecoration,
  defaultTextGlow,
  defaultTextStyle2D,
  defaultTextStyle3D,
  defaultTextSurfacePaint,
  defaultTextSurfaceRelief,
  normalizeTextSurfaceRelief,
} from "./defaults.js";
export {
  defaultTextFontFamily,
  findTextFont,
  textFontCatalog,
  textFontCategoryLabels,
  textFontCategoryOrder,
  textFontsByCategory,
  type TextFontAvailability,
  type TextFontCategory,
  type TextFontOption,
} from "./font-catalog.js";
export { alignedLineStart, estimateText2D, measureLine, measureText2D, paintedTextBounds2D, textFont, type TextMeasureContext, type TextMeasurer } from "./layout.js";
export { createTextMaterial3D, textMaterialPresets } from "./presets.js";
export { renderText2D } from "./render-2d.js";
export { surfaceReliefShifts, surfaceTextureAlpha } from "./surface-relief.js";
export type {
  TextAlign,
  TextBevel3D,
  TextBounds,
  TextBackground,
  TextBackgroundDecor,
  TextBackgroundEdge,
  TextBackgroundOutline,
  TextBackgroundShadow,
  TextBackgroundShape,
  TextBackgroundStroke,
  TextFill,
  TextGeometry3D,
  TextMaterial3D,
  TextMaterialPreset,
  TextGlow,
  TextShadow,
  TextStroke,
  TextSurfaceRelief,
  TextStyle,
  TextStyle2D,
  TextStyle2DOverrides,
  TextStyle3D,
  TextStyle3DOverrides,
} from "./types.js";
