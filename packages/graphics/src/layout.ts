import type { MotionGraphic, MotionGraphicElementBounds, MotionGraphicFrame } from "./types.js";

const textWidth = (text: string, fontSize: number): number => Math.max(fontSize, text.length * fontSize * 0.58);

export function layoutMotionGraphicElements(
  graphic: MotionGraphic,
  frame: Pick<MotionGraphicFrame, "width" | "height">,
): readonly MotionGraphicElementBounds[] {
  const { width, height } = frame;
  const scale = Math.min(width / 1280, height / 720);
  const left = -width / 2 + 80 * scale;
  const top = -height / 2 + 64 * scale;
  const contentWidth = width - 160 * scale;
  const chartTop = top + 174 * scale;
  const chartHeight = height - 300 * scale;
  const slots = Math.max(1, graphic.labels.length);
  const slotWidth = contentWidth / slots;
  const seriesWidth = slotWidth * 0.72 / Math.max(1, graphic.series.length);
  const maximum = Math.max(1, ...graphic.series.flatMap((series) => series.values));
  const elements: MotionGraphicElementBounds[] = [
    { id: "background", x: -width / 2, y: -height / 2, width, height },
    { id: "title", x: left, y: top, width: Math.min(contentWidth, textWidth(graphic.title, 52 * scale)), height: 62 * scale },
  ];
  if (graphic.subtitle) elements.push({
    id: "subtitle", x: left, y: top + 72 * scale,
    width: Math.min(contentWidth, textWidth(graphic.subtitle, 22 * scale)), height: 30 * scale,
  });
  graphic.labels.forEach((label, index) => elements.push({
    id: `label:${index}`, x: left + slotWidth * index, y: chartTop + chartHeight + 12 * scale,
    width: slotWidth, height: 28 * scale,
  }));
  if (graphic.chart === "bar") graphic.series.forEach((series, seriesIndex) => {
    series.values.forEach((value, index) => {
      const barHeight = chartHeight * value / maximum;
      elements.push({
        id: `bar:${seriesIndex}:${index}`,
        x: left + index * slotWidth + slotWidth * 0.14 + seriesIndex * seriesWidth,
        y: chartTop + chartHeight - barHeight,
        width: seriesWidth * 0.86,
        height: Math.max(2 * scale, barHeight),
      });
    });
  });
  if (graphic.showLegend) {
    let x = left + contentWidth;
    [...graphic.series].reverse().forEach((series, reverseIndex) => {
      const seriesIndex = graphic.series.length - reverseIndex - 1;
      const width = textWidth(series.name, 16 * scale) + 24 * scale;
      elements.push({ id: `legend:${seriesIndex}`, x: x - width, y: top + 112 * scale, width, height: 28 * scale });
      x -= width + 20 * scale;
    });
  }
  return elements;
}

export function hitTestMotionGraphicElement(
  graphic: MotionGraphic,
  frame: Pick<MotionGraphicFrame, "width" | "height">,
  point: Readonly<{ x: number; y: number }>,
): MotionGraphicElementBounds | undefined {
  return layoutMotionGraphicElements(graphic, frame).findLast((item) => item.id !== "background"
    && point.x >= item.x && point.x <= item.x + item.width
    && point.y >= item.y && point.y <= item.y + item.height)
    ?? layoutMotionGraphicElements(graphic, frame)[0];
}
