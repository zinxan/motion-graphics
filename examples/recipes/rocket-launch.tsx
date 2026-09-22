import { Canvas2D, Cue, FullFrame, defineFilm, easing, mapRange, seededRandom, springValue, useTimeline, type CanvasDraw } from "@zxn/motion-core";

/*
 * A rocket launch, with a countdown.
 *
 * Three techniques, each in the place it belongs:
 *   - <Cue> cuts the film into its beats -- the count, the ignition, the climb
 *     -- so each part is written against its own clock starting at zero;
 *   - the flame, the contrail and the pad smoke are one <Canvas2D>, drawn
 *     whole from the frame, because a few hundred soft puffs that change every
 *     frame is canvas work;
 *   - the trajectory is one cubic curve, sampled by arc length once at module
 *     load. The rocket's position, its heading and the line drawing itself on
 *     behind it all read the same table, so they cannot come apart.
 *
 * The camera shakes at ignition. A shake is just a seeded offset of the whole
 * frame that dies away, and it sells the weight of the thing more than any
 * amount of flame would.
 */

type Props = {
  readonly rocket: string;
  readonly flame: string;
  readonly sky: string;
  readonly caption: string;
};

type Point = { readonly x: number; readonly y: number };

const ink = "#1c1a2e";
const padX = 700;
const padY = 780;
const ignition = 84;
const liftoff = 96;

/*
 * The trajectory: a cubic Bézier from the pad up and off the top right.
 * Sampled into 240 points with their cumulative length, so `along(fraction)`
 * gives the point that fraction of the way by distance flown, not by curve
 * parameter -- which is what SVG's pathLength="1" dash offset also means.
 */
const curve: readonly [Point, Point, Point, Point] = [
  { x: padX, y: padY }, { x: padX, y: 380 }, { x: padX + 240, y: 60 }, { x: padX + 700, y: -360 },
];
const bezier = (t: number): Point => {
  const [a, b, c, d] = curve;
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};
const samples = Array.from({ length: 241 }, (_, index) => bezier(index / 240));
const lengths = samples.reduce<number[]>((acc, point, index) => {
  const previous = samples[index - 1];
  acc.push(index === 0 ? 0 : acc[index - 1]! + Math.hypot(point.x - previous!.x, point.y - previous!.y));
  return acc;
}, []);
const totalLength = lengths[lengths.length - 1]!;

/** The point and heading (radians, screen space) a fraction of the way along the trajectory by distance. */
const along = (fraction: number): Point & { readonly heading: number } => {
  const wanted = Math.max(0, Math.min(1, fraction)) * totalLength;
  let index = 1;
  while (index < lengths.length - 1 && lengths[index]! < wanted) index += 1;
  const from = samples[index - 1]!;
  const to = samples[index]!;
  const span = lengths[index]! - lengths[index - 1]!;
  const t = span > 0 ? (wanted - lengths[index - 1]!) / span : 0;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, heading: Math.atan2(to.y - from.y, to.x - from.x) };
};

const pathData = `M${curve[0].x} ${curve[0].y} C ${curve[1].x} ${curve[1].y}, ${curve[2].x} ${curve[2].y}, ${curve[3].x} ${curve[3].y}`;

/** How far along the climb the rocket is at a frame: slow off the pad, then away. */
const progressAt = (frame: number, frames: number): number =>
  mapRange(frame, [liftoff, frames - 6], [0, 1], { clamp: true, ease: (t) => t * t });

