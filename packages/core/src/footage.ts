/*
 * Real video, inside a film.
 *
 * A film could already show a still, but moving footage had to be sandwiched
 * on another timeline track underneath it — which meant it could not be put in
 * a tilted card, masked, or drawn behind something the film itself animates.
 *
 * The hard part is not drawing it: it is that a <video> element seeks on its
 * own schedule, and "close enough" is not a frame. So <Footage> never plays
 * anything. It draws a canvas, declares which asset and which instant it wants
 * on that canvas, and the renderer fills every such canvas from a frame
 * provider and waits for all of them before it captures the frame — the same
 * handshake images and fonts already go through.
 *
 * Audio is out of scope here. A film is a picture; keep the sound on a
 * timeline track, where it can be mixed.
 */

export type FootageFit = "cover" | "contain" | "fill";

export type FootageFrameRequest = Readonly<{
  assetId: string;
  /** The instant wanted, in seconds from the start of the source. */
  seconds: number;
}>;

/**
 * Whatever can answer "give me this asset at this instant".
 *
 * The editor answers from the project's own decoder; the command-line renderer
 * answers from a file. Neither is known to a film.
 */
export type FootageProvider = Readonly<{
  frameAt: (request: FootageFrameRequest) => Promise<CanvasImageSource | undefined>;
}>;

export type FootageTiming = Readonly<{
  frame: number;
  frameRate: number;
  /** Seconds into the source that the film's frame zero shows. */
  from?: number;
  /** Playback rate. 2 runs the footage twice as fast; 0.5 slows it down. */
  speed?: number;
  /** The source's length, when known, so the last frame is held rather than run past. */
  duration?: number;
}>;

/**
 * The instant of the source a film frame shows.
 *
 * Held at both ends rather than wrapping or going blank: a film that outlives
 * its footage shows the last frame, which is what a cut to black would have to
 * be asked for explicitly.
 */
export function footageTimeAt(timing: FootageTiming): number {
  const { frame, frameRate, from = 0, speed = 1, duration } = timing;
  if (!Number.isFinite(frameRate) || frameRate <= 0) throw new TypeError("footage frameRate must be positive.");
  if (!Number.isFinite(speed) || speed <= 0) throw new TypeError("Footage speed must be a positive number.");
  if (!Number.isFinite(from) || from < 0) throw new TypeError("Footage from must be a non-negative number.");
  const seconds = from + (Math.max(0, frame) / frameRate) * speed;
  if (duration === undefined) return seconds;
  // A frame's worth before the end: asking for exactly the duration is past
  // the last sample and decoders disagree about what that means.
  return Math.min(seconds, Math.max(0, duration - 1 / frameRate));
}

/** The attribute a canvas awaiting footage carries, and the parts read back off it. */
export const footageAssetAttribute = "data-zxn-footage";
export const footageTimeAttribute = "data-zxn-footage-time";
export const footageFitAttribute = "data-zxn-footage-fit";

type DrawRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Where a source of one shape lands inside a box of another. */
export function fitRect(
  source: Readonly<{ width: number; height: number }>,
  box: Readonly<{ width: number; height: number }>,
  fit: FootageFit,
): DrawRect {
  if (fit === "fill" || source.width <= 0 || source.height <= 0) {
    return { x: 0, y: 0, width: box.width, height: box.height };
  }
  const scale = fit === "cover"
    ? Math.max(box.width / source.width, box.height / source.height)
    : Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } {
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
    return { width: image.videoWidth, height: image.videoHeight };
  }
  const candidate = image as { width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength };
  const width = typeof candidate.width === "number" ? candidate.width : 0;
  const height = typeof candidate.height === "number" ? candidate.height : 0;
  return { width, height };
}

/**
 * Fills every canvas awaiting footage, and resolves once they all hold a frame.
 *
 * Called after React commits and before the frame is captured. A missing
 * provider or a frame the provider cannot supply throws, naming the asset:
 * silently leaving the canvas blank would export a black rectangle that looks
 * deliberate.
 */
export async function paintFootageFrames(
  root: ParentNode,
  provider: FootageProvider | undefined,
): Promise<void> {
  const canvases = [...root.querySelectorAll<HTMLCanvasElement>(`canvas[${footageAssetAttribute}]`)];
  if (canvases.length === 0) return;
  if (!provider) {
    const names = [...new Set(canvases.map((canvas) => canvas.getAttribute(footageAssetAttribute) ?? "?"))];
    throw new Error(`This film shows footage (${names.join(", ")}) but the renderer was given no frame provider.`);
  }
  await Promise.all(canvases.map(async (canvas) => {
    const assetId = canvas.getAttribute(footageAssetAttribute) ?? "";
    const seconds = Number(canvas.getAttribute(footageTimeAttribute) ?? "0");
    const fit = (canvas.getAttribute(footageFitAttribute) ?? "cover") as FootageFit;
    const image = await provider.frameAt({ assetId, seconds });
    if (!image) {
      throw new Error(`Footage "${assetId}" has no frame at ${seconds.toFixed(3)}s. Relink the asset or check its length.`);
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A footage canvas could not provide a 2D context.");
    const box = { width: canvas.width, height: canvas.height };
    const rect = fitRect(sourceSize(image), box, fit);
    context.clearRect(0, 0, box.width, box.height);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }));
}

/** Where a renderer looks for the provider, when one was installed globally. */
export function installedFootageProvider(): FootageProvider | undefined {
  const holder = globalThis as { zxnFootage?: FootageProvider };
  return holder.zxnFootage;
}
