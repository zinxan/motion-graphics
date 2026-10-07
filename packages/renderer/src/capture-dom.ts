import { toSvg } from "html-to-image";

/** One canvas per render; each SVG image is released after painting. */
export function createDomCapture(width: number, height: number): Readonly<{
  frame: (surface: HTMLElement, signal?: AbortSignal) => Promise<HTMLCanvasElement>;
  dispose: () => void;
}> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");

  return {
    async frame(surface, signal) {
      signal?.throwIfAborted();
      const svg = await toSvg(surface, { width, height, pixelRatio: 1, skipAutoScale: true });
      signal?.throwIfAborted();
      const image = new Image();
      let abort: (() => void) | undefined;
      try {
        await new Promise<void>((resolve, reject) => {
          abort = () => reject(signal?.reason ?? new DOMException("Render cancelled.", "AbortError"));
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("The film frame could not be rasterized."));
          signal?.addEventListener("abort", abort, { once: true });
          image.src = svg;
          if (signal?.aborted) abort();
        });
        signal?.throwIfAborted();
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return canvas;
      } finally {
        if (abort) signal?.removeEventListener("abort", abort);
        image.onload = null;
        image.onerror = null;
        image.removeAttribute("src");
      }
    },
    dispose() {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
