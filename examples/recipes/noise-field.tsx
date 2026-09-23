import { createNoise3D } from "simplex-noise";
import { Canvas2D, FullFrame, defineFilm, seededRandom, type CanvasDraw } from "@matildeene/motion-core";

/*
 * A flowing field of lines, from simplex noise.
 *
 * The one thing to get right with a noise library in a film: **seed it**.
 * `createNoise3D()` with no argument draws on Math.random and gives a different
 * field every time it is built -- a different film on every render. Hand it a
 * deterministic source instead and the field is the same in the preview, in a
 * scrub and in the export. It is built once, outside the component.
 *
 * Time is the noise's third axis, which is what makes the field drift rather
 * than jump: nearby frames are nearby points in the same smooth volume.
 */

type Props = { readonly background: string; readonly from: string; readonly to: string; readonly drift: number };

let draws = 0;
const noise = createNoise3D(() => seededRandom(`noise-field-${draws++}`));

const field = ({ background, from, to, drift }: Props): CanvasDraw => (context, { seconds, width, height }) => {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.lineWidth = 5;
  context.lineCap = "round";
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  context.strokeStyle = gradient;

  const spacing = 56;
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      const angle = noise(x / 520, y / 520, seconds * drift) * Math.PI * 2;
      const reach = 16 + 26 * (noise(x / 300, y / 300, seconds * drift + 40) * 0.5 + 0.5);
      context.globalAlpha = 0.55 + 0.45 * (noise(x / 700, y / 700, seconds * drift - 40) * 0.5 + 0.5);
      context.beginPath();
      context.moveTo(x - Math.cos(angle) * reach, y - Math.sin(angle) * reach);
      context.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
      context.stroke();
    }
  }
};

function NoiseField(props: Props) {
  return <FullFrame><Canvas2D draw={field(props)} /></FullFrame>;
}

export const noiseFieldFilm = defineFilm({
  id: "noise-field",
  title: "Noise field",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 180,
  component: NoiseField,
  defaultProps: { background: "#0b0c0e", from: "#9d8bff", to: "#3ff0d6", drift: 0.18 },
  controls: {
    background: { type: "color", label: "Background" },
    from: { type: "color", label: "From" },
    to: { type: "color", label: "To" },
    drift: { type: "number", label: "Drift", min: 0, max: 1, step: 0.02 },
  },
});

export const films = [noiseFieldFilm];
