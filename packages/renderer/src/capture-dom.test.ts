// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toSvg } from "html-to-image";
import { createDomCapture } from "./capture-dom.js";

vi.mock("html-to-image", () => ({ toSvg: vi.fn() }));

describe("DOM capture resource lifetime", () => {
  const drawImage = vi.fn();
  let image: HTMLImageElement;
  beforeEach(() => {
    vi.mocked(toSvg).mockResolvedValue("data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal("Image", class {
      src = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { image = this as unknown as HTMLImageElement; }
      removeAttribute() { this.src = ""; }
      hasAttribute() { return this.src !== ""; }
      async decode() {}
      dispatchEvent(event: Event) { if (event.type === "load") this.onload?.(); else this.onerror?.(); }
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  async function loaded(pending: Promise<HTMLCanvasElement>): Promise<HTMLCanvasElement> {
    await vi.waitFor(() => expect(image.src).toMatch(/^data:image\/svg/));
    image.dispatchEvent(new Event("load"));
    return pending;
  }

  it("reuses its canvas and releases each SVG image after painting", async () => {
    const capture = createDomCapture(320, 180);
    const first = await loaded(capture.frame(document.createElement("div")));
    expect(drawImage).toHaveBeenCalledOnce();
    expect(image.hasAttribute("src")).toBe(false);
    const second = await loaded(capture.frame(document.createElement("div")));
    expect(second).toBe(first);
    capture.dispose();
    expect(first.width).toBe(0);
    expect(first.height).toBe(0);
  });

  it("releases the image on rasterization failure", async () => {
    const capture = createDomCapture(320, 180);
    const pending = capture.frame(document.createElement("div"));
    const failure = expect(pending).rejects.toThrow("rasterized");
    await vi.waitFor(() => expect(image.src).toMatch(/^data:image\/svg/));
    image.dispatchEvent(new Event("error"));
    await failure;
    expect(drawImage).not.toHaveBeenCalled();
    capture.dispose();
  });

  it("releases the pending image when cancelled", async () => {
    const capture = createDomCapture(320, 180);
    const controller = new AbortController();
    const pending = capture.frame(document.createElement("div"), controller.signal);
    const failure = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(image.src).toMatch(/^data:image\/svg/));
    controller.abort();
    await failure;
    expect(image.onload).toBeNull();
    expect(drawImage).not.toHaveBeenCalled();
    capture.dispose();
  });
});
