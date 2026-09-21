import { normalizeTextSurfaceRelief } from "./defaults";
import type { TextSurfaceRelief } from "./types";

type Point = Readonly<{ x: number; y: number }>;
type ReliefBox = Readonly<{ left: number; top: number; width: number; height: number }>;
type ReliefWorkspace = {
  mask: HTMLCanvasElement;
  softened: HTMLCanvasElement;
  shape: HTMLCanvasElement;
  texture: HTMLCanvasElement;
  edge: HTMLCanvasElement;
  output: HTMLCanvasElement;
  maskKey?: string;
};

const workspaces = new WeakMap<CanvasRenderingContext2D, ReliefWorkspace>();
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clean = (value: number): number => Math.abs(value) < 1e-6 ? 0 : value;
const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;
const smoothstep = (start: number, end: number, value: number): number => {
  const amount = clamp01((value - start) / Math.max(1e-6, end - start));
  return amount * amount * (3 - 2 * amount);
};

function hashNoise(x: number, y: number, seed: number): number {
  let value = Math.imul(x | 0, 374_761_393)
    ^ Math.imul(y | 0, 668_265_263)
    ^ Math.imul(seed | 0, 2_147_483_647);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const horizontal = smoothstep(0, 1, x - left);
  const vertical = smoothstep(0, 1, y - top);
  return lerp(
    lerp(hashNoise(left, top, seed), hashNoise(left + 1, top, seed), horizontal),
    lerp(hashNoise(left, top + 1, seed), hashNoise(left + 1, top + 1, seed), horizontal),
    vertical,
  );
}

export function surfaceTextureAlpha(
  x: number,
  y: number,
  glyphAlpha: number,
  input: TextSurfaceRelief,
): number {
  const relief = normalizeTextSurfaceRelief(input);
  const seed = Math.round(relief.seed);
  const texture = clamp01(relief.textureStrength);
  const plaster = valueNoise(x / 3.5, y / 3.5, seed)
    * 0.35 + valueNoise(x / 12, y / 12, seed + 17) * 0.5
    + hashNoise(x, y, seed + 41) * 0.15;
  const material = 1 - texture * 0.52 * (1 - plaster);
  const wear = clamp01(relief.wear);
  const wearNoise = valueNoise(x / 7, y / 7, seed + 83);
  const wearMask = wear <= 0
    ? 1
    : smoothstep(wear * 0.45, Math.min(1, wear * 0.45 + 0.18), wearNoise);
  return clamp01(glyphAlpha) * material * wearMask;
}

export function surfaceReliefShifts(
  depth: number,
  angle: number,
): Readonly<{ shadow: Point; highlight: Point }> {
  const radians = angle * Math.PI / 180;
  const light = {
    x: clean(Math.cos(radians) * Math.max(0, depth)),
    y: clean(-Math.sin(radians) * Math.max(0, depth)),
  };
  return {
    shadow: light,
    highlight: { x: clean(-light.x), y: clean(-light.y) },
  };
}

function createCanvas(context: CanvasRenderingContext2D): HTMLCanvasElement {
  const ownerDocument = context.canvas.ownerDocument ?? document;
  return ownerDocument.createElement("canvas");
}

function resize(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  const changed = canvas.width !== width || canvas.height !== height;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return changed;
}

function workspaceFor(
  destination: CanvasRenderingContext2D,
  width: number,
  height: number,
): ReliefWorkspace {
  let workspace = workspaces.get(destination);
  if (!workspace) {
    workspace = {
      mask: createCanvas(destination),
      softened: createCanvas(destination),
      shape: createCanvas(destination),
      texture: createCanvas(destination),
      edge: createCanvas(destination),
      output: createCanvas(destination),
    };
    workspaces.set(destination, workspace);
  }
  let resized = false;
  for (const canvas of [
    workspace.mask,
    workspace.softened,
    workspace.shape,
    workspace.texture,
    workspace.edge,
    workspace.output,
  ]) {
    resized = resize(canvas, width, height) || resized;
  }
  if (resized) workspace.maskKey = undefined;
  return workspace;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is required for surface-integrated text.");
  return context;
}

