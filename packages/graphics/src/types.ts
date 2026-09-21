export type GraphicSeries = Readonly<{
  name: string;
  color: string;
  values: readonly number[];
}>;

export type MotionGraphic = Readonly<{
  kind: "chart";
  chart: "bar" | "line";
  title: string;
  subtitle?: string;
  labels: readonly string[];
  series: readonly GraphicSeries[];
  background: string;
  foreground: string;
  accent: string;
  showLegend: boolean;
}>;

export type MotionGraphicFrame = Readonly<{
  width: number;
  height: number;
  localSeconds: number;
  durationSeconds: number;
}>;

export type MotionGraphicElementId =
  | "background"
  | "title"
  | "subtitle"
  | `label:${number}`
  | `legend:${number}`
  | `bar:${number}:${number}`;

export type MotionGraphicElementBounds = Readonly<{
  id: MotionGraphicElementId;
  x: number;
  y: number;
  width: number;
  height: number;
}>;
