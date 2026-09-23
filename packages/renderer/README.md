# @matildeene/motion-renderer

Browser-native MP4, QuickTime MOV, and WebM renderer for ZXN Motion. It commits the Core film at each exact frame, rasterizes the DOM, and encodes an explicit H.264 or VP9 preset through WebCodecs and Mediabunny.

```ts
const bytes = await renderFilm({ film, format: "webm-vp9" });
```

`renderFormats` exposes the stable presets, `getRenderFormat()` returns their file metadata, and `canRenderFilm()` checks exact device support before work begins. Unsupported formats fail; there is no automatic codec fallback.
