import type { ComponentType, ReactElement } from "react";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

/**
 * The musical grid a film is cut to.
 *
 * `offsetSeconds` is where bar zero sits in the film, so a track with a pickup
 * or a moment of silence before the downbeat still lines up.
 */
export type FilmTempo = Readonly<{
  bpm: number;
  beatsPerBar?: number;
  offsetSeconds?: number;
}>;

export type FilmMetadata = Readonly<{
  controls?: Readonly<Record<string, Readonly<{
    type: "text" | "number" | "color" | "boolean" | "choice";
    label: string; min?: number; max?: number; step?: number; options?: readonly string[];
  }>>>;
  id: string;
  title: string;
  width: number;
  height: number;
  frameRate: number;
  frames: number;
  tempo?: FilmTempo;
}>;

export type FilmDefinition<Props extends JsonObject> = FilmMetadata & Readonly<{
  component: ComponentType<Props>;
  defaultProps: Props;
  description?: string;
}>;

export type Film<Props extends JsonObject> = FilmMetadata & Readonly<{
  description?: string;
  defaultProps: Props;
  render: (inputProps?: Partial<Props>) => ReactElement;
}>;

export type FilmDescriptor = FilmMetadata & Readonly<{
  description?: string;
  defaultProps: JsonObject;
  render: (inputProps?: JsonObject) => ReactElement;
}>;

export type FrameSnapshot = Readonly<{
  absoluteFrame: number;
  frame: number;
  film: FilmMetadata;
}>;

export type VirtualTime = Readonly<{
  frame: number;
  seconds: number;
  milliseconds: number;
}>;

export type RenderProgress = Readonly<{
  frame: number;
  totalFrames: number;
  ratio: number;
}>;
