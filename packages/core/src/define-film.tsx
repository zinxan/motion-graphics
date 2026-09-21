import { createElement } from "react";
import type { Film, FilmDefinition, FilmDescriptor, JsonObject } from "./types.js";
import { assertTempo } from "./tempo.js";

const validId = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive integer.`);
  }
}

function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError("Film props may contain only finite JSON numbers.");
  }
  if (typeof value !== "object") throw new TypeError("Film props must contain only JSON values.");
  if (ancestors.has(value)) throw new TypeError("Film props cannot contain circular references.");

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertJson(item, ancestors);
  } else {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Film props may contain only plain JSON objects.");
    }
    for (const item of Object.values(value)) assertJson(item, ancestors);
  }
  ancestors.delete(value);
}

export function defineFilm<Props extends JsonObject>(definition: FilmDefinition<Props>): Film<Props> {
  if (!validId.test(definition.id)) {
    throw new TypeError("Film id must contain only letters, numbers, and hyphens.");
  }
  assertPositiveInteger(definition.width, "width");
  assertPositiveInteger(definition.height, "height");
  assertPositiveInteger(definition.frameRate, "frameRate");
  assertPositiveInteger(definition.frames, "frames");
  if (definition.tempo) assertTempo(definition.tempo);
  assertJson(definition.defaultProps);

  const { component, defaultProps, ...metadata } = definition;
  return {
    ...metadata,
    defaultProps,
    render: (inputProps) => {
      const props = { ...defaultProps, ...inputProps } as Props;
      assertJson(props);
      return createElement(component, props);
    },
  };
}

export function describeFilm<Props extends JsonObject>(film: Film<Props>): FilmDescriptor {
  return {
    id: film.id,
    title: film.title,
    width: film.width,
    height: film.height,
    frameRate: film.frameRate,
    frames: film.frames,
    tempo: film.tempo,
    description: film.description,
    defaultProps: film.defaultProps,
    controls: film.controls,
    render: (inputProps) => film.render(inputProps as Partial<Props>),
  };
}
