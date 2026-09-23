import { scaleBand, scaleLinear } from "d3-scale";
import { interpolateNumber } from "d3-interpolate";
import { FullFrame, defineFilm, easing, mapRange, useTimeline } from "@matildeene/motion-core";

/*
 * A bar chart race, using d3 for what d3 is good at.
 *
 * d3-scale and d3-interpolate are pure functions: give them a number, get a
 * number back. That makes them a perfect fit for a film, which is also a pure
 * function of the frame. There is no d3 "transition" here and there must not
 * be -- transitions run on a real clock. The frame picks a position between two
 * snapshots of the data, and d3 turns values into pixels.
 *
 * Each bar is its own element on purpose: a chart has a dozen things in it, and
 * a host like ZXN Studio can then select and animate any one of them.
 */

type Props = { readonly title: string; readonly unit: string };

const snapshots = [
  { label: "2021", values: { Aurora: 12, Basalt: 30, Cinder: 22, Dune: 8, Ember: 17 } },
  { label: "2022", values: { Aurora: 26, Basalt: 33, Cinder: 24, Dune: 19, Ember: 21 } },
  { label: "2023", values: { Aurora: 44, Basalt: 35, Cinder: 29, Dune: 38, Ember: 23 } },
  { label: "2024", values: { Aurora: 61, Basalt: 37, Cinder: 48, Dune: 52, Ember: 27 } },
] as const;

type Name = keyof typeof snapshots[number]["values"];
const names = Object.keys(snapshots[0].values) as Name[];
const colors: Record<Name, string> = { Aurora: "#7a6cff", Basalt: "#2ec4b6", Cinder: "#ff6f61", Dune: "#ffc83d", Ember: "#ff9f1c" };
const framesPerStep = 50;
const chart = { left: 300, top: 250, width: 1380, height: 640 };

function BarChartRace({ title, unit }: Props) {
  const { frame } = useTimeline();
  const position = Math.min(snapshots.length - 1, frame / framesPerStep);
  const index = Math.min(snapshots.length - 2, Math.floor(position));
  // Ease inside each step so the bars settle on every year instead of sliding through it.
  const within = easing.easeInOut(Math.min(1, position - index));
  const from = snapshots[index]!;
  const to = snapshots[index + 1]!;

  const current = names.map((name) => ({ name, value: interpolateNumber(from.values[name], to.values[name])(within) }));
  // Rank is interpolated too, so a bar glides past its neighbour rather than jumping a row.
  const rankIn = (values: Record<Name, number>, name: Name) => [...names].sort((a, b) => values[b] - values[a]).indexOf(name);
  const x = scaleLinear().domain([0, Math.max(...current.map((bar) => bar.value)) * 1.08]).range([0, chart.width]);
  const y = scaleBand<number>().domain(names.map((_, row) => row)).range([0, chart.height]).padding(0.22);

  return (
    <FullFrame style={{ background: "#0f1117", color: "#f3efe7", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div data-zxn-element-id="title" style={{ position: "absolute", left: chart.left, top: 96, fontSize: 64, fontWeight: 800 }}>{title}</div>
      <div data-zxn-element-id="year" style={{ position: "absolute", right: 240, top: 84, fontSize: 96, fontWeight: 900, color: "rgba(255,255,255,.18)", fontVariantNumeric: "tabular-nums" }}>
        {within < 0.5 ? from.label : to.label}
      </div>
      {current.map(({ name, value }) => {
        // Bars trade places quickly, in the middle of the step: two bars sharing a row is unreadable, so they
        // spend as little time crossing as looks natural, and the one moving up rides on top while they do.
        const swap = easing.easeInOut(mapRange(within, [0.3, 0.7], [0, 1], { clamp: true }));
        const before = rankIn(from.values, name);
        const after = rankIn(to.values, name);
        const rank = interpolateNumber(before, after)(swap);
        const top = chart.top + (y(0) ?? 0) + rank * y.step();
        const grow = mapRange(frame, [0, 24], [0, 1], { clamp: true, ease: easing.easeOut });
        return (
          <div key={name} data-zxn-element-id={`bar-${name}`} data-zxn-name={`${name} bar`} style={{ position: "absolute", left: 0, top, height: y.bandwidth(), width: "100%", zIndex: after < before ? 2 : 1 }}>
            <div style={{ position: "absolute", left: 0, width: chart.left - 28, top: 0, height: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 38, fontWeight: 700 }}>{name}</div>
            <div style={{ position: "absolute", left: chart.left, top: 0, height: "100%", width: x(value) * grow, background: colors[name], borderRadius: 14 }} />
            <div style={{ position: "absolute", left: chart.left + x(value) * grow + 22, top: 0, height: "100%", display: "flex", alignItems: "center", fontSize: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {Math.round(value)}{unit}
            </div>
          </div>
        );
      })}
    </FullFrame>
  );
}

export const barChartRaceFilm = defineFilm({
  id: "bar-chart-race",
  title: "Bar chart race",
  width: 1920,
  height: 1080,
  frameRate: 30,
  frames: framesPerStep * (snapshots.length - 1) + 40,
  component: BarChartRace,
  defaultProps: { title: "Studios by active projects", unit: "k" },
  controls: { title: { type: "text", label: "Title" }, unit: { type: "text", label: "Unit" } },
});

export const films = [barChartRaceFilm];
