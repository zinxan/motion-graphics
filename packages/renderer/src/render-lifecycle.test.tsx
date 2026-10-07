// @vitest-environment happy-dom
import { describeFilm, defineFilm, useTimeline } from "@matildeene/motion-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderFilm, renderFilmToStream } from "./render-film.js";

const { add, start, finalize, cancel, targetOptions } = vi.hoisted(() => ({
  add: vi.fn(), start: vi.fn(), finalize: vi.fn(), cancel: vi.fn(), targetOptions: vi.fn(),
}));
vi.mock("mediabunny", () => ({
  BufferTarget: class { buffer = new ArrayBuffer(4); },
  StreamTarget: class { constructor(...args: unknown[]) { targetOptions(...args); } },
  Output: class { addVideoTrack() {} start = start; finalize = finalize; cancel = cancel; },
  CanvasSource: class { add = add; },
  Mp4OutputFormat: class {}, MovOutputFormat: class {}, WebMOutputFormat: class {},
  QUALITY_HIGH: 1, canEncodeVideo: async () => true,
}));

function Scene() {
  const { frame } = useTimeline();
  return <div data-frame={frame}>Frame {frame}</div>;
}
const film = describeFilm(defineFilm({ id: "test", title: "Test", width: 320, height: 180, frameRate: 30, frames: 3, component: Scene, defaultProps: {} }));

describe("render lifecycle", () => {
  const release = vi.fn();
  const drawImage = vi.fn();
  const capturedFrames: string[] = [];
  const captureFrame = vi.fn(async (surface: HTMLElement) => {
    capturedFrames.push(surface.querySelector("[data-frame]")?.getAttribute("data-frame") ?? surface.getAttribute("data-frame") ?? "missing");
    return { source: document.createElement("canvas"), release };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
    capturedFrames.length = 0;
    add.mockResolvedValue(undefined);
    start.mockResolvedValue(undefined);
    finalize.mockResolvedValue(undefined);
    cancel.mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("captures every exact frame and releases it before encoding", async () => {
    expect(await renderFilm({ film, captureFrame })).toHaveLength(4);
    expect(capturedFrames).toEqual(["0", "1", "2"]);
    expect(release).toHaveBeenCalledTimes(3);
    expect(add.mock.calls.map(call => call[0])).toEqual([0, 1 / 30, 2 / 30]);
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(add.mock.invocationCallOrder[0]!);
    expect(document.querySelector("[data-zxn-render-host]")).toBeNull();
  });

  it("waits for encoder backpressure before capturing the next frame", async () => {
    let resume!: () => void;
    add.mockImplementationOnce(() => new Promise<void>(resolve => { resume = resolve; }));
    const pending = renderFilm({ film, captureFrame });
    await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
    expect(captureFrame).toHaveBeenCalledOnce();
    resume();
    await pending;
  });

  it("releases a captured frame and removes the host when drawing fails", async () => {
    drawImage.mockImplementationOnce(() => { throw new Error("draw failed"); });
    await expect(renderFilm({ film, captureFrame })).rejects.toThrow("draw failed");
    expect(release).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-zxn-render-host]")).toBeNull();
  });

  it("cancels without finalizing when the caller aborts", async () => {
    const controller = new AbortController();
    await expect(renderFilm({ film, captureFrame, signal: controller.signal, onProgress: () => controller.abort() })).rejects.toMatchObject({ name: "AbortError" });
    expect(captureFrame).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();
    expect(document.querySelector("[data-zxn-render-host]")).toBeNull();
  });

  it("uses a bounded streaming target rather than the byte-returning target", async () => {
    const writable = new WritableStream();
    await renderFilmToStream({ film, captureFrame, writable });
    expect(targetOptions).toHaveBeenCalledWith(writable, { chunked: true, chunkSize: 1024 * 1024 });
    expect(finalize).toHaveBeenCalledOnce();
  });
});
