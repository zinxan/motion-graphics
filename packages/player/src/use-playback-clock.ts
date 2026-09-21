import { useEffect, useRef } from "react";

type PlaybackClockOptions = Readonly<{
  playing: boolean;
  frame: number;
  frames: number;
  frameRate: number;
  loop: boolean;
  onFrame: (frame: number) => void;
  onEnded: () => void;
}>;

export function usePlaybackClock(options: PlaybackClockOptions): void {
  const { frame, frameRate, frames, loop, onEnded, onFrame, playing } = options;
  const frameRef = useRef(frame);
  // The clock ticks at display rate; a 24 or 30 fps film lands on the same
  // frame number several times in a row, and reporting each one drove the
  // consumer's callback at 60 Hz for no new information.
  const emitted = useRef(-1);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    if (!playing) return;
    let request = 0;
    const startedAt = performance.now();
    const startedFrame = frameRef.current;
    emitted.current = -1;
    const emit = (value: number) => {
      if (value === emitted.current) return;
      emitted.current = value;
      onFrame(value);
    };
    const tick = (now: number) => {
      const elapsedFrames = Math.floor(((now - startedAt) / 1_000) * frameRate);
      let next = startedFrame + elapsedFrames;
      if (next >= frames) {
        if (!loop) {
          emit(frames - 1);
          onEnded();
          return;
        }
        next %= frames;
      }
      emit(next);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [frameRate, frames, loop, onEnded, onFrame, playing]);
}
