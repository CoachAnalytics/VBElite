/**
 * Starting-point recommendations from the questionnaire. Pure functions: the page
 * loads every school's summary and passes it in.
 *
 * Levels share one scale from 1 (weakest D1 program) to 3 (strongest). Bands: top D1
 * from 2.7 (about the top 50 programs), mid-level from 1.9, lower conferences below.
 * A school's level is its program-strength percentile among D1 programs; an
 * athlete's level is an estimate from the coach's projection, club results and
 * role, and her height against players at her position at each level.
 */
import type { ProgramSummary } from "./analytics";
import type { Weights } from "./analytics";
import { postseasonRank } from "./analytics";
import { milesBetween } from "./distance";
import type { CoachConfirmation } from "./coach";
import { regionOf, type Answers } from "./questionnaire";

const POWER_CONFERENCES = ["Southeastern Conference", "Big Ten Conference", "Big 12 Conference", "Atlantic Coast Conference"];

export type SchoolInfo = {
  id: number;
  slug: string;
  name: string;
  conference: string | null;
  city: string | null;
  state: string | null;
  control: string | null;
  enrollment: number | null;
  latitude: number | null;
  longitude: number | null;
  admissionRate: number | null;
  satAvg: number | null;
  tuitionInState: number | null;
  tuitionOutState: number | null;
  avgNetPrice: number | null;
  program: ProgramSummary;
  /** Whether roster and commit data exist for the athlete's position. */
  positionCovered: boolean;
  /** Commits at the athlete's position in the classes ahead of and with her. */
  incomingAtPosition: number;
  /** 5-1 | 6-2 | mixed in the latest researched season (null = unknown). */
  offenseSystem?: string | null;
};

export type AthleteBasics = {
  position: string;
  heightIn: number | null;
  homeState: string | null;
  latitude: number | null;
  longitude: number | null;
};

// ---------- Program level ----------

/** NCAA tournament success, 0–1: how often they made it and how far they went. */
function ncaaScore(s: SchoolInfo): number {
  const p = s.program;
  const best = Math.max(0, ...p.seasons.map((x) => postseasonRank(x.postseason) ?? 0));
  const apps = p.seasonsTracked ? p.postseasonApps / p.seasonsTracked : 0;
  return 0.5 * apps + 0.5 * (best / 7);
}

/**
 * Each school's level from 1 (weakest D1 program) to 3 (strongest), by percentile of a
 * composite: the strength of its conference (its members' NCAA tournament success), its
 * own tournament success, and its win %. Conference strength keeps a team that wins a
 * weak league from ranking above a .500 team in the SEC or Big Ten.
 */
export function programLevels(schools: SchoolInfo[]): Map<number, number> {
  const byConference = new Map<string, number[]>();
  for (const s of schools) {
    const key = s.conference ?? "";
    byConference.set(key, [...(byConference.get(key) ?? []), ncaaScore(s)]);
  }
  const confStrength = (s: SchoolInfo) => {
    const xs = byConference.get(s.conference ?? "") ?? [];
    return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  };
  const maxConf = Math.max(...schools.map(confStrength), 0.01);
  const scored = schools
    .filter((s) => s.program.winPct != null)
    .map((s) => {
      const power = POWER_CONFERENCES.includes(s.conference ?? "") ? 0.05 : 0;
      const v = 0.45 * (confStrength(s) / maxConf) + 0.3 * ncaaScore(s) + 0.25 * s.program.winPct! + power;
      return { id: s.id, v };
    })
    .sort((a, b) => a.v - b.v);
  const n = scored.length;
  return new Map(scored.map((x, i) => [x.id, 1 + (2 * i) / Math.max(1, n - 1)]));
}

const TOP_HIGH = 2.7;
const TOP_MID = 1.9;

export type HeightBenchmarks = { low: number | null; mid: number | null; high: number | null };

/** Average height at a position for lower-, mid- and top-level programs. */
export function heightBenchmarks(
  players: { schoolId: number; heightIn: number | null }[],
  levels: Map<number, number>,
): HeightBenchmarks {
  const bucket = (lo: number, hi: number) => {
    const hs = players
      .filter((p) => p.heightIn != null && (levels.get(p.schoolId) ?? 0) >= lo && (levels.get(p.schoolId) ?? 0) < hi)
      .map((p) => p.heightIn!);
    return hs.length >= 5 ? hs.reduce((a, b) => a + b, 0) / hs.length : null;
  };
  return { low: bucket(1, TOP_MID), mid: bucket(TOP_MID, TOP_HIGH), high: bucket(TOP_HIGH, 3.01) };
}

// ---------- Athlete level ----------

