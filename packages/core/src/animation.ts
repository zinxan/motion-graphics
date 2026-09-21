export type EasingFunction = (progress: number) => number;

export const easing = {
  linear: (progress: number) => progress,
  easeIn: (progress: number) => progress ** 3,
  easeOut: (progress: number) => 1 - (1 - progress) ** 3,
  easeInOut: (progress: number) => progress < 0.5
    ? 4 * progress ** 3
    : 1 - ((-2 * progress + 2) ** 3) / 2,
} satisfies Record<string, EasingFunction>;

type MapRangeOptions = Readonly<{
  clamp?: boolean;
  ease?: EasingFunction;
}>;

export function mapRange(
  value: number,
  input: readonly number[],
  output: readonly number[],
  options: MapRangeOptions = {},
): number {
  if (input.length !== output.length || input.length < 2) {
    throw new TypeError("input and output ranges must have the same length of at least two.");
  }
  for (let index = 1; index < input.length; index += 1) {
    if ((input[index] ?? 0) <= (input[index - 1] ?? 0)) throw new TypeError("input values must increase strictly.");
  }
  const first = input[0] ?? 0;
  const last = input.at(-1) ?? first;
  const sample = options.clamp ? Math.min(last, Math.max(first, value)) : value;
  let segment = input.length - 2;
  for (let index = 0; index < input.length - 1; index += 1) {
    if (sample <= (input[index + 1] ?? last)) { segment = index; break; }
  }
  const inputStart = input[segment] ?? first;
  const inputEnd = input[segment + 1] ?? last;
  const outputStart = output[segment] ?? 0;
  const outputEnd = output[segment + 1] ?? outputStart;
  const progress = (sample - inputStart) / (inputEnd - inputStart);
  const eased = (options.ease ?? easing.linear)(progress);
  return outputStart + (outputEnd - outputStart) * eased;
}

type SpringOptions = Readonly<{
  frame: number;
  frameRate: number;
  from?: number;
  to?: number;
  mass?: number;
  stiffness?: number;
  damping?: number;
  velocity?: number;
  clamp?: boolean;
}>;

export function springValue(options: SpringOptions): number {
  const { frame, frameRate, from = 0, to = 1, mass = 1, stiffness = 170, damping = 26, velocity = 0 } = options;
  if (frameRate <= 0 || mass <= 0 || stiffness <= 0 || damping < 0) throw new TypeError("Invalid spring configuration.");
  const time = Math.max(0, frame) / frameRate;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const velocity0 = velocity / Math.max(1, Math.abs(to - from));
  let progress: number;

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta ** 2);
    progress = 1 - Math.exp(-zeta * omega0 * time)
      * (Math.cos(omegaD * time) + ((zeta * omega0 - velocity0) / omegaD) * Math.sin(omegaD * time));
  } else if (zeta === 1) {
    progress = 1 - Math.exp(-omega0 * time) * (1 + (omega0 - velocity0) * time);
  } else {
    const root = Math.sqrt(zeta ** 2 - 1);
    const r1 = -omega0 * (zeta - root);
    const r2 = -omega0 * (zeta + root);
    const c1 = (velocity0 + r2) / (r1 - r2);
    const c2 = -1 - c1;
    progress = 1 + c1 * Math.exp(r1 * time) + c2 * Math.exp(r2 * time);
  }
  if (options.clamp) progress = Math.min(1, Math.max(0, progress));
  return from + (to - from) * progress;
}

export function seededRandom(seed: string | number): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13; hash ^= hash >>> 7; hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
  return (hash >>> 0) / 4_294_967_296;
}
