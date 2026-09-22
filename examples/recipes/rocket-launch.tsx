import { Canvas2D, Cue, FullFrame, defineFilm, easing, mapRange, seededRandom, springValue, useTimeline, type CanvasDraw } from "@zxn/motion-core";

/*
 * A rocket launch, with a countdown.
 *
 * Three techniques, each in the place it belongs:
 *   - <Cue> cuts the film into its beats -- the count, the ignition, the climb
 *     -- so each part is written against its own clock starting at zero;
 *   - the exhaust and the smoke are one <Canvas2D>, drawn whole from the frame,
 *     because a few hundred puffs that change every frame is canvas work;
 *   - the trajectory is an SVG path drawn on with stroke-dashoffset, the
 *     oldest trick for "a line being drawn", and it works under a scrub because
 *     the offset is a function of the frame and nothing else.
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

const ink = "#1c1a2e";
const padX = 700;
const ignition = 84;
const liftoff = 96;

/** Where the rocket is at a frame of the climb: slow off the pad, then away, up and a little to the right. */
const climb = (frame: number, frames: number) => {
  const t = mapRange(frame, [liftoff, frames], [0, 1], { clamp: true, ease: easing.easeIn });
  return { x: 520 * t * t, y: -1500 * t };
};

/** The exhaust: a hot core, then puffs of smoke thrown down and out, each on its own seeded path. */
const exhaust = (rocketX: number, rocketY: number, thrust: number, flame: string): CanvasDraw => (context, { frame, width, height }) => {
  if (thrust <= 0) return;
  const nozzleX = padX + rocketX;
  const nozzleY = height * 0.72 + rocketY;
  // The flame: a few flickering tongues, brightest at the nozzle.
  for (let tongue = 0; tongue < 3; tongue += 1) {
    const flicker = 0.8 + 0.4 * seededRandom(`flame-${frame}-${tongue}`);
    const length = 220 * thrust * flicker;
    const gradient = context.createLinearGradient(nozzleX, nozzleY, nozzleX, nozzleY + length);
    gradient.addColorStop(0, "#fff7d6");
    gradient.addColorStop(0.35, flame);
    gradient.addColorStop(1, "rgba(255,120,40,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(nozzleX - 34 * thrust, nozzleY);
    context.quadraticCurveTo(nozzleX - 20 + tongue * 14, nozzleY + length * 0.6, nozzleX + (tongue - 1) * 10, nozzleY + length);
    context.quadraticCurveTo(nozzleX + 20 + tongue * 8, nozzleY + length * 0.6, nozzleX + 34 * thrust, nozzleY);
    context.closePath();
    context.fill();
  }
  // The smoke: puffs born at the pad, rolling out along the ground, then rising and thinning.
  const puffs = 160;
  for (let puff = 0; puff < puffs; puff += 1) {
    const born = ignition + seededRandom(`born-${puff}`) * 70;
    const age = frame - born;
    if (age < 0) continue;
    const side = seededRandom(`side-${puff}`) < 0.5 ? -1 : 1;
    const speed = 6 + 10 * seededRandom(`speed-${puff}`);
    const life = 55 + 40 * seededRandom(`life-${puff}`);
    const t = Math.min(1, age / life);
    const x = padX + side * speed * age * (1 - t * 0.4);
    const y = height * 0.74 - 30 * t * t * (1 + seededRandom(`rise-${puff}`)) + Math.sin(age * 0.2 + puff) * 6;
    const radius = 12 + 38 * t;
    const shade = 150 + 80 * seededRandom(`shade-${puff}`);
    context.fillStyle = `rgba(${shade},${shade},${shade + 10},${(0.38 * (1 - t) * (1 - t)).toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
};

function RocketLaunch({ rocket, flame, sky, caption }: Props) {
  const { frame, film } = useTimeline();
  const fps = film.frameRate;
  const { x, y } = climb(frame, film.frames);
  const thrust = frame < ignition ? 0 : Math.min(1, (frame - ignition) / 8);
  // The shake: a seeded jolt, biggest at ignition, gone by the time the rocket is clear of the pad.
  const shake = Math.max(0, 1 - (frame - ignition) / 40) * (frame >= ignition ? 1 : 0);
  const jolt = { x: (seededRandom(`jx-${frame}`) - 0.5) * 28 * shake, y: (seededRandom(`jy-${frame}`) - 0.5) * 22 * shake };
  // The trajectory draws itself on behind the rocket: the dash offset is how much of the path is still hidden.
  const pathLength = 2400;
  const drawn = mapRange(frame, [liftoff, film.frames], [0, 1], { clamp: true, ease: easing.easeIn });
  const count = 3 - Math.floor(frame / 28);

  return (
    <FullFrame style={{ background: `linear-gradient(${sky}, #0b0a1f)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${jolt.x}px, ${jolt.y}px)` }}>
        {/* Stars, seeded, and a ground line. */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 90 }, (_, star) => (
            <circle key={star} cx={seededRandom(`sx-${star}`) * 1920} cy={seededRandom(`sy-${star}`) * 700}
              r={1 + 2 * seededRandom(`sr-${star}`)} fill="#fff" opacity={0.4 + 0.6 * seededRandom(`so-${star}-${Math.floor(frame / 9)}`)} />
          ))}
          <rect x={0} y={790} width={1920} height={300} fill="#232150" />
          {/*
           * The trajectory, drawn on as the rocket climbs. The dash is as long as the
           * whole path, so the offset hides exactly the part not yet flown; a short
           * dash pattern would only slide along and show the whole line from frame 0.
           */}
          <path d={`M${padX} 780 C ${padX + 20} 500, ${padX + 160} 200, ${padX + 520} -300`} fill="none" stroke="#fff" strokeWidth={4} opacity={0.55}
            strokeDasharray={pathLength} strokeDashoffset={pathLength * (1 - drawn)} pathLength={pathLength} />
          {/* The pad and its gantry. */}
          <rect x={padX - 100} y={760} width={200} height={34} rx={6} fill="#3a3670" />
          <rect x={padX + 120} y={520} width={22} height={270} fill="#3a3670" />
          <rect x={padX + 120} y={520} width={90} height={16} fill="#3a3670" />
        </svg>

        <Canvas2D draw={exhaust(x, y, thrust, flame)} />

        {/* The rocket itself: SVG, nudged along the climb, leaning into it as it goes. */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <g transform={`translate(${padX + x} ${780 + y}) rotate(${22 * drawn * drawn})`}>
            <path d="M-46 0 L-46 -250 Q0 -400 46 -250 L46 0 Z" fill={rocket} stroke={ink} strokeWidth={8} />
            <path d="M-46 -60 L-110 30 L-46 0 Z" fill={flame} stroke={ink} strokeWidth={8} strokeLinejoin="round" />
            <path d="M46 -60 L110 30 L46 0 Z" fill={flame} stroke={ink} strokeWidth={8} strokeLinejoin="round" />
            <circle cx={0} cy={-200} r={26} fill="#8fd7ff" stroke={ink} strokeWidth={8} />
            <rect x={-30} y={0} width={60} height={22} fill={ink} />
          </g>
        </svg>

        {/* The countdown: each number pops in on its own spring, big and then settling. */}
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