function prepareMasks(
  workspace: ReliefWorkspace,
  relief: TextSurfaceRelief,
  cacheKey: string,
  drawMask: (context: CanvasRenderingContext2D) => void,
  box: ReliefBox,
  padding: number,
): void {
  const key = `${cacheKey}\u0000${box.left},${box.top}\u0000${JSON.stringify(relief)}`
    + `\u0000${workspace.mask.width}x${workspace.mask.height}`;
  if (workspace.maskKey === key) return;
  const mask = context2d(workspace.mask);
  mask.clearRect(0, 0, workspace.mask.width, workspace.mask.height);
  mask.save();
  mask.translate(padding - box.left, padding - box.top);
  drawMask(mask);
  mask.restore();

  const softened = context2d(workspace.softened);
  softened.clearRect(0, 0, workspace.softened.width, workspace.softened.height);
  softened.save();
  softened.filter = relief.edgeRoughness > 0
    ? `blur(${0.3 + clamp01(relief.edgeRoughness) * 1.1}px)`
    : "none";
  softened.drawImage(workspace.mask, 0, 0);
  softened.restore();

  const pixels = softened.getImageData(0, 0, workspace.softened.width, workspace.softened.height);
  const shape = new ImageData(pixels.width, pixels.height);
  const texture = new ImageData(pixels.width, pixels.height);
  const roughness = clamp01(relief.edgeRoughness);
  for (let y = 0; y < pixels.height; y += 1) {
    for (let x = 0; x < pixels.width; x += 1) {
      const offset = (y * pixels.width + x) * 4;
      const original = pixels.data[offset + 3]! / 255;
      const edgeNoise = hashNoise(Math.floor(x / 2), Math.floor(y / 2), relief.seed + 7) - 0.5;
      const threshold = 0.5 + edgeNoise * roughness * 0.68;
      const alpha = roughness > 0
        ? smoothstep(threshold - 0.2, threshold + 0.2, original)
        : original;
      const textured = surfaceTextureAlpha(x, y, alpha, relief);
      for (const data of [shape.data, texture.data]) {
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
      }
      shape.data[offset + 3] = Math.round(alpha * 255);
      texture.data[offset + 3] = Math.round(textured * 255);
    }
  }
  context2d(workspace.shape).putImageData(shape, 0, 0);
  context2d(workspace.texture).putImageData(texture, 0, 0);
  workspace.maskKey = key;
}

function paintInternalEdge(
  context: CanvasRenderingContext2D,
  workspace: ReliefWorkspace,
  shift: Point,
  relief: TextSurfaceRelief,
  color: string,
  opacity: number,
): void {
  context.clearRect(0, 0, workspace.shape.width, workspace.shape.height);
  context.drawImage(workspace.shape, 0, 0);
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.filter = relief.softness > 0 ? `blur(${relief.softness}px)` : "none";
  context.drawImage(workspace.shape, shift.x, shift.y);
  context.restore();
  context.save();
  context.globalCompositeOperation = "source-in";
  context.globalAlpha = clamp01(opacity);
  context.fillStyle = color;
  context.fillRect(0, 0, workspace.shape.width, workspace.shape.height);
  context.restore();
  context.save();
  context.globalCompositeOperation = "destination-in";
  context.drawImage(workspace.texture, 0, 0);
  context.restore();
}

function paintText(
  output: CanvasRenderingContext2D,
  workspace: ReliefWorkspace,
  relief: TextSurfaceRelief,
): void {
  output.drawImage(workspace.texture, 0, 0);
  output.save();
  output.globalCompositeOperation = "source-in";
  output.globalAlpha = clamp01(relief.paintOpacity);
  output.fillStyle = relief.paintColor;
  output.fillRect(0, 0, workspace.texture.width, workspace.texture.height);
  output.restore();
}

export function renderTextSurfaceRelief(
  destination: CanvasRenderingContext2D,
  box: ReliefBox,
  input: TextSurfaceRelief,
  cacheKey: string,
  drawMask: (context: CanvasRenderingContext2D) => void,
): void {
  const relief = normalizeTextSurfaceRelief(input);
  const padding = Math.ceil(Math.max(3, relief.depth + relief.softness * 2 + 2));
  const width = Math.max(1, Math.ceil(box.width + padding * 2));
  const height = Math.max(1, Math.ceil(box.height + padding * 2));
  const workspace = workspaceFor(destination, width, height);
  prepareMasks(workspace, relief, cacheKey, drawMask, box, padding);

  const output = context2d(workspace.output);
  output.clearRect(0, 0, width, height);
  if (relief.kind === "painted") {
    paintText(output, workspace, relief);
  } else {
    if (relief.imprintOpacity > 0) {
      output.save();
      output.globalAlpha = clamp01(relief.imprintOpacity);
      output.filter = "brightness(0)";
      output.drawImage(workspace.texture, 0, 0);
      output.restore();
    }
    const edge = context2d(workspace.edge);
    const shifts = surfaceReliefShifts(relief.depth, relief.angle);
    paintInternalEdge(edge, workspace, shifts.shadow, relief, "#000", relief.shadowOpacity);
    output.drawImage(workspace.edge, 0, 0);
    paintInternalEdge(edge, workspace, shifts.highlight, relief, "#fff", relief.highlightOpacity);
    output.drawImage(workspace.edge, 0, 0);
  }
  destination.save();
  destination.globalAlpha = clamp01(relief.finishOpacity);
  destination.drawImage(workspace.output, box.left - padding, box.top - padding);
  destination.restore();
}
