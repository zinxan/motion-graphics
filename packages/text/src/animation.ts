/*
 * Title animations.
 *
 * An animation is a pure function of where the playhead sits inside the clip,
 * never of wall-clock time or of how many frames have been drawn. That is what
 * keeps scrubbing, playback and export identical: asking for the state at 1.2s
 * always gives the same answer, so a rendered file matches what the preview
 * showed.
 *
 * Offsets are expressed in multiples of fontSize rather than pixels, so a
 * "rise" looks like the same gesture on a 40px caption and a 200px title.
 */

export type TextAnimationId =
  | "fade"
  | "rise"
  | "drop"
  | "slide-left"
  | "slide-right"
  | "pop"
  | "zoom"
  | "spin"
  | "typewriter";

export type TextLoopId = "pulse" | "shake" | "wiggle" | "float" | "throb";

export type TextAnimationStep = Readonly<{ id: TextAnimationId; duration: number }>;
export type TextLoop = Readonly<{ id: TextLoopId; speed: number; amount: number }>;

export type TextAnimation = Readonly<{
  in?: TextAnimationStep;
  out?: TextAnimationStep;
  loop?: TextLoop;
}>;

export type TextAnimationState = Readonly<{
  opacity: number;
  /** In multiples of fontSize. */
  offsetX: number;
  offsetY: number;
  scale: number;
  /** Degrees. */
  rotation: number;
  /** Undefined means "all of it"; a number types that many characters. */
  revealCharacters?: number;
}>;

export const restingTextAnimation: TextAnimationState = {
  opacity: 1,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
};

export const textAnimationLabels: Readonly<Record<TextAnimationId, string>> = {
  fade: "Fade",
  rise: "Rise",
  drop: "Drop",
  "slide-left": "Slide Left",
  "slide-right": "Slide Right",
  pop: "Pop",
  zoom: "Zoom",
  spin: "Spin",
  typewriter: "Typewriter",
};

export const textLoopLabels: Readonly<Record<TextLoopId, string>> = {
  pulse: "Pulse",
  shake: "Shake",
  wiggle: "Wiggle",
  float: "Float",
  throb: "Throb",
};

export const textAnimationIds = Object.keys(textAnimationLabels) as readonly TextAnimationId[];
export const textLoopIds = Object.keys(textLoopLabels) as readonly TextLoopId[];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
/** Overshoots past the target and settles back -- the snap in a "pop". */
const easeOutBack = (t: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/*
 * `progress` runs 0 (off screen) to 1 (resting) for both directions; the caller
 * reverses it for the outro, so every animation is authored once as an entrance
 * and plays backwards on the way out.
 */
function entranceState(id: TextAnimationId, progress: number, characters: number): TextAnimationState {
  const eased = easeOutCubic(progress);
  switch (id) {
    case "fade":
      return { ...restingTextAnimation, opacity: eased };
    case "rise":
      return { ...restingTextAnimation, opacity: eased, offsetY: (1 - eased) * 0.6 };
    case "drop":
      return { ...restingTextAnimation, opacity: eased, offsetY: -(1 - eased) * 0.6 };
    case "slide-left":
      return { ...restingTextAnimation, opacity: eased, offsetX: (1 - eased) * 1.2 };
    case "slide-right":
      return { ...restingTextAnimation, opacity: eased, offsetX: -(1 - eased) * 1.2 };
    case "pop":
      // Opacity leads the scale so the overshoot is visible rather than
      // happening while the title is still fading up.
      return { ...restingTextAnimation, opacity: clamp01(progress * 2), scale: easeOutBack(progress) };
    case "zoom":
      return { ...restingTextAnimation, opacity: eased, scale: 0.4 + eased * 0.6 };
    case "spin":
      return { ...restingTextAnimation, opacity: eased, scale: 0.6 + eased * 0.4, rotation: (1 - eased) * -35 };
    case "typewriter":
      // Typing is linear; easing it makes the rhythm lurch.
      return { ...restingTextAnimation, revealCharacters: Math.ceil(progress * characters) };
  }
}

function loopState(loop: TextLoop, seconds: number): TextAnimationState {
  const phase = seconds * loop.speed * Math.PI * 2;
  const amount = loop.amount;
  switch (loop.id) {
    case "pulse":
      return { ...restingTextAnimation, scale: 1 + Math.sin(phase) * 0.06 * amount };
    case "throb":
      return { ...restingTextAnimation, opacity: 1 - (0.5 + Math.sin(phase) / 2) * 0.45 * amount };
    case "shake":
      // Two incommensurate frequencies, so the jitter never visibly repeats.
      return {
        ...restingTextAnimation,
        offsetX: Math.sin(phase * 3.1) * 0.03 * amount,
        offsetY: Math.sin(phase * 4.7) * 0.03 * amount,
      };
    case "wiggle":
      return { ...restingTextAnimation, rotation: Math.sin(phase) * 4 * amount };
    case "float":
      return { ...restingTextAnimation, offsetY: Math.sin(phase) * 0.08 * amount };
  }
}

export type TextAnimationOptions = Readonly<{
  localSeconds: number;
  durationSeconds: number;
  characters: number;
}>;

export function evaluateTextAnimation(
  animation: TextAnimation | undefined,
  options: TextAnimationOptions,
): TextAnimationState {
  const { localSeconds, durationSeconds, characters } = options;
  if (!animation) return restingTextAnimation;

  let state = restingTextAnimation;
  const compose = (next: TextAnimationState): void => {
    state = {
      opacity: state.opacity * next.opacity,
      offsetX: state.offsetX + next.offsetX,
      offsetY: state.offsetY + next.offsetY,
      scale: state.scale * next.scale,
      rotation: state.rotation + next.rotation,
      // The tightest reveal wins, so an intro typewriter is not undone by an
      // outro that says nothing about characters.
      revealCharacters: next.revealCharacters ?? state.revealCharacters,
    };
  };

  const intro = animation.in;
  if (intro && intro.duration > 0) {
    compose(entranceState(intro.id, clamp01(localSeconds / intro.duration), characters));
  }

  const outro = animation.out;
  if (outro && outro.duration > 0) {
    // Measured back from the end of the clip and played in reverse.
    const remaining = durationSeconds - localSeconds;
    compose(entranceState(outro.id, clamp01(remaining / outro.duration), characters));
  }

  const loop = animation.loop;
  if (loop && loop.amount > 0 && loop.speed > 0) compose(loopState(loop, localSeconds));

  return state;
}
