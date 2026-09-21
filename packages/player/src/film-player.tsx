import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilmSurface, type FilmDescriptor, type JsonObject } from "@zxn/motion-core";
import { usePlaybackClock } from "./use-playback-clock.js";

type FilmPlayerProps = Readonly<{
  film: FilmDescriptor;
  inputProps?: JsonObject;
  className?: string;
  controls?: boolean;
  loop?: boolean;
  onFrameChange?: (frame: number) => void;
}>;

export function FilmPlayer({ film, inputProps, className, controls = true, loop = true, onFrameChange }: FilmPlayerProps) {
  const [frame, setFrameState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const setFrame = useCallback((next: number) => {
    setFrameState(next);
    onFrameChange?.(next);
  }, [onFrameChange]);
  const stop = useCallback(() => setPlaying(false), []);
  const togglePlayback = useCallback(() => {
    if (!playing && frame === film.frames - 1) setFrame(0);
    setPlaying((value) => !value);
  }, [film.frames, frame, playing, setFrame]);
  usePlaybackClock({ playing, frame, frames: film.frames, frameRate: film.frameRate, loop, onFrame: setFrame, onEnded: stop });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setScale(Math.min(entry.contentRect.width / film.width, entry.contentRect.height / film.height));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [film.height, film.width]);

  return (
    <div className={`zxn-player ${controls ? "" : "zxn-player--no-controls"} ${className ?? ""}`} data-slot="film-player">
      <div ref={viewportRef} className="zxn-player__viewport">
        <div className="zxn-player__frame" style={{ width: film.width * scale, height: film.height * scale }}>
          <div className="zxn-player__surface" style={{ transform: `scale(${scale})` }}>
            <FilmSurface film={film} frame={frame} inputProps={inputProps} />
          </div>
        </div>
      </div>
      {controls && (
        <div className="zxn-player__controls">
          <button className="zxn-player__button" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause /> : <Play />}
          </button>
          <button className="zxn-player__button" onClick={() => { setPlaying(false); setFrame(0); }} aria-label="Restart"><RotateCcw /></button>
          <input className="zxn-player__scrubber" type="range" min={0} max={film.frames - 1} value={frame} onChange={(event) => { setPlaying(false); setFrame(Number(event.target.value)); }} aria-label="Frame" />
          <output className="zxn-player__counter">{frame.toString().padStart(3, "0")} / {film.frames - 1}</output>
        </div>
      )}
    </div>
  );
}
