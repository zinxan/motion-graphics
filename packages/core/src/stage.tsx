import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { useTimeline } from "./frame-context.js";
import {
  cameraViewAt, reviewCameraShots,
  type CameraIdle, type CameraShot, type CameraView, type StageLayout, type StageRect,
} from "./camera.js";
import { pointerStateAt, pressedAt, reviewPointerPath, type PointerKey, type PointerState } from "./pointer.js";

/*
 * The board, the camera looking at it, and the cursor that rides both.
 *
 * Everything on a stage is placed in board pixels by an entry in `layout`, and
 * that one table is what the camera frames, what the pointer travels between
 * and where each item draws itself. Declaring a position once is the point:
 * a camera shot that names "export-button" cannot fall out of step with where
 * the export button actually is, because there is only one answer to that.
 *
 * Nothing here measures the DOM. Layout is not available before a film's first
 * paint, and a camera that depended on it would frame the wrong thing on frame
 * zero of every export.
 */

type StageContextValue = Readonly<{ layout: StageLayout; width: number; height: number }>;

const StageContext = createContext<StageContextValue | null>(null);
const CameraContext = createContext<CameraView | null>(null);

export function useStage(): StageContextValue {
  const value = useContext(StageContext);
  if (!value) throw new Error("This component must be used inside a <Stage>.");
  return value;
}

/** The camera's view this frame, for components that want to react to it. */
export function useCamera(): CameraView {
  const value = useContext(CameraContext);
  if (!value) throw new Error("useCamera() must be used inside a <Stage> or <Camera>.");
  return value;
}

type CameraProps = Readonly<{
  shots: readonly CameraShot[];
  layout?: StageLayout;
  /** The board being looked at. Inside a <Stage> this comes from the stage. */
  board?: Readonly<{ width: number; height: number }>;
  idle?: CameraIdle;
  /** Keeps the picture inside the board, so no shot shows past its edge. */
  contain?: boolean;
  /** Darkens the edges of the viewport. Off by default. */
  vignette?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}>;

/**
 * The viewport, and the transform that aims it at the board.
 *
 * Depth of field and motion blur are deliberately absent: both need a real
 * post pass over the rendered frame, which belongs to the renderer rather than
 * to a DOM transform. The view this returns carries everything such a pass
 * would need — where the camera is, how fast it is moving between frames — so
 * it can be added without changing a single film.
 */
export function Camera({ shots, layout, board, idle, contain, vignette, className, style, children }: CameraProps) {
  const stage = useContext(StageContext);
  const { frame, film } = useTimeline();
  const resolvedLayout = layout ?? stage?.layout ?? {};
  const resolvedBoard = board ?? (stage ? { width: stage.width, height: stage.height } : { width: film.width, height: film.height });
  const view = cameraViewAt({
    shots, frame, frameRate: film.frameRate, layout: resolvedLayout, board: resolvedBoard, idle,
    viewport: { width: film.width, height: film.height }, contain,
  });
  const warnings = reviewCameraShots(shots, film.frameRate);
  const tilted = view.tiltX !== 0 || view.tiltY !== 0;

  return (
    <div
      data-zxn-camera=""
      // Surfaced rather than thrown: a crowded shot list is a note to the
      // author, not a broken film. The element inspector shows it.
      data-zxn-warnings={warnings.length === 0 ? undefined : warnings.map(({ message }) => message).join(" ")}
      className={className}
      style={{
        position: "absolute", inset: 0, overflow: "hidden",
        perspective: tilted ? `${String(Math.max(resolvedBoard.width, resolvedBoard.height))}px` : undefined,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute", top: 0, left: 0,
          width: resolvedBoard.width, height: resolvedBoard.height,
          transformOrigin: "0 0",
          transformStyle: tilted ? "preserve-3d" : undefined,
          transform: [
            `translate(${String(film.width / 2)}px, ${String(film.height / 2)}px)`,
            tilted ? `rotateX(${String(view.tiltX)}deg) rotateY(${String(view.tiltY)}deg)` : "",
            `scale(${String(view.zoom)})`,
            `translate(${String(-view.x)}px, ${String(-view.y)}px)`,
          ].filter(Boolean).join(" "),
        }}
      >
        <CameraContext value={view}>{children}</CameraContext>
      </div>
      {vignette === true && (
        <div
          aria-hidden
          data-zxn-name="Vignette"
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      )}
    </div>
  );
}

