import type { MotionGraphic, MotionGraphicFrame } from "./types";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - (1 - clamp(value)) ** 3;

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string): void {
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

export function renderMotionGraphic(context: CanvasRenderingContext2D, graphic: MotionGraphic, frame: MotionGraphicFrame): void {
  const { width, height } = frame;
  const scale = Math.min(width / 1280, height / 720);
  const left = -width / 2 + 80 * scale;
  const top = -height / 2 + 64 * scale;
  const contentWidth = width - 160 * scale;
  const chartTop = top + 174 * scale;
  const chartHeight = height - 270 * scale;
  const intro = easeOut(frame.localSeconds / 0.55);

  roundedRect(context, -width / 2, -height / 2, width, height, 0, graphic.background);
  context.globalAlpha *= intro;
  context.fillStyle = graphic.foreground;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = `700 ${52 * scale}px system-ui`;
  context.fillText(graphic.title, left, top, contentWidth);
  if (graphic.subtitle) {
    context.globalAlpha *= 0.68;
    context.font = `400 ${22 * scale}px system-ui`;
    context.fillText(graphic.subtitle, left, top + 72 * scale, contentWidth);
    context.globalAlpha /= 0.68;
  }

  const values = graphic.series.flatMap((series) => series.values);
  const maximum = Math.max(1, ...values);
  context.strokeStyle = `${graphic.foreground}24`;
  context.lineWidth = scale;
  for (let row = 0; row <= 4; row += 1) {
    const y = chartTop + chartHeight * row / 4;
    context.beginPath(); context.moveTo(left, y); context.lineTo(left + contentWidth, y); context.stroke();
  }
  const slots = Math.max(1, graphic.labels.length);
  const slotWidth = contentWidth / slots;
  const seriesWidth = slotWidth * 0.72 / Math.max(1, graphic.series.length);
  const drawProgress = easeOut((frame.localSeconds - 0.22) / Math.min(1.2, frame.durationSeconds * 0.35));

  graphic.series.forEach((series, seriesIndex) => {
    if (graphic.chart === "bar") {
      series.values.forEach((value, index) => {
        const barHeight = chartHeight * value / maximum * drawProgress;
        const x = left + index * slotWidth + slotWidth * 0.14 + seriesIndex * seriesWidth;
        roundedRect(context, x, chartTop + chartHeight - barHeight, seriesWidth * 0.86, barHeight, 7 * scale, series.color);
      });
      return;
    }
    context.strokeStyle = series.color;
    context.lineWidth = 5 * scale;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    series.values.forEach((value, index) => {
      const x = left + slotWidth * (index + 0.5);
      const y = chartTop + chartHeight * (1 - value / maximum);
      const visibleX = left + (x - left) * drawProgress;
      if (index === 0) context.moveTo(visibleX, y); else context.lineTo(visibleX, y);
    });
    context.stroke();
  });

  context.fillStyle = graphic.foreground;
  context.globalAlpha *= 0.7;
  context.font = `500 ${16 * scale}px system-ui`;
  context.textAlign = "center";
  graphic.labels.forEach((label, index) => context.fillText(label, left + slotWidth * (index + 0.5), chartTop + chartHeight + 16 * scale, slotWidth * 0.9));
  context.globalAlpha /= 0.7;
  if (graphic.showLegend) {
    context.textAlign = "right";
    context.font = `600 ${16 * scale}px system-ui`;
    let x = left + contentWidth;
    [...graphic.series].reverse().forEach((series) => {
      const labelWidth = context.measureText(series.name).width;
      context.fillStyle = graphic.foreground;
      context.fillText(series.name, x, top + 116 * scale);
      x -= labelWidth + 26 * scale;
      context.fillStyle = series.color;
      context.beginPath(); context.arc(x + 8 * scale, top + 126 * scale, 5 * scale, 0, Math.PI * 2); context.fill();
      x -= 20 * scale;
    });
  }
}
