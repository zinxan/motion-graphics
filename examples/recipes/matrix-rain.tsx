import { Canvas2D, FullFrame, defineFilm, seededRandom, type CanvasDraw } from "@zxn/motion-core";

/*
 * Matrix-style digital rain, on one canvas.
 *
 * The obvious way to build this -- a <div> per glyph with a glowing text-shadow
 * -- makes a couple of thousand blurred elements and is slow at any size. Here
 * the whole field is a single element drawn in one pass, so it costs the same
 * whether there are forty columns or four hundred.
 *
 * What makes it read as *that* rain rather than as falling text:
 *   - it steps a whole cell at a time, never slides;
 *   - each stream has its own speed, length and start, from a seed, so the
 *     field never pulses in unison;
 *   - the head is near-white and the trail fades out behind it;
 *   - glyphs flicker on their own schedule, a few times a second.
 */

type Props = {
  readonly color: string;
  readonly background: string;
  /** Size of one glyph cell, in pixels. Smaller is denser. */
  readonly cell: number;
  /** How fast the fastest streams fall, in cells per second. */
  readonly speed: number;
};

const glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ0123456789:・=*+<>¦";

const rain = ({ color, background, cell, speed }: Props): CanvasDraw => (context, { seconds, width, height }) => {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.font = `600 ${Math.round(cell * 0.92)}px ui-monospace, "SF Mono", Menlo, monospace`;
  context.textAlign = "center";
  context.textBaseline = "top";

  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  for (let column = 0; column < columns; column += 1) {
    // Everything about a stream comes from its column number, so any frame can be drawn on its own.
    const pace = speed * (0.45 + 0.55 * seededRandom(`pace-${column}`));
    const length = 8 + Math.floor(seededRandom(`length-${column}`) * 22);
    // A short gap before a stream comes round again keeps the field full without ever looking like a wall.
    const cycle = rows + length + Math.floor(seededRandom(`gap-${column}`) * rows * 0.4);
    const head = Math.floor(seconds * pace + seededRandom(`start-${column}`) * cycle) % cycle;

    for (let step = 0; step < length; step += 1) {
      const row = head - step;
      if (row < 0 || row >= rows) continue;
      // A glyph changes a few times a second, each on its own beat.
      const flicker = Math.floor(seconds * (3 + 5 * seededRandom(`flicker-${column}-${row}`)));
      const glyph = glyphs[Math.floor(seededRandom(`glyph-${column}-${row}-${flicker}`) * glyphs.length)]!;
      const fade = 1 - step / length;
      // The trail stays readable most of its length and only dies away at the very end.
      context.globalAlpha = step === 0 ? 1 : 0.12 + 0.88 * Math.sqrt(fade);
      context.fillStyle = step === 0 ? "#eaffef" : color;
      // One soft glow on the head only: blur is the expensive part of any paint.
      context.shadowColor = color;
      context.shadowBlur = step === 0 ? cell * 0.9 : step < 3 ? cell * 0.25 : 0;
      context.fillText(glyph, column * cell + cell / 2, row * cell);
    }
  }
};

function MatrixRain(props: Props) {
  return (
    <FullFrame>
      <Canvas2D draw={rain(props)} />
    </FullFrame>
  );
}

export const matrixRainFilm = defineFilm({
  id: "matrix-rain",
  title: "Matrix rain",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 240,
  component: MatrixRain,
  defaultProps: { color: "#1dff78", background: "#020806", cell: 32, speed: 22 },
  controls: {
    color: { type: "color", label: "Rain" },
    background: { type: "color", label: "Background" },
    cell: { type: "number", label: "Cell size", min: 12, max: 64, step: 2 },
    speed: { type: "number", label: "Speed", min: 4, max: 60, step: 1 },
  },
});

export const films = [matrixRainFilm];
