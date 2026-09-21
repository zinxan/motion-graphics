import { Canvas2D, FullFrame, defineFilm, easing, mapRange, seededRandom, springValue, useTimeline, type CanvasDraw } from "@zxn/motion-core";

/*
 * A cartoon television with a play button, the kind a 1960s short would open on.
 *
 * Two techniques in one film, each where it belongs:
 *   - the set itself is SVG: a few dozen shapes with thick ink outlines, which
 *     stay crisp at any size and are easy to restyle from props;
 *   - the screen's static is a small <Canvas2D>, because "a few thousand random
 *     specks that change every frame" is exactly what DOM is bad at.
 *
 * The motion is squash-and-stretch, borrowed from the same cartoons: the set
 * drops in and overshoots, the antennae lag behind it, and the play button
 * pulses until it is pressed. The static clears the moment it is.
 */

type Props = {
  readonly body: string;
  readonly screen: string;
  readonly accent: string;
  readonly background: string;
};

const ink = "#1b1410";
const pressAt = 96;

/** Coarse, chunky static: big specks read as "old TV", fine noise reads as "broken GPU". */
const staticNoise = (strength: number): CanvasDraw => (context, { frame, width, height }) => {
  const speck = 8;
  for (let y = 0; y < height; y += speck) {
    for (let x = 0; x < width; x += speck) {
      const value = seededRandom(`${frame}-${x}-${y}`);
      context.fillStyle = `rgba(255,255,255,${(value * 0.85 * strength).toFixed(3)})`;
      context.fillRect(x, y, speck, speck);
    }
  }
  // A rolling bar, because a picture that holds still never looked like a broadcast.
  const bar = ((frame * 9) % (height + 120)) - 120;
  context.fillStyle = `rgba(255,255,255,${0.16 * strength})`;
  context.fillRect(0, bar, width, 70);
};

