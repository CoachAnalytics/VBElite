/**
 * Age-adjusted measurables: where an athlete stands for her age, and where she projects at 18.
 * Pure functions, no database access. Works in centimeters internally; inputs and outputs in
 * the app are inches.
 *
 * Sources (full citations on the For you page and in collect/BENCHMARKS.md):
 *  - Height growth: CDC 2000 stature-for-age LMS tables for girls.
 *  - Standing reach = 1.30 x height: Tsoukos 2019 (Greek junior national pool, n=64),
 *    Sieroń 2023 (Polish club 14-16, n=36), AVCA college testing; ratios 1.285-1.311.
 *  - Jump development by age: Grbić 2026 (n=2,798 girls, countermovement jump by age).
 *  - Elite peers: Milić 2017 (Croatian club players at 14, by position) for height;
 *    Tsoukos 2019 for reach and approach jump at 14.4; AVCA college testing for block jump.
 * Elite-peer and college touch figures are VB Elite estimates built from these, not direct
 * measurements of U.S. players: no U.S. age-group norms by position are published.
 */
import { CDC_GIRLS_STATURE } from "./data/cdcGirlsStature";

const CM = 2.54;
export const REACH_RATIO = 1.3;

/** Grbić 2026: mean countermovement jump (cm) of girls by age. */
const CMJ_BY_AGE: [number, number][] = [
  [10, 20.45], [11, 22.15], [12, 23.22], [13, 24.33], [14, 25.25], [15, 25.78], [16, 26.2], [17, 26.63], [18, 26.67],
];

/** Elite club players at 14.0 by position, height mean/SD in cm (Milić 2017, more successful teams). */
const ELITE_HEIGHT_14: Record<string, [number, number]> = {
  S: [169.2, 5.1], OPP: [172.4, 6.0], MB: [175.8, 9.6], OH: [172.7, 6.4], LDS: [163.4, 5.4],
};
/** Tsoukos 2019: approach (spike) jump 49.5 +/- 6.2 cm at age 14.4; standing reach SD 7 cm. */
const ELITE_APPROACH_JUMP_14_4 = 49.5;
const REACH_SD = 7;
const APPROACH_JUMP_SD = 6.2;
/** AVCA college testing, block touch minus standing reach (cm), by position. */
const COLLEGE_BLOCK_JUMP: Record<string, number> = { S: 43.2, OPP: 45.7, MB: 45.7, OH: 40.7, LDS: 39.3 };
const BLOCK_JUMP_SD = 4.8;

// ---------- Age ----------

/**
 * Her age in years on `now`: from her birth month and year when known, otherwise from her
 * graduation year (seniors are about 18.25 on June 1 of their graduation year).
 */
export function ageYears(now: Date, gradYear: number, birth?: { year: number; month: number } | null): number {
  if (birth?.year && birth?.month) {
    const born = Date.UTC(birth.year, birth.month - 1, 15);
    return (now.getTime() - born) / (365.25 * 86400000);
  }
  const graduation = Date.UTC(gradYear, 5, 1);
  return 18.25 - (graduation - now.getTime()) / (365.25 * 86400000);
}

// ---------- CDC growth ----------

function lms(age: number): [number, number, number] {
  const months = Math.min(240, Math.max(120.5, age * 12));
  const rows = CDC_GIRLS_STATURE;
  let i = rows.findIndex((r) => r[0] >= months);
  if (i <= 0) i = 1;
  const [m0, l0, mu0, s0] = rows[i - 1];
  const [m1, l1, mu1, s1] = rows[i];
  const t = m1 === m0 ? 0 : (months - m0) / (m1 - m0);
  return [l0 + (l1 - l0) * t, mu0 + (mu1 - mu0) * t, s0 + (s1 - s0) * t];
}

/** z-score of a height (cm) among U.S. girls of that age. */
export function heightZ(cm: number, age: number): number {
  const [L, M, S] = lms(age);
  return (Math.pow(cm / M, L) - 1) / (L * S);
}

/** Height (cm) at a given z-score and age. */
export function heightAtZ(z: number, age: number): number {
  const [L, M, S] = lms(age);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26), as a 0-100 percentile. */
export function percentile(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return Math.round(50 * (1 + Math.sign(z) * y) * 10) / 10;
}

// ---------- Projection ----------

/** How much her jump grows from `age` to 18 (multiplier), from Grbić 2026's by-age means. */
export function jumpFactor(age: number): number {
  const at = (a: number) => {
    const x = Math.min(18, Math.max(10, a));
    const i = CMJ_BY_AGE.findIndex(([y]) => y >= x);
    if (i <= 0) return CMJ_BY_AGE[0][1];
    const [a0, v0] = CMJ_BY_AGE[i - 1];
    const [a1, v1] = CMJ_BY_AGE[i];
    return v0 + ((v1 - v0) * (x - a0)) / (a1 - a0);
  };
  return at(18) / at(age);
}

export type Range = { low: number; mid: number; high: number };

/**
 * Height at 18 if she stays on her CDC percentile (mid). Tall, early-maturing girls often
 * finish sooner (low: half the remaining growth); later maturers can add more (high: 1.75x).
 */
export function projectHeightCm(cm: number, age: number): Range {
  if (age >= 18) return { low: cm, mid: cm, high: cm };
  const gain = Math.max(0, heightAtZ(heightZ(cm, age), 18) - cm);
  return { low: cm + gain * 0.5, mid: cm + gain, high: cm + gain * 1.75 };
}

