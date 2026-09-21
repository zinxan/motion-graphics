import { FilmSurface, installedFootageProvider, paintFootageFrames, type FilmDescriptor, type JsonObject, type RenderProgress } from "@zxn/motion-core";
import { toCanvas } from "html-to-image";
import {
  BufferTarget,
  canEncodeVideo,
  CanvasSource,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
} from "mediabunny";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

export type RenderFilmOptions = Readonly<{
  film: FilmDescriptor;
  format?: RenderFormatId;
  inputProps?: JsonObject;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
}>;

export const renderFormats = [
  { id: "mp4-h264", label: "MP4", codecLabel: "H.264", extension: "mp4", mimeType: "video/mp4" },
  { id: "mov-h264", label: "QuickTime", codecLabel: "H.264", extension: "mov", mimeType: "video/quicktime" },
  { id: "webm-vp9", label: "WebM", codecLabel: "VP9", extension: "webm", mimeType: "video/webm" },
] as const;

export type RenderFormatId = typeof renderFormats[number]["id"];
export type RenderFormat = typeof renderFormats[number];

export function getRenderFormat(id: RenderFormatId): RenderFormat {
  const format = renderFormats.find((candidate) => candidate.id === id);
  if (!format) throw new TypeError(`Unknown render format: ${id as string}`);
  return format;
}

const afterPaint = async (): Promise<void> => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

function createRenderHost(film: FilmDescriptor): HTMLDivElement {
  const host = document.createElement("div");
  host.dataset.zxnRenderHost = film.id;
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${film.width}px`,
    height: `${film.height}px`,
    overflow: "hidden",
    pointerEvents: "none",
  });
  document.body.append(host);
  return host;
}

export async function canRenderFilm(film: FilmDescriptor, format: RenderFormatId = "mp4-h264"): Promise<boolean> {
  const codec = format === "webm-vp9" ? "vp9" : "avc";
  return canEncodeVideo(codec, { width: film.width, height: film.height, bitrate: QUALITY_HIGH });
}

/**
 * Rethrows a render failure.
 *
 * React reports it through a callback, so the variable holding it is assigned
 * from a closure and the lint rule that checks what is thrown cannot see that
 * it is an Error by then. A helper that only ever takes one says so in its
 * signature instead.
 */
function rethrow(error: Error): never {
  throw error;
}

export async function renderFilm(options: RenderFilmOptions): Promise<Uint8Array> {
  const { film, format: formatId = "mp4-h264", inputProps, signal, onProgress } = options;
  const format = getRenderFormat(formatId);
  if (!(await canRenderFilm(film, formatId))) {
    throw new Error(`This device cannot encode ${film.width}×${film.height} ${format.codecLabel} video.`);
  }

  const encodingCanvas = document.createElement("canvas");
  encodingCanvas.width = film.width;
  encodingCanvas.height = film.height;
  const context = encodingCanvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D is unavailable.");

  const target = new BufferTarget();
  const outputFormat = formatId === "webm-vp9"
    ? new WebMOutputFormat()
    : formatId === "mov-h264" ? new MovOutputFormat() : new Mp4OutputFormat();
  const codec = formatId === "webm-vp9" ? "vp9" : "avc";
  const output = new Output({ format: outputFormat, target });
  const video = new CanvasSource(encodingCanvas, { codec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: film.frameRate });
  const host = createRenderHost(film);
  /*
   * React 19 reports an uncaught render error to its own handler and leaves
   * the tree empty rather than throwing out of flushSync. Without this, a film
   * that threw failed here as "the film surface did not mount", which says
   * nothing about the component that actually broke.
   */
  let renderError: Error | undefined;
  const root = createRoot(host, {
    onUncaughtError: (error: unknown) => {
      renderError ??= error instanceof Error ? error : new Error(String(error));
    },
  });
  let started = false;

  try {
    await document.fonts.ready;
    await output.start();
    started = true;
    for (let frame = 0; frame < film.frames; frame += 1) {
      if (signal?.aborted) throw new DOMException("Render cancelled.", "AbortError");
      renderError = undefined;
      flushSync(() => root.render(<FilmSurface film={film} frame={frame} inputProps={inputProps} />));
      if (renderError) rethrow(renderError);
      // Footage is filled after the commit and before the capture, the same
      // place images and fonts are waited for.
      await paintFootageFrames(host, installedFootageProvider());
      await afterPaint();
      const surface = host.firstElementChild;
      if (!(surface instanceof HTMLElement)) throw new Error("The film surface did not mount.");
      const snapshot = await toCanvas(surface, {
        width: film.width,
        height: film.height,
        pixelRatio: 1,
        skipAutoScale: true,
      });
      context.clearRect(0, 0, film.width, film.height);
      context.drawImage(snapshot, 0, 0, film.width, film.height);
      const duration = 1 / film.frameRate;
      await video.add(frame * duration, duration, { keyFrame: frame % (film.frameRate * 2) === 0 });
      onProgress?.({ frame: frame + 1, totalFrames: film.frames, ratio: (frame + 1) / film.frames });
    }
    await output.finalize();
    if (!target.buffer) throw new Error("The encoder returned an empty render.");
    return new Uint8Array(target.buffer);
  } catch (error) {
    if (started) await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    flushSync(() => root.unmount());
    host.remove();
  }
}

export function renderFilmToMp4(options: Omit<RenderFilmOptions, "format">): Promise<Uint8Array> {
  return renderFilm({ ...options, format: "mp4-h264" });
}
