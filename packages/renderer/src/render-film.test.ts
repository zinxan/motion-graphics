import { describe, expect, it } from "vitest";
import { getRenderFormat, renderFormats } from "./render-film.js";

describe("render formats", () => {
  it("publishes stable container and codec pairs", () => {
    expect(renderFormats).toEqual([
      { id: "mp4-h264", label: "MP4", codecLabel: "H.264", extension: "mp4", mimeType: "video/mp4" },
      { id: "mov-h264", label: "QuickTime", codecLabel: "H.264", extension: "mov", mimeType: "video/quicktime" },
      { id: "webm-vp9", label: "WebM", codecLabel: "VP9", extension: "webm", mimeType: "video/webm" },
    ]);
  });

  it("fails explicitly for an unknown runtime identifier", () => {
    expect(() => getRenderFormat("gif" as never)).toThrow("Unknown render format");
  });
});
