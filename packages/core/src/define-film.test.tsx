import { describe, expect, it } from "vitest";
import { defineFilm, describeFilm } from "./define-film.js";

const Empty = () => <div />;

describe("defineFilm", () => {
  it("creates a typed renderable film", () => {
    const film = defineFilm({
      id: "product-intro",
      title: "Product intro",
      width: 1920,
      height: 1080,
      frameRate: 30,
      frames: 90,
      component: ({ title }: { readonly title: string }) => <div>{title}</div>,
      defaultProps: { title: "Hello" },
    });
    const descriptor = describeFilm(film);
    expect(descriptor.id).toBe("product-intro");
    expect(descriptor.render({ title: "Changed" }).props).toEqual({ title: "Changed" });
  });

  it("rejects invalid identifiers and dimensions", () => {
    expect(() => defineFilm({ id: "not valid", title: "Bad", width: 1, height: 1, frameRate: 1, frames: 1, component: Empty, defaultProps: {} })).toThrow("Film id");
    expect(() => defineFilm({ id: "valid", title: "Bad", width: 0, height: 1, frameRate: 1, frames: 1, component: Empty, defaultProps: {} })).toThrow("width");
  });

  it("rejects values that JSON would silently change", () => {
    expect(() => defineFilm({ id: "nan", title: "Bad", width: 1, height: 1, frameRate: 1, frames: 1, component: Empty, defaultProps: { value: Number.NaN } })).toThrow("finite JSON numbers");
    expect(() => defineFilm({ id: "date", title: "Bad", width: 1, height: 1, frameRate: 1, frames: 1, component: Empty, defaultProps: { value: new Date() } as never })).toThrow("plain JSON objects");
  });
});
