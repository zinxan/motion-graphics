# @matildeene/motion-renderer

Browser-native MP4, QuickTime MOV, and WebM renderer for ZXN Motion. It commits the Core film at each exact frame, rasterizes the DOM, and encodes an explicit H.264 or VP9 preset through WebCodecs and Mediabunny.

```ts
const bytes = await renderFilm({ film, format: "webm-vp9" });
```

`renderFormats` exposes the stable presets, `getRenderFormat()` returns their file metadata, and `canRenderFilm()` checks exact device support before work begins. Unsupported formats fail; there is no automatic codec fallback.

For large renders, use `renderFilmToStream({ film, writable })`. It uses bounded 1 MiB chunks and waits for the writable's backpressure. Each chunk contains `{ type: "write", data, position }`; respect `position` because container headers can be rewritten. The target closes the stream on success or cancellation, so only commit a destination file after the render promise succeeds.

```ts
const file = await handle.createWritable();
try {
  await renderFilmToStream({
    film,
    writable: new WritableStream({
      write: ({ data, position }) => file.write({ type: "write", data, position }),
    }),
  });
  await file.close();
} catch (error) {
  await file.abort();
  throw error;
}
```

The byte-returning `renderFilm` and `renderFilmToMp4` remain available for small exports. DOM capture reuses one snapshot canvas and releases each image's source and event handlers after painting; both canvases are cleared on completion or failure. Hosts can supply `captureFrame(surface, signal)` returning `{ source, release }` to use their native compositor. Such hosts receive the surface at the viewport origin and must wait for fonts/images, capture the exact film dimensions and release each frame; the renderer calls `release` immediately after copying the pixels, including drawing failures. The CLI uses this path rather than serializing the DOM and embedded images into a new SVG per frame.
