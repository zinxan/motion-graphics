import { barChartRaceFilm } from "./bar-chart-race";
import { beatPulseFilm } from "./beat-pulse";
import { elapsedClockFilm } from "./elapsed-clock";
import { gsapTitleFilm } from "./gsap-title";
import { lowerThirdFilm } from "./lower-third";
import { matrixRainFilm } from "./matrix-rain";
import { noiseFieldFilm } from "./noise-field";
import { retroTvFilm } from "./retro-tv";
import { rocketLaunchFilm } from "./rocket-launch";

/** Every recipe, for a host that wants to list or render them all. Each file also exports its own `films`. */
export const films = [
  matrixRainFilm, elapsedClockFilm, retroTvFilm, barChartRaceFilm,
  noiseFieldFilm, gsapTitleFilm, lowerThirdFilm, beatPulseFilm, rocketLaunchFilm,
];
