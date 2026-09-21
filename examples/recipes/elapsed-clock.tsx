import { FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@zxn/motion-core";

/*
 * A clock that shows time passing: "three hours later".
 *
 * The hands do not tick through every second of those hours -- nobody would
 * sit through it. They sweep from one time to the other on an ease, fast in the
 * middle and gentle at both ends, which is how the device has always been drawn.
 * The readout under the dial counts through the same interval, so dial and
 * digits can never disagree.
 *
 * Drawn in SVG: a dozen crisp shapes that scale to any size. This is what DOM
 * and SVG are good at, as opposed to a field of particles (see matrix-rain).
 */

type Props = {
  /** 24-hour start and end, as hours with a decimal part: 9.5 is 09:30. */
  readonly from: number;
  readonly to: number;
  readonly face: string;
  readonly accent: string;
  readonly caption: string;
};

const pad = (value: number): string => String(Math.floor(value)).padStart(2, "0");
const readout = (hours: number): string => `${pad(((hours % 24) + 24) % 24)}:${pad(((hours * 60) % 60 + 60) % 60)}`;

function ElapsedClock({ from, to, face, accent, caption }: Props) {
  const { frame, film } = useTimeline();
  const appear = springValue({ frame, frameRate: film.frameRate, stiffness: 120, damping: 14 });
  // Hold on the start time, sweep, then hold on the end so both can be read.
  const progress = mapRange(frame, [24, film.frames - 36], [0, 1], { clamp: true, ease: easing.easeInOut });
  const hours = from + (to - from) * progress;
  const captionIn = mapRange(frame, [film.frames - 40, film.frames - 22], [0, 1], { clamp: true, ease: easing.easeOut });

  const hourAngle = (hours % 12) * 30;
  const minuteAngle = ((hours * 60) % 60) * 6;
  // How hard the hands are moving, for a little motion streak on the minute hand.
  const rush = Math.sin(progress * Math.PI);

  return (
    <FullFrame style={{ background: "#11131a", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      <svg width={620} height={620} viewBox="-310 -310 620 620" style={{ transform: `scale(${0.6 + 0.4 * appear})`, opacity: Math.min(1, appear) }}>
        <circle r={292} fill={face} stroke="#0a0b10" strokeWidth={14} />
        <circle r={292} fill="none" stroke={accent} strokeWidth={4} opacity={0.5} />
        {Array.from({ length: 60 }, (_, tick) => (
          <line key={tick} y1={-270} y2={tick % 5 === 0 ? -236 : -256} stroke="#1c1f2a" strokeWidth={tick % 5 === 0 ? 8 : 3}
            strokeLinecap="round" transform={`rotate(${tick * 6})`} />
        ))}
        {[12, 3, 6, 9].map((numeral, index) => (
          <text key={numeral} x={[0, 196, 0, -196][index]} y={[-176, 22, 218, 22][index]} textAnchor="middle"
            fontFamily="Georgia, serif" fontSize={64} fontWeight={700} fill="#1c1f2a">{numeral}</text>
        ))}
        {/* The streak: a faint wedge trailing the minute hand while it is moving fast. */}
        <path d={`M0 0 L0 -232 A232 232 0 0 0 ${-232 * Math.sin(0.5 * rush)} ${-232 * Math.cos(0.5 * rush)} Z`}
          fill={accent} opacity={0.22 * rush} transform={`rotate(${minuteAngle})`} />
        <line y1={28} y2={-150} stroke="#1c1f2a" strokeWidth={18} strokeLinecap="round" transform={`rotate(${hourAngle})`} />
        <line y1={36} y2={-232} stroke="#1c1f2a" strokeWidth={10} strokeLinecap="round" transform={`rotate(${minuteAngle})`} />
        <circle r={16} fill={accent} />
      </svg>
      <div style={{ font: "700 72px ui-monospace, Menlo, monospace", color: "#f3efe7", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>
        {readout(hours)}
      </div>
      <div style={{ font: "italic 600 44px Georgia, serif", color: accent, opacity: captionIn, transform: `translateY(${(1 - captionIn) * 18}px)` }}>
        {caption}
      </div>
    </FullFrame>
  );
}

export const elapsedClockFilm = defineFilm({
  id: "elapsed-clock",
  title: "Elapsed clock",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 150,
  component: ElapsedClock,
  defaultProps: { from: 9.5, to: 12.75, face: "#f6f1e4", accent: "#ff7a45", caption: "Three hours later…" },
  controls: {
    from: { type: "number", label: "From (hours)", min: 0, max: 24, step: 0.25 },
    to: { type: "number", label: "To (hours)", min: 0, max: 48, step: 0.25 },
    face: { type: "color", label: "Face" },
    accent: { type: "color", label: "Accent" },
    caption: { type: "text", label: "Caption" },
  },
});

export const films = [elapsedClockFilm];
