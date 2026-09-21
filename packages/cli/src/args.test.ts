import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("parses a render command", () => {
    expect(parseArgs(["render", "films.tsx", "intro", "intro.mp4", "--force"])).toEqual({
      kind: "render",
      entry: "films.tsx",
      filmId: "intro",
      output: "intro.mp4",
      format: "mp4-h264",
      propsPath: undefined,
      cssPath: undefined,
      appRoot: undefined,
      footage: {},
      force: true,
    });
  });

  it("collects footage files by asset id", () => {
    expect(parseArgs([
      "render", "films.tsx", "intro", "intro.mp4",
      "--footage", "dog=/clips/dog.mov",
      "--footage", "city=/clips/city.mp4",
    ])).toMatchObject({
      footage: { dog: "/clips/dog.mov", city: "/clips/city.mp4" },
    });
  });

  it("refuses footage that does not name an asset", () => {
    expect(() => parseArgs(["render", "films.tsx", "intro", "intro.mp4", "--footage", "/clips/dog.mov"]))
      .toThrow(/asset-id/);
  });

  it("takes a stylesheet and an application root", () => {
    expect(parseArgs([
      "render", "films.tsx", "intro", "intro.mp4", "--css", "film.css", "--app-root", "src",
    ])).toMatchObject({ cssPath: "film.css", appRoot: "src" });
  });

  it("infers WebM with VP9 from the extension", () => {
    expect(parseArgs(["render", "films.tsx", "intro", "intro.webm"])).toMatchObject({
      kind: "render",
      format: "webm-vp9",
    });
  });

  it("infers QuickTime with H.264 from the extension", () => {
    expect(parseArgs(["render", "films.tsx", "intro", "intro.mov"])).toMatchObject({
      kind: "render",
      format: "mov-h264",
    });
  });

  it("rejects unsupported output", () => {
    expect(() => parseArgs(["render", "films.tsx", "intro", "intro.gif"])).toThrow(".mp4");
  });

  it("shows help without arguments", () => {
    expect(parseArgs([])).toEqual({ kind: "help" });
  });
});
