import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { FullFrame, defineFilm, useVirtualTime } from "@matildeene/motion-core";

/*
 * Driving GSAP from the frame.
 *
 * A timeline is lovely for choreography -- "this, then that, overlapping by a
 * fifth of a second" -- and useless if it plays itself, because it would play
 * on the real clock. So it is built **paused** and the film **seeks** it:
 * `timeline.seek(seconds)` on every frame. GSAP works out the whole state for
 * that instant from scratch, so frames can be asked for in any order.
 *
 * The same pattern fits anything seekable: a Lottie animation
 * (`goToAndStop(frame, true)`), a Web Animations `currentTime`, a video's
 * `currentTime`. If a library can only *play*, it cannot be used in a film.
 */

type Props = { readonly line1: string; readonly line2: string; readonly accent: string };

function GsapTitle({ line1, line2, accent }: Props) {
  const { seconds } = useVirtualTime();
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const scope = gsap.context(() => {
      timeline.current = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } })
        .from(".bar", { scaleX: 0, transformOrigin: "0% 50%", duration: 0.6 })
        .from(".word", { yPercent: 110, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.25")
        .from(".sub", { opacity: 0, x: -30, duration: 0.5 }, "-=0.3")
        .to(".bar", { scaleX: 0, transformOrigin: "100% 50%", duration: 0.5, ease: "power3.in" }, 3.4)
        .to(".word, .sub", { opacity: 0, y: -24, duration: 0.4, stagger: 0.04, ease: "power2.in" }, 3.4);
    }, root);
    return () => scope.revert();
  }, [line1, line2]);

  // After the build effect on the first frame, and on every frame after it.
  useLayoutEffect(() => { timeline.current?.seek(seconds, false); });

  return (
    <FullFrame style={{ background: "#0b0c0e", alignItems: "center", justifyContent: "center" }}>
      <div ref={root} style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#f3efe7" }}>
        <div className="bar" style={{ height: 12, width: 220, background: accent, borderRadius: 6, marginBottom: 34 }} />
        <div style={{ overflow: "hidden", fontSize: 150, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
          {line1.split(" ").map((word, index) => <span key={index} className="word" style={{ display: "inline-block", marginRight: "0.25em" }}>{word}</span>)}
        </div>
        <div className="sub" style={{ fontSize: 54, fontWeight: 500, color: accent, marginTop: 18 }}>{line2}</div>
      </div>
    </FullFrame>
  );
}

export const gsapTitleFilm = defineFilm({
  id: "gsap-title",
  title: "GSAP title",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: 126,
  component: GsapTitle,
  defaultProps: { line1: "Seek, never play", line2: "A GSAP timeline driven by the frame", accent: "#7a6cff" },
  controls: { line1: { type: "text", label: "Headline" }, line2: { type: "text", label: "Subtitle" }, accent: { type: "color", label: "Accent" } },
});

export const films = [gsapTitleFilm];
