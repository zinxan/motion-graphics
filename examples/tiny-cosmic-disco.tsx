import { FullFrame, defineFilm, easing, mapRange, seededRandom, springValue, useTimeline } from "@matildeene/motion-core";

type DiscoProps = {
  readonly title: string;
  readonly background: string;
  readonly pink: string;
  readonly cyan: string;
  readonly yellow: string;
};

const ink = "#21143e";
const cream = "#fff7e8";

function Speaker({ x, beat, accent }: { readonly x: number; readonly beat: number; readonly accent: string }) {
  return (
    <g transform={`translate(${x} ${beat * 5})`}>
      <rect x={0} y={352} width={202} height={255} rx={25} fill="#24133e" stroke={accent} strokeWidth={5} />
      <rect x={13} y={365} width={176} height={229} rx={18} fill="#170d2e" />
      <circle cx={101} cy={467} r={69 + beat * 5} fill="#342152" stroke={accent} strokeWidth={5} />
      <circle cx={101} cy={467} r={46 + beat * 8} fill={accent} opacity={0.72} />
      <circle cx={101} cy={467} r={23 + beat * 3} fill="#170d2e" />
      <circle cx={101} cy={394} r={11} fill={accent} />
      <path d="M38 567 H164" stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
    </g>
  );
}

function DiscoBall({ frame, cyan, pink }: { readonly frame: number; readonly cyan: string; readonly pink: string }) {
  const swing = Math.sin(frame / 18) * 6;
  const facets = Array.from({ length: 5 }, (_, row) => row);
  return (
    <g data-zxn-element-id="disco-ball" transform={`translate(${640 + swing} 161) rotate(${frame * 0.9})`}>
      <circle r={76} fill="#bac9e9" stroke={cream} strokeWidth={6} />
      <circle r={70} fill="url(#ballGradient)" />
      {facets.map((row) => (
        <g key={row} opacity={0.66}>
          <path d={`M-73 ${-48 + row * 24} Q0 ${-35 + row * 24} 73 ${-48 + row * 24}`} fill="none" stroke="#1d2a59" strokeWidth={4} />
          <path d={`M${-49 + row * 24} -69 Q${-32 + row * 20} 0 ${-49 + row * 24} 69`} fill="none" stroke="#1d2a59" strokeWidth={4} />
        </g>
      ))}
      <path d="M-42 -42 L-20 -55 L-2 -42 L-22 -23 Z" fill={cream} opacity={0.9} />
      <path d="M17 4 L45 -3 L51 21 L25 31 Z" fill={pink} opacity={0.82} />
      <path d="M-44 30 L-19 34 L-23 52 L-43 49 Z" fill={cyan} opacity={0.78} />
    </g>
  );
}