const COACH: Record<string, number | null> = { high: 2.85, mid: 2.3, low: 1.45, d2: 0.6, d3: 0.2, unknown: null };
const DIVISION: Record<string, number> = { open: 2.5, usa: 2, american: 1.5, regional: 0.9, none: 0.4 };
const FINISH: Record<string, number> = { medal: 0.4, nationals: 0.2, qualifier: 0, regional: -0.1, none: -0.2 };
const ROLE: Record<string, number> = { "starter-all": 0.2, starter: 0.1, rotation: -0.1, developing: -0.3 };
const HS: Record<string, number> = { "varsity-starter": 0.1, varsity: 0, jv: -0.2, none: 0 };
const CONTACT: Record<string, number> = { offers: 0.3, talks: 0.15, camps: 0, none: 0 };

const clamp = (x: number, lo = 0, hi = 3) => Math.min(hi, Math.max(lo, x));

/** Where her height falls against players at her position, on the program-level scale. */
function heightLevel(height: number | null, b: HeightBenchmarks): number | null {
  if (height == null || b.low == null || b.mid == null || b.high == null) return null;
  // Each benchmark is the average for its band; place them at the band middles.
  const [lo, mid, hi] = [1.45, 2.3, 2.85];
  if (height >= b.high) return clamp(hi + (height - b.high) / 4);
  if (height >= b.mid) return mid + ((hi - mid) * (height - b.mid)) / Math.max(0.5, b.high - b.mid);
  if (height >= b.low) return lo + ((mid - lo) * (height - b.low)) / Math.max(0.5, b.mid - b.low);
  return clamp(lo - (b.low - height) / 3);
}

export type LevelEstimate = {
  level: number;
  low: number;
  high: number;
  label: string;
  /** Plain-language notes on what drove the estimate. */
  drivers: string[];
  /** The estimate points mostly below D1, which isn't covered yet. */
  belowD1: boolean;
  /** Set when a coach confirmed her level through a confirmation link. */
  confirmedBy: { coachName: string; respondedAt: Date } | null;
};

export function levelLabel(level: number): string {
  if (level >= TOP_HIGH) return "Top D1 programs";
  if (level >= TOP_MID) return "Mid-level D1";
  if (level >= 1.0) return "Lower-conference D1";
  return "D2, D3 or NAIA";
}

/** The label for use mid-sentence ("mid-level D1"), keeping D1/D2/D3/NAIA capitalized. */
export function levelPhrase(level: number): string {
  const label = levelLabel(level);
  return label.startsWith("D") ? label : label[0].toLowerCase() + label.slice(1);
}

const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Her level from the questionnaire. A coach's confirmation, when there is one, replaces
 * the self-reported coach projection, club role and height, and narrows the range.
 */
export function estimateLevel(
  a: Answers,
  athlete: AthleteBasics,
  benchmarks: HeightBenchmarks,
  confirmation: CoachConfirmation | null = null,
  /** Her strongest real recruiting interest: an offer or official visit (see interestLevel). */
  interest: { level: number; schoolName: string; type: string } | null = null,
  /**
   * Her measurables projected to 18 (see development.ts). When given, her projected height
   * replaces today's, and her projected approach touch counts against college estimates.
   */
  projection: { heightIn: number; approachIn: number | null; approachBenchmarks: HeightBenchmarks } | null = null,
): LevelEstimate {
  const coach = confirmation ? COACH[confirmation.level] : COACH[a.coachProjection];
  const role = ROLE[confirmation?.role ?? a.clubRole];
  const club = clamp(DIVISION[a.clubDivision] + FINISH[a.clubFinish] + role + HS[a.hsRole] + CONTACT[a.contact]);
  // A coach's corrected height is today's height too, so the projection applies on top of it.
  const heightIn = projection ? projection.heightIn : (confirmation?.heightIn ?? athlete.heightIn);
  const height = heightLevel(heightIn, benchmarks);
  const touch = projection?.approachIn != null ? heightLevel(projection.approachIn, projection.approachBenchmarks) : null;
  // Height matters less for setters and liberos.
  const heightWeight = athlete.position === "LDS" || athlete.position === "S" ? 0.1 : 0.2;
  const coachWeight = confirmation ? 0.55 : 0.45;

  const parts: [number, number][] = [
    ...(coach != null ? ([[coach, coachWeight]] as [number, number][]) : []),
    [club, coach != null ? 0.35 : 0.65],
    ...(height != null ? ([[height, heightWeight]] as [number, number][]) : []),
    ...(touch != null ? ([[touch, heightWeight * 0.75]] as [number, number][]) : []),
    // A real offer (or official visit) is the strongest evidence there is.
    ...(interest ? ([[interest.level, interest.type === "official" ? 0.3 : 0.5]] as [number, number][]) : []),
  ];
  const weight = parts.reduce((n, [, w]) => n + w, 0);
  const level = clamp(parts.reduce((n, [v, w]) => n + v * w, 0) / weight);
  const spread = confirmation ? 0.25 : coach != null ? 0.35 : 0.55;

  const drivers: string[] = [];
  if (confirmation) {
    drivers.push(`${confirmation.coachName} confirmed on ${shortDate(confirmation.respondedAt)} that she can play ${levelPhrase(coach!)}.`);
    if (confirmation.heightIn != null && confirmation.heightIn !== athlete.heightIn) {
      drivers.push(`Her coach corrected her height to ${Math.floor(confirmation.heightIn / 12)}'${confirmation.heightIn % 12}".`);
    }
  } else if (coach != null) {
    drivers.push(`Her coach projects her at ${levelPhrase(coach)} (not yet confirmed by the coach).`);
  } else {
    drivers.push("No coach projection yet, so the range is wider. Send her coach a confirmation link below.");
  }
  if (interest) {
    drivers.push(
      `${interest.type === "official" ? "An official visit to" : "An offer from"} ${interest.schoolName} (${levelPhrase(interest.level)}) counts as strong evidence of her level.`,
    );
  }
  drivers.push(`Her club level and playing role point to ${levelPhrase(club)}.`);
  if (height != null) {
    drivers.push(
      projection
        ? `Her projected height at 18 is typical of ${levelPhrase(height)} players at her position.`
        : `Her height is typical of ${levelPhrase(height)} players at her position.`,
    );
  }
  if (touch != null) {
    drivers.push(`Her projected approach touch is in the range of ${levelPhrase(touch)} (VB Elite estimate).`);
  }
  return {
    level,
    low: clamp(level - spread),
    high: clamp(level + spread),
    label: levelLabel(level),
    drivers,
    belowD1: level < 1,
    confirmedBy: confirmation ? { coachName: confirmation.coachName, respondedAt: confirmation.respondedAt } : null,
  };
}

