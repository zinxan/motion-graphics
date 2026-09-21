import { FullFrame, defineFilm, easing, mapRange, springValue, useTimeline } from "@zxn/motion-core";

type CodingTutorialProps = {
  readonly accent: string;
  readonly title: string;
};

const code = [
  ["const ", "signal", " = defineFilm({"],
  ["  rhythm: ", '"30fps"', ","],
  ["  palette: ", '"electric"', ","],
  ["});", "", ""],
  ["await ", "render", "(signal);"],
] as const;

function CodeLine({ line, index, accent }: { readonly line: typeof code[number]; readonly index: number; readonly accent: string }) {
  const { frame } = useTimeline();
  const reveal = springValue({ frame: frame - 20 - index * 9, frameRate: 30, stiffness: 145, damping: 19, clamp: true });
  return (
    <div style={{ display: "flex", whiteSpace: "pre", opacity: reveal, transform: `translateX(${(1 - reveal) * 38}px)` }}>
      <span style={{ width: 42, color: "#424a59", userSelect: "none" }}>{index + 1}</span>
      <span style={{ color: "#c792ea" }}>{line[0]}</span>
      <span style={{ color: accent }}>{line[1]}</span>
      <span style={{ color: "#d6deeb" }}>{line[2]}</span>
    </div>
  );
}

function CodingTutorial({ accent, title }: CodingTutorialProps) {
  const { frame, film } = useTimeline();
  const windowIn = springValue({ frame, frameRate: film.frameRate, stiffness: 95, damping: 17 });
  const resultIn = springValue({ frame: frame - 92, frameRate: film.frameRate, stiffness: 125, damping: 18, clamp: true });
  const progress = mapRange(frame, [0, film.frames - 1], [0, 100], { clamp: true, ease: easing.easeInOut });
  const glowX = mapRange(frame, [0, film.frames - 1], [12, 88], { clamp: true, ease: easing.easeInOut });

  return (
    <FullFrame style={{ background: "#07090d", color: "white", fontFamily: "Inter, ui-sans-serif, system-ui", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.19, backgroundImage: "linear-gradient(#253041 1px,transparent 1px),linear-gradient(90deg,#253041 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
      <div style={{ position: "absolute", width: 520, height: 520, left: `${glowX}%`, top: "48%", borderRadius: "50%", background: accent, filter: "blur(190px)", opacity: 0.18, transform: "translate(-50%,-50%)" }} />
      <div style={{ position: "absolute", left: 82, top: 48, fontSize: 18, fontWeight: 700, letterSpacing: ".16em", color: accent }}>ZXN / QUICKSTART</div>
      <div style={{ position: "absolute", right: 82, top: 50, font: "500 16px ui-monospace,monospace", color: "#6c7483" }}>LESSON 01 · 00:{String(Math.floor(frame / 30)).padStart(2, "0")}</div>

      <div style={{
        position: "absolute", left: 82, right: 82, top: 92, bottom: 82, overflow: "hidden",
        border: "1px solid #28303d", borderRadius: 24, background: "rgba(11,14,20,.94)",
        boxShadow: "0 40px 100px rgba(0,0,0,.55)", opacity: windowIn,
        transform: `translateY(${(1 - windowIn) * 70}px) scale(${0.96 + windowIn * 0.04})`,
      }}>
        <div style={{ height: 54, display: "flex", alignItems: "center", gap: 9, padding: "0 22px", borderBottom: "1px solid #252c37", background: "#0f131a" }}>
          {['#ff665c', '#ffbd44', '#00ca4e'].map((color) => <div key={color} style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />)}
          <span style={{ marginLeft: 18, font: "500 14px ui-monospace,monospace", color: "#778194" }}>launch-film.tsx</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr", height: "calc(100% - 58px)" }}>
          <div style={{ padding: "50px 44px", font: "500 27px/1.72 ui-monospace,SFMono-Regular,monospace" }}>
            {code.map((line, index) => <CodeLine key={index} line={line} index={index} accent={accent} />)}
          </div>
          <div style={{ margin: 24, borderRadius: 18, border: "1px solid #293341", background: "#090c11", display: "grid", placeItems: "center", overflow: "hidden" }}>
            <div style={{ textAlign: "center", opacity: resultIn, transform: `scale(${0.65 + resultIn * 0.35}) rotate(${(1 - resultIn) * -8}deg)` }}>
              <div style={{ width: 150, height: 150, margin: "0 auto 22px", borderRadius: 42, background: accent, boxShadow: `0 0 80px ${accent}70`, transform: `rotate(${frame * 1.8}deg)` }} />
              <div style={{ fontSize: 19, fontWeight: 750, letterSpacing: ".18em" }}>RENDERED</div>
              <div style={{ marginTop: 8, font: "500 14px ui-monospace,monospace", color: "#7c8798" }}>150 deterministic frames</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 82, right: 82, bottom: 47, height: 4, borderRadius: 4, background: "#1c222d" }}>
        <div style={{ width: `${progress}%`, height: "100%", borderRadius: 4, background: accent, boxShadow: `0 0 18px ${accent}` }} />
      </div>
      <div style={{ position: "absolute", left: 82, bottom: 20, fontSize: 15, color: "#7b8492" }}>{title}</div>
    </FullFrame>
  );
}

export const codingTutorialFilm = defineFilm({
  id: "coding-tutorial",
  title: "Code to Motion",
  description: "A compact visual tutorial for defining and rendering a film.",
  width: 1280,
  height: 720,
  frameRate: 30,
  frames: 150,
  component: CodingTutorial,
  defaultProps: { accent: "#b7ff58", title: "Define once. Preview and render from the same frame model." },
});
