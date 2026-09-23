import { FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@matildeene/motion-core";

/*
 * A lower third: the name strap under someone talking.
 *
 * The background is transparent, so the film sits over footage. Everything a
 * person would want to change is a prop with a control, so an editor can set
 * the name without anyone opening the code -- that is the point of `controls`.
 *
 * In, hold, out: written as one `mapRange` with four stops where it can be, so
 * the timing of a whole move is readable on one line.
 */

type Props = { readonly name: string; readonly role: string; readonly accent: string; readonly side: string };

function LowerThird({ name, role, accent, side }: Props) {
  const { frame, film } = useTimeline();
  const last = film.frames - 1;
  const slide = springValue({ frame, frameRate: film.frameRate, stiffness: 150, damping: 20, clamp: true });
  const leave = mapRange(frame, [last - 16, last], [0, 1], { clamp: true, ease: easing.easeIn });
  const text = mapRange(frame, [8, 22, last - 20, last - 8], [0, 1, 1, 0], { clamp: true, ease: easing.easeOut });
  const direction = side === "right" ? 1 : -1;

  return (
    <FullFrame style={{ alignItems: "flex-end", justifyContent: side === "right" ? "flex-end" : "flex-start", padding: "0 120px 130px" }}>
      <div data-zxn-element-id="strap" style={{ display: "flex", alignItems: "stretch", transform: `translateX(${direction * ((1 - slide) * 140 + leave * 140)}px)`, opacity: Math.min(slide * 1.4, 1 - leave) }}>
        <div data-zxn-element-id="rule" style={{ width: 12, background: accent, borderRadius: 6, transform: `scaleY(${slide})`, transformOrigin: "50% 100%" }} />
        <div style={{ padding: "18px 40px 20px 28px", background: "rgba(12,13,17,.82)", borderRadius: "0 16px 16px 0", fontFamily: "Inter, system-ui, sans-serif" }}>
          <div data-zxn-element-id="name" style={{ fontSize: 58, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", opacity: text, transform: `translateY(${(1 - text) * 14}px)` }}>{name}</div>
          <div data-zxn-element-id="role" style={{ fontSize: 32, fontWeight: 500, color: accent, marginTop: 4, opacity: text }}>{role}</div>
        </div>
      </div>
    </FullFrame>
  );
}

export const lowerThirdFilm = defineFilm({
  id: "lower-third",
  title: "Lower third",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 150,
  component: LowerThird,
  defaultProps: { name: "Ada Okafor", role: "Lead Animator", accent: "#2ec4b6", side: "left" },
  controls: {
    name: { type: "text", label: "Name" },
    role: { type: "text", label: "Role" },
    accent: { type: "color", label: "Accent" },
    side: { type: "choice", label: "Side", options: ["left", "right"] },
  },
});

export const films = [lowerThirdFilm];