function CosmicDJ({ frame, fps, pink, cyan, yellow }: { readonly frame: number; readonly fps: number; readonly pink: string; readonly cyan: string; readonly yellow: string }) {
  const entrance = springValue({ frame: frame - 7, frameRate: fps, stiffness: 140, damping: 12 });
  const bounce = Math.sin(frame * Math.PI / 7.5);
  const headY = 6 * bounce;
  const handWave = Math.sin(frame / 5) * 22;
  const blink = frame % 73 > 67 ? 0.12 : 1;
  const orbit = frame * 1.5;
  return (
    <g data-zxn-element-id="cosmic-dj" transform={`translate(0 ${(1 - entrance) * 510})`}>
      <ellipse cx={640} cy={625} rx={179} ry={22} fill="#050514" opacity={0.7} />
      <g transform="rotate(-12 640 505)" opacity={0.84}>
        <ellipse cx={640} cy={505} rx={231} ry={42} fill="none" stroke={yellow} strokeWidth={8} />
      </g>

      <g transform={`translate(640 ${421 + headY}) rotate(${bounce * 3})`}>
        <path d={`M-112 48 Q-204 ${-23 + handWave} -211 ${-76 + handWave}`} fill="none" stroke={ink} strokeWidth={35} strokeLinecap="round" />
        <path d={`M-112 48 Q-204 ${-23 + handWave} -211 ${-76 + handWave}`} fill="none" stroke={pink} strokeWidth={25} strokeLinecap="round" />
        <circle cx={-211} cy={-76 + handWave} r={22} fill={yellow} stroke={ink} strokeWidth={6} />
        <path d="M105 57 Q177 95 211 31" fill="none" stroke={ink} strokeWidth={35} strokeLinecap="round" />
        <path d="M105 57 Q177 95 211 31" fill="none" stroke={cyan} strokeWidth={25} strokeLinecap="round" />
        <circle cx={211} cy={31} r={22} fill={yellow} stroke={ink} strokeWidth={6} />

        <circle r={139} fill="url(#planetGradient)" stroke={ink} strokeWidth={10} />
        <path d="M-96 81 Q-8 132 93 83" fill="none" stroke="#fbacd9" strokeWidth={19} strokeLinecap="round" opacity={0.72} />
        <path d="M-83 -103 Q-14 -135 36 -104" fill="none" stroke={cream} strokeWidth={12} strokeLinecap="round" opacity={0.64} />
        <ellipse cx={-48} cy={-9} rx={12} ry={19 * blink} fill={ink} />
        <ellipse cx={52} cy={-9} rx={12} ry={19 * blink} fill={ink} />
        <circle cx={-47} cy={-14} r={4} fill={cream} opacity={blink} />
        <circle cx={53} cy={-14} r={4} fill={cream} opacity={blink} />
        <ellipse cx={-82} cy={28} rx={24} ry={11} fill={pink} opacity={0.55} />
        <ellipse cx={87} cy={28} rx={24} ry={11} fill={pink} opacity={0.55} />
        <path d="M-19 39 Q4 67 29 37" fill="none" stroke={ink} strokeWidth={9} strokeLinecap="round" />

        <path d="M-110 -72 Q-98 -166 0 -170 Q103 -169 114 -70" fill="none" stroke={ink} strokeWidth={27} strokeLinecap="round" />
        <path d="M-110 -72 Q-98 -166 0 -170 Q103 -169 114 -70" fill="none" stroke={cyan} strokeWidth={17} strokeLinecap="round" />
        <rect x={-137} y={-80} width={39} height={75} rx={17} fill={pink} stroke={ink} strokeWidth={8} />
        <rect x={99} y={-80} width={39} height={75} rx={17} fill={pink} stroke={ink} strokeWidth={8} />
      </g>

      <g transform="rotate(-12 640 505)" opacity={0.92}>
        <path d="M409 505 C409 529 512 547 640 547 C768 547 871 529 871 505" fill="none" stroke={yellow} strokeWidth={8} />
        <circle cx={640 + 231 * Math.cos(orbit * Math.PI / 180)} cy={505 + 42 * Math.sin(orbit * Math.PI / 180)} r={11} fill={yellow} />
      </g>

      <rect x={456} y={540} width={368} height={98} rx={22} fill="#30204c" stroke={ink} strokeWidth={9} />
      <rect x={472} y={552} width={336} height={70} rx={12} fill="#1a1030" />
      <g data-zxn-element-id="turntable" transform={`translate(633 587) rotate(${frame * 5})`}>
        <circle r={32} fill="#402258" stroke={pink} strokeWidth={5} />
        <circle r={20} fill={pink} />
        <circle r={5} fill={cream} />
        <path d="M0 -19 V-30 M0 19 V30 M-30 0 H-20 M20 0 H30" stroke={cream} strokeWidth={2} opacity={0.65} />
      </g>
      <circle cx={506} cy={587} r={10} fill={cyan} />
      <circle cx={540} cy={587} r={10} fill={yellow} />
      <path d="M725 577 H781 M725 589 H768 M725 601 H789" stroke={cyan} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
}

function TinyCosmicDisco({ title, background, pink, cyan, yellow }: DiscoProps) {
  const { frame, film } = useTimeline();
  const beat = (1 + Math.cos(frame * Math.PI / 7.5)) / 2;
  const intro = mapRange(frame, [0, 18], [0, 1], { clamp: true, ease: easing.easeOut });
  const reveal = springValue({ frame: frame - 105, frameRate: film.frameRate, stiffness: 100, damping: 15, clamp: true });
  const beams = Array.from({ length: 9 }, (_, index) => index);
  const stars = Array.from({ length: 60 }, (_, index) => ({
    x: 31 + seededRandom(`x-${index}`) * 1218,
    y: 55 + seededRandom(`y-${index}`) * 530,
    r: 1.5 + seededRandom(`r-${index}`) * 3.1,
    phase: seededRandom(`p-${index}`) * Math.PI * 2,
  }));

  return (
    <FullFrame style={{ background, overflow: "hidden" }}>
      <svg viewBox="0 0 1280 720" width="1280" height="720" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="skyGradient"><stop stopColor="#37206a" /><stop offset=".62" stopColor="#1a1138" /><stop offset="1" stopColor={background} /></radialGradient>
          <linearGradient id="planetGradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d6b5ff" /><stop offset=".55" stopColor="#9b6dd9" /><stop offset="1" stopColor="#6940b5" /></linearGradient>
          <linearGradient id="ballGradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor={cream} /><stop offset=".48" stopColor={cyan} /><stop offset="1" stopColor="#6475bc" /></linearGradient>
          <radialGradient id="flashGradient"><stop stopColor={pink} stopOpacity={0.5} /><stop offset="1" stopColor={pink} stopOpacity={0} /></radialGradient>
        </defs>
        <rect width={1280} height={720} fill="url(#skyGradient)" />
        <circle cx={640} cy={432} r={382 + beat * 50} fill="url(#flashGradient)" opacity={0.26 + beat * 0.27} />

        {stars.map((star, index) => (
          <circle key={index} cx={star.x} cy={star.y} r={star.r} fill={index % 5 === 0 ? yellow : cream}
            opacity={0.22 + 0.58 * ((1 + Math.sin(frame / 9 + star.phase)) / 2)} />
        ))}

        <g opacity={0.1 + beat * 0.12}>
          {beams.map((index) => (
            <path key={index} d={`M640 158 L${-150 + index * 200} 720 L${-25 + index * 200} 720 Z`}
              fill={index % 2 ? cyan : pink} transform={`rotate(${Math.sin(frame / 17) * 8} 640 158)`} />
          ))}
        </g>

        <path d="M0 625 Q640 565 1280 625 V720 H0 Z" fill="#110b27" />
        <path d="M0 625 Q640 565 1280 625" fill="none" stroke={cyan} strokeWidth={5} opacity={0.5} />
        {Array.from({ length: 8 }, (_, index) => (
          <path key={index} d={`M640 618 L${index * 180 - 20} 720`} stroke={pink} strokeWidth={2} opacity={0.22} />
        ))}
        {[650, 682, 714].map((y) => <path key={y} d={`M0 ${y} H1280`} stroke={pink} strokeWidth={2} opacity={0.18} />)}

        <Speaker x={113} beat={beat} accent={pink} />
        <Speaker x={965} beat={beat} accent={cyan} />

        <path d="M640 0 V82" stroke={cream} strokeWidth={5} opacity={0.64} />
        <DiscoBall frame={frame} cyan={cyan} pink={pink} />
        <CosmicDJ frame={frame} fps={film.frameRate} pink={pink} cyan={cyan} yellow={yellow} />

        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index / 12) * Math.PI * 2 + frame / 18;
          const distance = 225 + ((frame + index * 17) % 70);
          return <path key={index} d={`M${640 + Math.cos(angle) * distance} ${366 + Math.sin(angle) * distance} l${index % 2 ? 11 : -11} -13`}
            stroke={index % 3 === 0 ? yellow : index % 2 ? pink : cyan} strokeWidth={5} strokeLinecap="round" opacity={0.55 + beat * 0.3} />;
        })}

        <g opacity={intro}>
          <text x={48} y={53} fill={cream} fontFamily="Arial, sans-serif" fontWeight="800" fontSize={17} letterSpacing={4}>ZXN MOTION GRAPHICS</text>
          <text x={1232} y={53} textAnchor="end" fill={cyan} fontFamily="Arial, sans-serif" fontWeight="800" fontSize={17} letterSpacing={3}>NOW SPINNING ✦</text>
        </g>

        <g data-zxn-element-id="title" opacity={reveal} transform={`translate(0 ${(1 - reveal) * 100})`}>
          <rect x={266} y={630} width={748} height={72} rx={36} fill="#130a2a" stroke={yellow} strokeWidth={3} />
          <text x={640} y={678} textAnchor="middle" fill={cream} fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize={41} letterSpacing={-1}>{title.toUpperCase()}</text>
        </g>
      </svg>
    </FullFrame>
  );
}

export const tinyCosmicDiscoFilm = defineFilm({
  id: "tiny-cosmic-disco",
  title: "Tiny Cosmic Disco",
  description: "A dancing planet DJ, a spinning disco ball, and one tiny cosmic party.",
  width: 1280,
  height: 720,
  frameRate: 30,
  frames: 180,
  component: TinyCosmicDisco,
  defaultProps: {
    title: "Tiny Cosmic Disco",
    background: "#0a071e",
    pink: "#ff5da8",
    cyan: "#54e4f5",
    yellow: "#ffd166",
  },
  controls: {
    title: { type: "text", label: "Title" },
    background: { type: "color", label: "Background" },
    pink: { type: "color", label: "Pink" },
    cyan: { type: "color", label: "Cyan" },
    yellow: { type: "color", label: "Yellow" },
  },
});

export const films = [tinyCosmicDiscoFilm];
