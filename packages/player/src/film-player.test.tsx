import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FilmDescriptor } from "@matildeene/motion-core";
import { FilmPlayer } from "./film-player.js";

const film: FilmDescriptor = {
  id: "portrait",
  title: "Portrait film",
  width: 1080,
  height: 1920,
  frameRate: 30,
  frames: 90,
  defaultProps: {},
  render: () => <div>Frame</div>,
};

describe("FilmPlayer", () => {
  it("sizes itself to the film when its parent has no explicit height", () => {
    const html = renderToStaticMarkup(<FilmPlayer film={film} className="custom-player" />);

    expect(html).toContain('class="zxn-player custom-player"');
    expect(html).toContain('style="aspect-ratio:0.5625"');
  });
});
