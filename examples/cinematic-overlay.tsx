import { defineFilm, seededRandom, useTimeline } from "@zxn/motion-core";

type Props = {
  accent: string;
  intensity: number;
  look: "Warm" | "Cool" | "Mono";
  showFrame: boolean;
};

const grain = Array.from({ length: 20 }, (_, index) => index);

function CinematicOverlay({ accent, intensity, look, showFrame }: Props) {
  const { frame } = useTimeline();
  const seconds = frame / 30;
  const grainFrame = Math.floor(frame / 2);
  const leakX = -25 + ((seconds * 18) % 150);
  const tint = look === "Warm" ? "#ff8a45" : look === "Cool" ? "#58b8ff" : "#ffffff";

  return (
    <div data-zxn-element-id="cinematic-overlay" data-zxn-name="Cinematic overlay"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div data-zxn-element-id="colour-wash" data-zxn-name="Colour wash" style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg, ${tint}26, transparent 48%, ${accent}1f)`,
        mixBlendMode: "screen", opacity: intensity,
      }} />

      <div data-zxn-element-id="moving-light-leak" data-zxn-name="Moving light leak" style={{
        position: "absolute", left: `${leakX}%`, top: "-35%", width: "42%", height: "170%",
        borderRadius: "50%",
        background: `radial-gradient(ellipse, ${accent}99 0%, ${tint}42 36%, transparent 72%)`,
        filter: "blur(70px)", mixBlendMode: "screen", opacity: intensity * 0.8,
        transform: "rotate(12deg)",
      }} />

      <div data-zxn-element-id="scanlines" data-zxn-name="Scanlines" style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,.12) 6px)",
        mixBlendMode: "soft-light", opacity: intensity * 0.25,
      }} />

      <div data-zxn-element-id="grain" data-zxn-name="Film grain" style={{ position: "absolute", inset: 0 }}>
        {grain.map((index) => {
          const x = seededRandom(`${grainFrame}-${index}-x`) * 100;
          const y = seededRandom(`${grainFrame}-${index}-y`) * 100;
          const size = 2 + seededRandom(`${index}-size`) * 6;
          return <span key={index} data-zxn-element-id={`grain-${index}`}
            data-zxn-name={`Grain ${index + 1}`} style={{
              position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size,
              borderRadius: "50%", background: index % 3 === 0 ? accent : "#ffffff",
              opacity: intensity * (0.12 + seededRandom(index) * 0.2), mixBlendMode: "screen",
            }} />;
        })}
      </div>

      <div data-zxn-element-id="vignette" data-zxn-name="Vignette" style={{
        position: "absolute", inset: 0,
        boxShadow: `inset 0 0 ${180 + intensity * 180}px rgba(0,0,0,${0.25 + intensity * 0.35})`,
      }} />

      {showFrame && <div data-zxn-element-id="frame-border" data-zxn-name="Frame border" style={{
        position: "absolute", inset: 34, border: `2px solid ${accent}80`, borderRadius: 18,
      }} />}
    </div>
  );
}

export const films = [defineFilm({
  // Keep this ID when replacing the starter source in ZXN Studio.
  id: "studio-title",
  title: "Cinematic overlay",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 300,
  component: CinematicOverlay,
  defaultProps: { accent: "#ff6a3d", intensity: 0.65, look: "Warm", showFrame: false },
  controls: {
    accent: { type: "color", label: "Accent" },
    intensity: { type: "number", label: "Intensity", min: 0, max: 1, step: 0.05 },
    look: { type: "choice", label: "Look", options: ["Warm", "Cool", "Mono"] },
    showFrame: { type: "boolean", label: "Frame border" },
  },
})];
