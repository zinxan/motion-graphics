import { formatHex, interpolate } from "culori";
import { Cue, FullFrame, defineFilm, easing, mapRange, useTempo, useTimeline } from "@zxn/motion-core";

/*
 * Cut to the music: a film with a tempo.
 *
 * Declaring `tempo` gives the film a musical clock. Things are then placed in
 * bars and beats instead of frames -- `<Cue startBar lengthBars>` -- and
 * `useTempo()` says where the current frame falls in the bar. Change the bpm
 * and every cut and pulse moves with it; nothing is a magic frame number.
 *
 * The colours come from culori, interpolated in OKLCH. Mixing two colours in
 * plain RGB goes through grey mud in the middle; OKLCH keeps the brightness
 * and saturation even, which is the difference you can see between the bars.
 */

type Props = { readonly from: string; readonly to: string };

const words = ["ONE", "TWO", "THREE", "GO"];

function BeatPulse({ from, to }: Props) {
  const { frame, film } = useTimeline();
  const tempo = useTempo();
  const blend = interpolate([from, to], "oklch");
  // How far through the current beat we are: 0 on the beat, 1 just before the next.
  const beat = tempo.beatAt(frame);
  const sinceBeat = frame - tempo.beat(Math.floor(beat));
  const kick = mapRange(sinceBeat, [0, 7], [1, 0], { clamp: true, ease: easing.easeOut });
  const background = formatHex(blend(frame / (film.frames - 1))) ?? from;

  return (
    <FullFrame style={{ background, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", border: "26px solid rgba(255,255,255,.55)", transform: `scale(${0.55 + 0.5 * (1 - kick)})`, opacity: kick * 0.9 }} />
      {words.map((word, index) => (
        <Cue key={word} startBar={index} lengthBars={1}>
          <FullFrame style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ font: "900 260px Inter, system-ui, sans-serif", color: "#fff", letterSpacing: "-0.05em", transform: `scale(${1 + 0.1 * kick})` }}>{word}</div>
          </FullFrame>
        </Cue>
      ))}
      <div style={{ position: "absolute", bottom: 90, display: "flex", gap: 22 }}>
        {Array.from({ length: 4 }, (_, dot) => (
          <div key={dot} style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", opacity: Math.floor(beat) % 4 === dot ? 1 : 0.28 }} />
        ))}
      </div>
    </FullFrame>
  );
}

export const beatPulseFilm = defineFilm({
  id: "beat-pulse",
  title: "Beat pulse",
  width: 1920,
  height: 1080,
  frameRate: 30,
  // Four bars of four beats at 120 bpm is eight seconds.
  frames: 30 * 8,
  tempo: { bpm: 120, beatsPerBar: 4 },
  component: BeatPulse,
  defaultProps: { from: "#7a6cff", to: "#ff6f61" },
  controls: { from: { type: "color", label: "First colour" }, to: { type: "color", label: "Last colour" } },
});

export const films = [beatPulseFilm];