// ---------- Recommendations ----------

export type Tier = "reach" | "target" | "likely";
export type Pick = { school: SchoolInfo; tier: Tier; level: number; score: number; reasons: string[] };

const IMPORTANCE = (v: string) => [0.5, 1.5, 3, 5][Number(v)] ?? 1;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const SIZE: Record<string, [number, number]> = { small: [0, 5000], medium: [5000, 15000], large: [15000, Infinity] };

export function recommend(
  schools: SchoolInfo[],
  levels: Map<number, number>,
  estimate: LevelEstimate,
  a: Answers,
  athlete: AthleteBasics,
  limits = { reach: 6, target: 10, likely: 6 },
): Pick[] {
  const maxMiles = Number(a.maxDistance);
  const candidates = schools.flatMap((s) => {
    const level = levels.get(s.id);
    if (level == null) return [];
    const diff = level - estimate.level;
    const tier: Tier | null = diff > 1 || diff < -1 ? null : diff > 0.35 ? "reach" : diff < -0.35 ? "likely" : "target";
    if (!tier) return [];
    const miles =
      s.latitude != null && athlete.latitude != null
        ? milesBetween({ latitude: athlete.latitude, longitude: athlete.longitude! }, { latitude: s.latitude, longitude: s.longitude! })
        : null;
    // Straight-line miles; driving is ~20% more, so allow a little slack.
    if (maxMiles > 0 && miles != null && miles > maxMiles * 1.1) return [];
    const inState = !!athlete.homeState && athlete.homeState === s.state;
    const price = s.control === "public" && inState ? s.tuitionInState : (s.avgNetPrice ?? s.tuitionOutState);
    return [{ s, level, tier, miles, inState, price }];
  });

  const range = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
  const priceRange = range(candidates.map((c) => c.price));
  const incomingRange = range(candidates.filter((c) => c.s.positionCovered).map((c) => c.s.incomingAtPosition));
  const norm = (v: number | null, r: { min: number; max: number }, lowerIsBetter = false) => {
    if (v == null || !(r.max > r.min)) return 0.5;
    const x = (v - r.min) / (r.max - r.min);
    return lowerIsBetter ? 1 - x : x;
  };

  const w = {
    playing: IMPORTANCE(a.wantPlayingTime),
    winning: IMPORTANCE(a.wantWinning),
    academics: IMPORTANCE(a.wantAcademics),
    cost: IMPORTANCE(a.wantCost),
  };
  const gpa = Number(a.gpa);

  const scored = candidates.map(({ s, level, tier, miles, inState, price }) => {
    const reasons: string[] = [];
    const parts: [number, number][] = [];

    // Program level relative to hers: a near match is the best fit; winning-minded athletes lean up.
    const fit = 1 - Math.abs(level - estimate.level);
    parts.push([fit, 2]);
    parts.push([(level - 1) / 2, w.winning]);
    const best = s.program.bestFinish ? `, best NCAA finish ${s.program.bestFinish}` : "";
    reasons.push(
      tier === "reach"
        ? `Reach: a stronger program than her estimated level${best}.`
        : tier === "target"
          ? `Target: program level matches her estimate${best}.`
          : `Likely: she'd rank among the stronger recruits here${best}.`,
    );

    if (s.positionCovered) {
      parts.push([norm(s.incomingAtPosition, incomingRange, true), w.playing]);
      reasons.push(
        s.incomingAtPosition === 0
          ? `No ${athlete.position} commits yet in the classes ahead of her.`
          : `${s.incomingAtPosition} ${athlete.position} commit${s.incomingAtPosition > 1 ? "s" : ""} in the classes ahead of her.`,
      );
    }

    // Offense: a 6-2 puts two setters on the court. Setters say which they prefer in the
    // questionnaire; without an answer we lean gently toward a 6-2 (more setters play).
    if (athlete.position === "S" && s.offenseSystem) {
      const pref = a.setterSystem ?? null;
      const describe =
        s.offenseSystem === "6-2"
          ? "Runs a 6-2: two setters play, so there's more setting time to go around"
          : s.offenseSystem === "5-1"
            ? "Runs a 5-1: one setter plays all six rotations"
            : "Has used both a 5-1 and a 6-2";
      if (pref === "either") {
        reasons.push(`${describe}.`);
      } else {
        const want = pref ?? "6-2";
        const match = s.offenseSystem === want ? 1 : s.offenseSystem === "mixed" ? 0.6 : 0;
        parts.push([match, pref ? w.playing : w.playing * 0.5]);
        reasons.push(pref && match === 1 ? `${describe}, as she prefers.` : `${describe}.`);
      }
    } else if (athlete.position === "OPP" && s.offenseSystem === "6-2") {
      reasons.push("Runs a 6-2: the second setter usually plays opposite when in the back row.");
    }

    if (s.satAvg != null && a.sat != null) {
      const gap = a.sat - s.satAvg;
      parts.push([clamp(1 - Math.abs(gap) / 300, 0, 1), w.academics]);
      reasons.push(`Average SAT ${s.satAvg}${Math.abs(gap) <= 80 ? ", close to hers" : gap > 0 ? ", below hers" : ", above hers"}.`);
    } else if (s.admissionRate != null) {
      // Without a test score, selectivity stands in for academic reputation.
      parts.push([1 - s.admissionRate, w.academics]);
    }
    let academicPenalty = 1;
    if (s.admissionRate != null && s.admissionRate < 0.25 && gpa < 3.5) {
      academicPenalty = 0.6;
      reasons.push(`Very selective admissions (${Math.round(s.admissionRate * 100)}% admitted); an academic reach.`);
    }

    if (price != null) {
      parts.push([norm(price, priceRange, true), w.cost]);
      reasons.push(
        s.control === "public" && inState ? `${money(price)} in-state tuition.` : `About ${money(price)} a year after typical aid.`,
      );
    }

    if (miles != null) {
      parts.push([maxMiles > 0 ? 1 - miles / (maxMiles * 1.1) : 0.5, 1]);
      reasons.push(`${Math.round(miles).toLocaleString()} miles from home.`);
    }

    // Soft preferences: a mismatch lowers the score but doesn't rule a school out.
    let pref = 1;
    if (a.regions.length && !a.regions.includes(regionOf(s.state) ?? "")) pref *= 0.7;
    if (a.size !== "any" && s.enrollment != null) {
      const [lo, hi] = SIZE[a.size];
      if (s.enrollment < lo || s.enrollment >= hi) pref *= 0.85;
    }
    if (a.control !== "any" && s.control && s.control !== a.control) pref *= 0.85;

    const total = parts.reduce((n, [, wt]) => n + wt, 0);
    const score = (parts.reduce((n, [v, wt]) => n + v * wt, 0) / total) * pref * academicPenalty;
    return { school: s, tier, level, score, reasons };
  });

  return (["reach", "target", "likely"] as Tier[]).flatMap((t) =>
    scored
      .filter((p) => p.tier === t)
      .sort((x, y) => y.score - x.score)
      .slice(0, limits[t]),
  );
}

/** Compare-page weights (0–5) implied by the questionnaire's priorities. */
export function weightsFromAnswers(a: Answers): Weights {
  const imp = (v: string) => [1, 2, 3, 5][Number(v)] ?? 2;
  const distance = ({ "250": 4, "600": 2, "1200": 1, "0": 0 } as Record<string, number>)[a.maxDistance] ?? 1;
  return {
    program: imp(a.wantWinning),
    opportunity: imp(a.wantPlayingTime),
    cost: imp(a.wantCost),
    distance,
    coach: 1,
    academics: imp(a.wantAcademics),
    height: 1,
  };
}