function RetroTv({ body, screen, accent, background }: Props) {
  const { frame, film } = useTimeline();
  const fps = film.frameRate;
  // The drop: a loose spring, so it overshoots and settles like something with weight.
  const drop = springValue({ frame, frameRate: fps, stiffness: 140, damping: 11 });
  const landing = Math.max(0, 1 - Math.abs(drop - 1) * 6) * mapRange(frame, [6, 22], [1, 0], { clamp: true });
  const squash = 1 - 0.12 * landing;
  // The antennae follow the body a few frames late, which is what makes them look attached by springs.
  const lag = springValue({ frame: frame - 5, frameRate: fps, stiffness: 90, damping: 7 });
  const wobble = (1 - lag) * 38;

  const pressed = frame >= pressAt;
  const press = springValue({ frame: frame - pressAt, frameRate: fps, stiffness: 260, damping: 14 });
  const pulse = pressed ? 1 - 0.18 * Math.max(0, 1 - press * 1.6) : 1 + 0.06 * Math.sin((frame / fps) * Math.PI * 2.2);
  const staticStrength = pressed ? mapRange(frame, [pressAt, pressAt + 10], [1, 0], { clamp: true, ease: easing.easeOut }) : 1;
  const glow = pressed ? mapRange(frame, [pressAt, pressAt + 18], [0, 1], { clamp: true, ease: easing.easeOut }) : 0;

  return (
    <FullFrame style={{ background, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 1000, height: 860, transform: `translateY(${(1 - drop) * -900}px) scale(${2 - squash}, ${squash})`, transformOrigin: "50% 100%" }}>
        <svg width={1000} height={860} viewBox="0 0 1000 860" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* Antennae, drawn first so the body overlaps their roots. */}
          <g stroke={ink} strokeWidth={12} strokeLinecap="round" fill="none">
            <path d={`M470 150 Q ${420 - wobble} 80 ${330 - wobble * 1.6} 22`} />
            <path d={`M530 150 Q ${580 + wobble} 80 ${670 + wobble * 1.6} 22`} />
          </g>
          <circle cx={330 - wobble * 1.6} cy={22} r={18} fill={accent} stroke={ink} strokeWidth={10} />
          <circle cx={670 + wobble * 1.6} cy={22} r={18} fill={accent} stroke={ink} strokeWidth={10} />
          <ellipse cx={500} cy={156} rx={70} ry={22} fill={ink} />

          {/* Legs, then the cabinet with its hand-drawn, slightly uneven corners. */}
          <g stroke={ink} strokeWidth={14} strokeLinecap="round">
            <line x1={250} y1={760} x2={200} y2={846} />
            <line x1={750} y1={760} x2={800} y2={846} />
          </g>
          <path d="M120 190 Q110 160 150 156 L850 150 Q892 152 886 196 L892 730 Q890 772 846 770 L150 776 Q108 774 112 730 Z"
            fill={body} stroke={ink} strokeWidth={16} strokeLinejoin="round" />
          <path d="M150 730 L846 724" stroke={ink} strokeWidth={6} opacity={0.25} strokeLinecap="round" />

          {/* The screen's bezel. The picture itself is the HTML layer below. */}
          <path d="M180 230 Q176 210 204 208 L664 204 Q692 206 690 232 L694 678 Q692 704 664 704 L204 708 Q176 706 178 680 Z"
            fill={ink} />

          {/* Controls: two dials and a speaker grille. */}
          <circle cx={790} cy={300} r={48} fill="#f1e6cf" stroke={ink} strokeWidth={12} />
          <line x1={790} y1={300} x2={790 + 30 * Math.sin(frame / 14)} y2={300 - 30 * Math.cos(frame / 14)} stroke={ink} strokeWidth={10} strokeLinecap="round" />
          <circle cx={790} cy={430} r={36} fill="#f1e6cf" stroke={ink} strokeWidth={12} />
          {Array.from({ length: 5 }, (_, row) => (
            <line key={row} x1={746} y1={530 + row * 30} x2={834} y2={530 + row * 30} stroke={ink} strokeWidth={10} strokeLinecap="round" />
          ))}
        </svg>

        {/* The picture tube: rounded like the glass, clipped so the static stays inside it. */}
        <div style={{ position: "absolute", left: 204, top: 232, width: 464, height: 450, borderRadius: "44px / 52px", overflow: "hidden", background: screen,
          boxShadow: `inset 0 0 90px rgba(0,0,0,.55), 0 0 ${80 * glow}px ${accent}` }}>
          <Canvas2D width={232} height={225} draw={staticNoise(staticStrength)} style={{ imageRendering: "pixelated" }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, ${accent}, transparent 70%)`, opacity: 0.55 * glow }} />
          {/* The play button. A circle and a triangle, scaled from its own centre. */}
          <svg width={464} height={450} viewBox="-232 -225 464 450" style={{ position: "absolute", inset: 0 }}>
            <g transform={`scale(${pulse})`}>
              <circle r={104} fill={accent} stroke={ink} strokeWidth={14} />
              <path d="M-34 -58 L66 0 L-34 58 Z" fill="#fff8ea" stroke={ink} strokeWidth={12} strokeLinejoin="round" />
            </g>
          </svg>
          {/* A highlight on the glass, which is most of what sells it as glass. */}
          <div style={{ position: "absolute", left: 34, top: 26, width: 150, height: 70, borderRadius: "50%", background: "rgba(255,255,255,.22)", transform: "rotate(-24deg)" }} />
        </div>
      </div>
    </FullFrame>
  );
}

export const retroTvFilm = defineFilm({
  id: "retro-tv",
  title: "Cartoon television",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 150,
  component: RetroTv,
  defaultProps: { body: "#e9573f", screen: "#22303a", accent: "#ffc83d", background: "#f3e9d2" },
  controls: {
    body: { type: "color", label: "Cabinet" },
    screen: { type: "color", label: "Screen" },
    accent: { type: "color", label: "Button" },
    background: { type: "color", label: "Background" },
  },
});

export const films = [retroTvFilm];