export type Measurables = {
  heightIn: number | null;
  standingReachIn: number | null;
  blockTouchIn: number | null;
  approachTouchIn: number | null;
};

export type MetricKey = "height" | "reach" | "block" | "approach";

export type MetricView = {
  key: MetricKey;
  label: string;
  /** Her current value in inches (estimated from height when `estimated`). */
  nowIn: number;
  estimated: boolean;
  /** Percentile among elite players her age at her position (VB Elite estimate). */
  elitePct: number;
  /** Percentile among all U.S. girls her age (height only, CDC). */
  cdcPct?: number;
  projectedIn: Range;
};

const toIn = (cm: number) => cm / CM;
const toCm = (inches: number) => inches * CM;

/** Expected elite peer at her age and position: [mean cm, sd cm] for each metric. */
export function elitePeer(age: number, position: string): Record<MetricKey, [number, number]> {
  const [h14, hsd] = ELITE_HEIGHT_14[position] ?? ELITE_HEIGHT_14.OH;
  const h = heightAtZ(heightZ(h14, 14), age);
  const reach = h * REACH_RATIO;
  const toAge = 1 / jumpFactor(age);
  const approachJump = ELITE_APPROACH_JUMP_14_4 * jumpFactor(14.4) * toAge;
  const blockJump = (COLLEGE_BLOCK_JUMP[position] ?? COLLEGE_BLOCK_JUMP.OH) * toAge;
  return {
    height: [h, hsd],
    reach: [reach, REACH_SD],
    approach: [reach + approachJump, Math.hypot(REACH_SD, APPROACH_JUMP_SD)],
    block: [reach + blockJump, Math.hypot(REACH_SD, BLOCK_JUMP_SD)],
  };
}

/**
 * Her measurables now, for her age and projected to 18. Reach is estimated from height when
 * she hasn't measured it; touches are only shown when she has measured them.
 */
export function ageAdjusted(m: Measurables, age: number, position: string): MetricView[] {
  if (m.heightIn == null) return [];
  const hCm = toCm(m.heightIn);
  const height = projectHeightCm(hCm, age);
  const gain = { low: height.low - hCm, mid: height.mid - hCm, high: height.high - hCm };
  const reachCm = m.standingReachIn != null ? toCm(m.standingReachIn) : hCm * REACH_RATIO;
  const peer = elitePeer(age, position);
  const pct = (key: MetricKey, cm: number) => percentile((cm - peer[key][0]) / peer[key][1]);
  const grow = (cm: number, jumpCm: number): Range => {
    const j = jumpCm * jumpFactor(age);
    return {
      low: toIn(cm - jumpCm + gain.low * REACH_RATIO + j),
      mid: toIn(cm - jumpCm + gain.mid * REACH_RATIO + j),
      high: toIn(cm - jumpCm + gain.high * REACH_RATIO + j),
    };
  };
  const out: MetricView[] = [
    {
      key: "height",
      label: "Height",
      nowIn: m.heightIn,
      estimated: false,
      elitePct: pct("height", hCm),
      cdcPct: percentile(heightZ(hCm, age)),
      projectedIn: { low: toIn(height.low), mid: toIn(height.mid), high: toIn(height.high) },
    },
    {
      key: "reach",
      label: "Standing reach",
      nowIn: toIn(reachCm),
      estimated: m.standingReachIn == null,
      elitePct: pct("reach", reachCm),
      projectedIn: grow(reachCm, 0),
    },
  ];
  if (m.blockTouchIn != null) {
    const cm = toCm(m.blockTouchIn);
    out.push({ key: "block", label: "Block touch", nowIn: m.blockTouchIn, estimated: false, elitePct: pct("block", cm), projectedIn: grow(cm, Math.max(0, cm - reachCm)) });
  }
  if (m.approachTouchIn != null) {
    const cm = toCm(m.approachTouchIn);
    out.push({ key: "approach", label: "Approach touch", nowIn: m.approachTouchIn, estimated: false, elitePct: pct("approach", cm), projectedIn: grow(cm, Math.max(0, cm - reachCm)) });
  }
  return out;
}

/**
 * College benchmarks for one level band (VB Elite estimate): the average height of players at
 * her position in that band (from our rosters), reach at 1.30x, and college jump heights.
 */
export function collegeMeasurables(heightIn: number, position: string): Record<MetricKey, number> {
  const reach = toCm(heightIn) * REACH_RATIO;
  const approachJump = ELITE_APPROACH_JUMP_14_4 * jumpFactor(14.4);
  return {
    height: heightIn,
    reach: toIn(reach),
    approach: toIn(reach + approachJump),
    block: toIn(reach + (COLLEGE_BLOCK_JUMP[position] ?? COLLEGE_BLOCK_JUMP.OH)),
  };
}

/** Months since a date, for "time to re-measure" prompts. */
export function monthsSince(d: Date, now: Date): number {
  return (now.getTime() - d.getTime()) / (30.44 * 86400000);
}

/** Share of a list (e.g. D1 commits' heights) at or below a value, as a 0-100 percentile. */
export function shareBelow(value: number, list: number[]): number | null {
  if (list.length < 20) return null;
  return Math.round((100 * list.filter((x) => x <= value).length) / list.length);
}
