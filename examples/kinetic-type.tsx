import { Cue, FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@zxn/motion-core";

type KineticTypeProps = {
  readonly background: string;
  readonly accent: string;
};

function Word({ children, color, direction }: { readonly children: string; readonly color: string; readonly direction: -1 | 1 }) {
  const { frame, film } = useTimeline();
  const enter = springValue({ frame, frameRate: film.frameRate, stiffness: 125, damping: 16, clamp: true });
  const leave = mapRange(frame, [28, 38], [1, 0], { clamp: true, ease: easing.easeIn });
  const scale = 0.52 + enter * 0.48;
  return (
    <FullFrame style={{ alignItems: "center", justifyContent: "center", opacity: leave }}>
      <div style={{
        color, fontFamily: "Arial Black, Inter, sans-serif", fontSize: children.length > 6 ? 210 : 250,
        fontWeight: 950, letterSpacing: "-.095em", lineHeight: 0.8, textTransform: "uppercase",
        transform: `translateX(${direction * (1 - enter) * 520}px) rotate(${direction * (1 - enter) * 13}deg) scale(${scale})`,
        textShadow: `0 28px 0 ${color}1c`, whiteSpace: "nowrap",
      }}>{children}</div>
    </FullFrame>
  );
}

function KineticType({ background, accent }: KineticTypeProps) {
  const { frame, film } = useTimeline();
  const finale = springValue({ frame: frame - 92, frameRate: film.frameRate, stiffness: 110, damping: 18, clamp: true });
  const spin = mapRange(frame, [0, film.frames - 1], [0, 95], { ease: easing.easeInOut });
  return (
    <FullFrame style={{ background, overflow: "hidden", color: "#f4f0e8" }}>
      <div style={{ position: "absolute", width: 760, height: 760, left: -300, top: -320, borderRadius: "50%", border: `120px solid ${accent}`, opacity: 0.13, transform: `rotate(${spin}deg)` }} />
      <div style={{ position: "absolute", inset: -200, opacity: .17, backgroundImage: "repeating-linear-gradient(115deg,transparent 0 28px,rgba(255,255,255,.11) 29px 30px)" }} />
      <div style={{ position: "absolute", left: 58, top: 48, font: "800 17px Inter,system-ui", letterSpacing: ".18em", color: accent }}>TYPE IN MOTION</div>
      <div style={{ position: "absolute", right: 58, top: 46, font: "600 17px ui-monospace,monospace", color: "rgba(255,255,255,.45)" }}>{String(frame + 1).padStart(3, "0")} / {film.frames}</div>
      <Cue start={0} length={56}><Word color="#f3efe7" direction={-1}>Ideas</Word></Cue>
      <Cue start={27} length={56}><Word color={accent} direction={1}>Become</Word></Cue>
      <Cue start={55} length={56}><Word color="#ff6f61" direction={-1}>Motion</Word></Cue>

      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
        opacity: finale, transform: `scale(${0.8 + finale * 0.2})`,
      }}>
        <div style={{ font: "950 142px/.78 Arial Black,Inter,sans-serif", letterSpacing: "-.09em", textAlign: "center" }}>MAKE IT<br /><span style={{ color: accent }}>MOVE.</span></div>
        <div style={{ marginTop: 52, padding: "13px 22px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 999, font: "700 15px Inter,system-ui", letterSpacing: ".16em" }}>CODE · PLAY · RENDER</div>
      </div>
      <div style={{ position: "absolute", left: 58, bottom: 46, width: 170, height: 8, background: accent }} />
      <div style={{ position: "absolute", right: 58, bottom: 40, font: "700 17px Inter,system-ui", letterSpacing: ".12em" }}>ZXN MOTION / 02</div>
    </FullFrame>
  );
}

export const kineticTypeFilm = defineFilm({
  id: "kinetic-type",
  title: "Kinetic Type",
  description: "An energetic, deterministic typography study.",
  width: 1280,
  height: 720,
  frameRate: 30,
  frames: 120,
  component: KineticType,
  defaultProps: { background: "#1110c9", accent: "#c9ff4f" },
});