/** A soft puff: a radial gradient, so smoke has no edge. */
const puff = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number, shade: number): void => {
  if (alpha <= 0.003 || radius <= 0) return;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${shade},${shade},${shade + 12},${alpha.toFixed(3)})`);
  gradient.addColorStop(0.55, `rgba(${shade},${shade},${shade + 12},${(alpha * 0.6).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${shade},${shade},${shade + 12},0)`);
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

/** The exhaust: pad smoke, the contrail behind the rocket, and the flame under it, drawn in that order so the flame is on top. */
const exhaust = (frame: number, frames: number, flameColor: string): CanvasDraw => (context, { height }) => {
  const thrust = frame < ignition ? 0 : Math.min(1, (frame - ignition) / 8);
  if (thrust <= 0) return;

  // Pad smoke: billows born at the pad through the first two seconds, thrown out along the ground, rolling up and thinning.
  for (let index = 0; index < 90; index += 1) {
    const born = ignition + seededRandom(`born-${index}`) * 55;
    const age = frame - born;
    if (age < 0) continue;
    const side = seededRandom(`side-${index}`) < 0.5 ? -1 : 1;
    const speed = 6 + 12 * seededRandom(`speed-${index}`);
    const life = 70 + 50 * seededRandom(`life-${index}`);
    const t = Math.min(1, age / life);
    const x = padX + side * (30 + speed * age * (1 - t * 0.5));
    // Up as it goes out, each on its own arc, so the cloud has a top edge that is not a straight line.
    const y = padY - 10 - (40 + 90 * seededRandom(`rise-${index}`)) * Math.sin(t * Math.PI * 0.5) + Math.sin(age * 0.12 + index) * 6;
    // Lit by the fire while it is fresh, grey once it has rolled away.
    const warmth = Math.max(0, 1 - t * 3) * thrust;
    puff(context, x, y, 30 + 70 * t, 0.42 * (1 - t) * (1 - t) * (0.6 + 0.4 * seededRandom(`dense-${index}`)), 150 + Math.round(60 * seededRandom(`shade-${index}`)) + Math.round(50 * warmth));
  }

  // The contrail: puffs left where the nozzle was on earlier frames, growing and fading as they fall behind.
  for (let back = 2; back < 70; back += 2) {
    const when = frame - back;
    if (when < liftoff) break;
    const there = along(progressAt(when, frames));
    const drift = (seededRandom(`trail-${when}`) - 0.5) * 24;
    puff(context, there.x + drift, there.y + 30 + back * 0.4, 14 + back * 1.1, 0.28 * (1 - back / 70), 200);
  }

  // The flame: three tongues, outer to core, each flickering on its own, pointing back along the heading.
  const at = along(progressAt(frame, frames));
  context.save();
  context.translate(at.x, at.y);
  context.rotate((at.heading + Math.PI / 2) * (frame >= liftoff ? mapRange(progressAt(frame, frames), [0, 0.15], [0, 1], { clamp: true, ease: easing.easeInOut }) : 0));
  // Near the pad the flame has nowhere to go but out: it is cut off at the ground, and what does not fit spills sideways along the pad.
  const groundGap = Math.max(10, padY + 8 - at.y);
  const layers: readonly (readonly [number, number, string])[] = [
    [1.0, 46, `${flameColor}99`], [0.72, 32, flameColor], [0.42, 18, "#ffd36a"], [0.22, 9, "#fff7d6"],
  ];
  for (const [length, halfWidth, colour] of layers) {
    const flicker = 0.85 + 0.3 * seededRandom(`flame-${frame}-${length}`);
    const wanted = 260 * thrust * length * flicker;
    const reach = Math.min(wanted, groundGap);
    context.fillStyle = colour;
    context.beginPath();
    context.moveTo(-halfWidth * thrust, 0);
    context.quadraticCurveTo(-halfWidth * 0.9 * thrust, reach * 0.55, 0, reach);
    context.quadraticCurveTo(halfWidth * 0.9 * thrust, reach * 0.55, halfWidth * thrust, 0);
    context.closePath();
    context.fill();
    // The spill: what did not fit runs out along the ground below the fins as a few low, ragged, flickering tongues,
    // never a wide solid shape, which reads as wings.
    const spill = (wanted - groundGap) * 0.8;
    if (spill <= 0) continue;
    const floor = groundGap + 34;
    for (const side of [-1, 1]) {
      for (let tongue = 0; tongue < 3; tongue += 1) {
        const run = spill * (0.45 + 0.55 * seededRandom(`spill-${frame}-${side}-${tongue}-${length}`));
        const thickness = halfWidth * 0.55 * thrust * (0.7 + 0.3 * seededRandom(`thick-${frame}-${side}-${tongue}`));
        context.beginPath();
        context.moveTo(side * 20, floor - thickness);
        context.quadraticCurveTo(side * run * 0.5, floor - thickness * 2.2, side * run, floor - thickness * 0.4);
        context.quadraticCurveTo(side * run * 0.55, floor + thickness * 0.3, side * 20, floor + thickness * 0.2);
        context.closePath();
        context.fill();
      }
    }
  }
  context.restore();
  void height;
};

function RocketLaunch({ rocket, flame, sky, caption }: Props) {
  const { frame, film } = useTimeline();
  const fps = film.frameRate;
  const progress = progressAt(frame, film.frames);
  const at = along(progress);
  // The first control point is straight above the pad, so the curve leaves vertically; the lean is then taken on
  // gradually over the first stretch rather than snapped to at liftoff, which read as a wobble on the pad.
  const lean = frame >= liftoff ? mapRange(progress, [0, 0.15], [0, 1], { clamp: true, ease: easing.easeInOut }) : 0;
  const heading = (at.heading + Math.PI / 2) * (180 / Math.PI) * lean;
  // The shake: a seeded jolt, biggest at ignition, gone by the time the rocket is clear of the pad.
  const shake = Math.max(0, 1 - (frame - ignition) / 40) * (frame >= ignition ? 1 : 0);
  const jolt = { x: (seededRandom(`jx-${frame}`) - 0.5) * 28 * shake, y: (seededRandom(`jy-${frame}`) - 0.5) * 22 * shake };
  const count = 3 - Math.floor(frame / 28);

  return (
    <FullFrame style={{ background: `linear-gradient(${sky}, #0b0a1f)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${jolt.x}px, ${jolt.y}px)` }}>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          {/* Stars, seeded, twinkling on a slow clock. */}
          {Array.from({ length: 90 }, (_, star) => (
            <circle key={star} cx={seededRandom(`sx-${star}`) * 1920} cy={seededRandom(`sy-${star}`) * 700}
              r={1 + 2 * seededRandom(`sr-${star}`)} fill="#fff" opacity={0.4 + 0.6 * seededRandom(`so-${star}-${Math.floor(frame / 9)}`)} />
          ))}
          {/* The ground and the pad. */}
          <rect x={0} y={padY + 10} width={1920} height={300} fill="#232150" />
          <rect x={padX - 110} y={padY - 14} width={220} height={26} rx={6} fill="#3a3670" />
          <rect x={padX + 130} y={padY - 270} width={20} height={258} fill="#3a3670" />
          <rect x={padX + 130} y={padY - 270} width={86} height={14} fill="#3a3670" />
          {/*
           * The trajectory, drawn on as far as the rocket has flown. With pathLength="1"
           * the dash offset is a fraction of the arc length, the same measure `along` uses,
           * so the line ends exactly under the rocket. (A short dash pattern would only
           * slide along and show the whole line from frame 0.)
           */}
          <path d={pathData} fill="none" stroke="#fff" strokeWidth={4} opacity={0.5} strokeLinecap="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
        </svg>

        <Canvas2D draw={exhaust(frame, film.frames, flame)} />

        {/* The rocket: nose cone, body with a shaded side, a porthole with its rim, fins, a bell. Turned to its heading. */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="rocket-body" x1="0" x2="1">
              <stop offset="0" stopColor={rocket} />
              <stop offset="0.6" stopColor={rocket} />
              <stop offset="1" stopColor="#b9b4a8" />
            </linearGradient>
          </defs>
          <g transform={`translate(${at.x} ${at.y}) rotate(${heading})`}>
            <path d="M-40 -60 L-112 26 L-112 40 L-40 8 Z" fill={flame} stroke={ink} strokeWidth={7} strokeLinejoin="round" />
            <path d="M40 -60 L112 26 L112 40 L40 8 Z" fill="#d86f2e" stroke={ink} strokeWidth={7} strokeLinejoin="round" />
            <path d="M-44 0 L-44 -230 C -44 -320, -20 -380, 0 -412 C 20 -380, 44 -320, 44 -230 L44 0 Z" fill="url(#rocket-body)" stroke={ink} strokeWidth={7} strokeLinejoin="round" />
            <path d="M-44 -230 C -44 -320, -20 -380, 0 -412 C 20 -380, 44 -320, 44 -230 Z" fill={flame} stroke={ink} strokeWidth={7} strokeLinejoin="round" />
            <rect x={-44} y={-70} width={88} height={16} fill={flame} />
            <circle cx={0} cy={-170} r={30} fill="#5aa9d6" stroke={ink} strokeWidth={7} />
            <circle cx={-8} cy={-178} r={9} fill="#cfefff" opacity={0.8} />
            <path d="M-28 0 L-36 22 L36 22 L28 0 Z" fill="#4a4660" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
          </g>
        </svg>

        {/* The countdown: each number pops in on its own spring, big and then settling, in the clear right of the frame. */}
        {count > 0 && (
          <Cue start={0} length={ignition}>
            <div style={{ position: "absolute", left: 1060, width: 760, top: 240, textAlign: "center", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontWeight: 900, fontSize: 420, color: "#fff",
              transform: `scale(${springValue({ frame: frame % 28, frameRate: fps, from: 1.6, to: 1, stiffness: 200, damping: 12 })})`,
              opacity: mapRange(frame % 28, [0, 3, 22, 27], [0, 1, 1, 0], { clamp: true }) }}>
              {count}
            </div>
          </Cue>
        )}
        <Cue start={liftoff + 10}>
          <div style={{ position: "absolute", left: 1060, width: 760, top: 430, textAlign: "center", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontWeight: 900, fontSize: 140, letterSpacing: "0.08em", color: "#fff",
            opacity: mapRange(frame, [liftoff + 10, liftoff + 20], [0, 1], { clamp: true }),
            transform: `translateY(${(1 - springValue({ frame: frame - liftoff - 10, frameRate: fps, stiffness: 160, damping: 14 })) * 60}px)` }}>
            {caption}
          </div>
        </Cue>
      </div>
    </FullFrame>
  );
}

export const rocketLaunchFilm = defineFilm({
  id: "rocket-launch",
  title: "Rocket launch",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 180,
  component: RocketLaunch,
  defaultProps: { rocket: "#f4f1ea", flame: "#ff8a3d", sky: "#2b2a5e", caption: "LIFT-OFF" },
  controls: {
    rocket: { type: "color", label: "Rocket" },
    flame: { type: "color", label: "Flame" },
    sky: { type: "color", label: "Sky" },
    caption: { type: "text", label: "Caption" },
  },
});

export const films = [rocketLaunchFilm];