type StageProps = Readonly<{
  width: number;
  height: number;
  /** Where everything on the board is. The camera and the pointer both read it. */
  layout?: StageLayout;
  /** A shot list. Given one, the stage puts a camera in front of the board. */
  shots?: readonly CameraShot[];
  idle?: CameraIdle;
  /** Keeps the picture inside the board, so no shot shows past its edge. */
  contain?: boolean;
  vignette?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}>;

/** A fixed-size board in its own coordinate space. */
export function Stage({ width, height, layout = {}, shots, idle, contain, vignette, className, style, children }: StageProps) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError("Stage width and height must be positive numbers.");
  }
  const board = (
    <StageContext value={{ layout, width, height }}>
      <div
        data-zxn-stage=""
        className={shots ? className : undefined}
        style={shots ? { position: "absolute", inset: 0, ...style } : { position: "absolute", top: 0, left: 0, width, height, ...style }}
      >
        {children}
      </div>
    </StageContext>
  );
  if (!shots) return board;
  return (
    <StageContext value={{ layout, width, height }}>
      <Camera shots={shots} idle={idle} contain={contain} vignette={vignette} className={className} style={style}>
        {children}
      </Camera>
    </StageContext>
  );
}

type StageItemProps = Readonly<{
  /** Its key in the stage layout, and the name a camera shot or pointer key uses. */
  id: string;
  /**
   * How far behind the board this sits, for parallax. 0 moves with the board,
   * 1 is far enough away that the camera's travel does not move it at all.
   */
  depth?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}>;

/** Something placed on the board, at the rect the stage layout gives its id. */
export function StageItem({ id, depth = 0, className, style, children }: StageItemProps) {
  const { layout, width, height } = useStage();
  const view = useContext(CameraContext);
  const rect: StageRect | undefined = layout[id];
  if (!rect) throw new Error(`<StageItem id="${id}"> has no entry in the stage layout.`);
  // Parallax is a counter-move: the further away an item is, the more of the
  // camera's travel it gives back, until at depth 1 it is fixed to the frame.
  const offsetX = view ? (view.x - width / 2) * depth : 0;
  const offsetY = view ? (view.y - height / 2) * depth : 0;

  return (
    <div
      data-zxn-element-id={id}
      data-zxn-name={id}
      className={className}
      style={{
        position: "absolute",
        left: rect.x, top: rect.y, width: rect.width, height: rect.height,
        transform: depth === 0 ? undefined : `translate(${String(offsetX)}px, ${String(offsetY)}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The cursor's state at this frame, read from the same path that draws it. */
export function usePointer(path: readonly PointerKey[]): PointerState & { pressedOn: (id: string) => boolean } {
  const { layout } = useStage();
  const { frame } = useTimeline();
  const state = pointerStateAt({ path, frame, layout });
  return { ...state, pressedOn: (id) => pressedAt(path, frame, id) };
}

type PointerProps = Readonly<{
  path: readonly PointerKey[];
  /** Board pixels tall. The glyph scales from its tip. */
  size?: number;
  color?: string;
}>;

/**
 * The cursor.
 *
 * One outlined shape rather than a fill and a separate border: the hand-rolled
 * cursor in the launch film was two overlapping paths, and wherever they met
 * at a shallow angle the antialiasing left a seam that crawled as it moved.
 */
export function Pointer({ path, size = 34, color = "#ffffff" }: PointerProps) {
  const { layout } = useStage();
  const { frame, film } = useTimeline();
  const state = pointerStateAt({ path, frame, layout });
  const warnings = reviewPointerPath(path, film.frameRate, layout);
  // A press pushes the cursor in towards its own tip, which is where a finger
  // would push it, rather than scaling it about its middle.
  const squash = 1 - state.pressPhase * 0.14;

  return (
    <div
      data-zxn-pointer=""
      data-zxn-warnings={warnings.length === 0 ? undefined : warnings.map(({ message }) => message).join(" ")}
      aria-hidden
      style={{ position: "absolute", left: state.x, top: state.y, pointerEvents: "none", zIndex: 50 }}
    >
      {state.ringPhase !== undefined && (
        <span
          style={{
            position: "absolute", left: 0, top: 0,
            width: size * 1.9, height: size * 1.9,
            marginLeft: -size * 0.95, marginTop: -size * 0.95,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            opacity: (1 - state.ringPhase) * 0.5,
            transform: `scale(${String(0.3 + state.ringPhase * 0.9)})`,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ display: "block", transform: `scale(${String(squash)})`, transformOrigin: "0 0", overflow: "visible" }}
      >
        <path
          d="M1 1 L1 20.2 L6.1 15.4 L9.3 22.4 L12.6 20.9 L9.5 14.1 L16.4 13.7 Z"
          fill={color}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
