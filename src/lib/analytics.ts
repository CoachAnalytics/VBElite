/**
 * Pure analytics: everything the comparison dashboard shows is computed here from
 * a school's data plus the athlete's profile. No database access, so it is easy to
 * test and can run on the server or in the browser.
 */
import type { Commit, RosterPlayer, School, Season } from "@/db/schema";
import { milesBetween } from "./distance";

export type SchoolBundle = {
  school: School;
  seasons: Season[];
  roster: RosterPlayer[];
  commits: Commit[];
};

export type AthleteInput = {
  gradYear: number;
  position: string;
  heightIn: number | null;
  homeState: string | null;
  latitude: number | null;
  longitude: number | null;
};

// ---------- Program strength ----------

const POSTSEASON_RANK: Record<string, number> = {
  dnq: 0,
  "1st round": 1,
  "2nd round": 2,
  "sweet 16": 3,
  "elite 8": 4,
  "final four": 5,
  "runner-up": 6,
  champion: 7,
};

export function postseasonRank(result: string | null): number | null {
  if (!result) return null;
  // Unrecognized labels (other divisions' formats) still count as an appearance.
  return POSTSEASON_RANK[result.trim().toLowerCase()] ?? 1;
}

export type ProgramSummary = {
  seasons: { year: number; wins: number; losses: number; winPct: number; postseason: string | null }[];
  wins: number;
  losses: number;
  winPct: number | null;
  postseasonApps: number;
  seasonsTracked: number;
  bestFinish: string | null;
  lastSeasonWinPct: number | null;
};

export function programSummary(seasons: Season[]): ProgramSummary {
  const sorted = [...seasons].sort((a, b) => a.year - b.year);
  const rows = sorted.map((s) => ({
    year: s.year,
    wins: s.wins,
    losses: s.losses,
    winPct: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
    postseason: s.postseason,
  }));
  const wins = rows.reduce((n, r) => n + r.wins, 0);
  const losses = rows.reduce((n, r) => n + r.losses, 0);
  let best: { label: string; rank: number } | null = null;
  let apps = 0;
  for (const r of rows) {
    const rank = postseasonRank(r.postseason);
    if (rank == null) continue;
    if (rank > 0) apps++;
    if (rank > 0 && (!best || rank >= best.rank)) best = { label: `${r.postseason} (${r.year})`, rank };
  }
  return {
    seasons: rows,
    wins,
    losses,
    winPct: wins + losses > 0 ? wins / (wins + losses) : null,
    postseasonApps: apps,
    seasonsTracked: rows.length,
    bestFinish: best?.label ?? null,
    lastSeasonWinPct: rows.at(-1)?.winPct ?? null,
  };
}

// ---------- Position outlook ----------

/** Seasons of eligibility left after the roster season, by listed class. */
const SEASONS_LEFT: Record<string, number> = { Fr: 3, So: 2, Jr: 1, Sr: 0, Grad: 0 };

/** NCAA D1 recruiting contact opens Aug 1 before a recruit's junior year of high school. */
export function classRecruitingOpen(gradYear: number, asOf: Date): boolean {
  return asOf >= new Date(Date.UTC(gradYear - 2, 7, 1));
}

type Person = { name: string; heightIn: number | null; positions: string; primaryPosition: string };

function atPosition(p: Person, position: string, includeHybrids: boolean) {
  return includeHybrids ? p.positions.split("/").includes(position) : p.primaryPosition === position;
}

export type PositionOutlook = {
  covered: boolean;
  rosterSeason: number;
  /** Seasons between the current roster and the athlete's freshman season. */
  yearsUntilArrival: number;
  currentAtPosition: number;
  currentByClass: Record<string, number>;
  /** Current players still eligible in the athlete's freshman season. */
  returningAtArrival: number;
  /** Commits from classes ahead of the athlete who will be on the roster when they arrive. */
  commitsAhead: number;
  commitsAheadByClass: Record<number, number>;
  /** Commits in the athlete's own recruiting class. */
  sameClassCommits: number;
  /** Primary-position players the athlete would compete with as a freshman. */
  projectedCompetition: number;
  /** Same, counting hybrids (e.g. OH/DS) too. */
  projectedCompetitionWithHybrids: number;
  /** Ahead-of-athlete classes whose recruiting hasn't opened, so their commits can't be known yet. */
  classesNotYetRecruited: number[];
  avgHeightAtPosition: number | null;
  heightDelta: number | null;
  /** Share of position players (roster + commits) the athlete is at least as tall as. */
  heightPercentile: number | null;
};

export function positionOutlook(
  bundle: SchoolBundle,
  athlete: AthleteInput,
  asOf: Date = new Date(),
): PositionOutlook {
  const { school, roster, commits } = bundle;
  const pos = athlete.position;
  const rosterSeason = school.rosterSeason ?? asOf.getUTCFullYear();
  const yearsUntilArrival = athlete.gradYear - rosterSeason;
  const covered = school.positionsCovered.split(",").includes(pos);

  const count = (includeHybrids: boolean) => {
    const current = roster.filter((p) => atPosition(p, pos, includeHybrids));
    const returning = current.filter((p) => (SEASONS_LEFT[p.classYear] ?? 0) >= yearsUntilArrival);
    const posCommits = commits.filter((c) => atPosition(c, pos, includeHybrids));
    const ahead = posCommits.filter(
      (c) => c.gradYear < athlete.gradYear && c.gradYear >= athlete.gradYear - 3 && c.gradYear > rosterSeason,
    );
    const same = posCommits.filter((c) => c.gradYear === athlete.gradYear);
    return { current, returning, ahead, same, posCommits };
  };
  const primary = count(false);
  const hybrid = count(true);

  const currentByClass: Record<string, number> = { Fr: 0, So: 0, Jr: 0, Sr: 0, Grad: 0 };
  for (const p of primary.current) currentByClass[p.classYear] = (currentByClass[p.classYear] ?? 0) + 1;
  const commitsAheadByClass: Record<number, number> = {};
  const classesNotYetRecruited: number[] = [];
  for (let y = Math.max(rosterSeason + 1, athlete.gradYear - 3); y < athlete.gradYear; y++) {
    commitsAheadByClass[y] = primary.ahead.filter((c) => c.gradYear === y).length;
    if (!classRecruitingOpen(y, asOf)) classesNotYetRecruited.push(y);
  }

  const heights = [...primary.current, ...primary.posCommits]
    .map((p) => p.heightIn)
    .filter((h): h is number => h != null);
  const avg = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null;
  const h = athlete.heightIn;

  return {
    covered,
    rosterSeason,
    yearsUntilArrival,
    currentAtPosition: primary.current.length,
    currentByClass,
    returningAtArrival: primary.returning.length,
    commitsAhead: primary.ahead.length,
    commitsAheadByClass,
    sameClassCommits: primary.same.length,
    projectedCompetition: primary.returning.length + primary.ahead.length + primary.same.length,
    projectedCompetitionWithHybrids: hybrid.returning.length + hybrid.ahead.length + hybrid.same.length,
    classesNotYetRecruited,
    avgHeightAtPosition: avg,
    heightDelta: h != null && avg != null ? h - avg : null,
    heightPercentile: h != null && heights.length ? heights.filter((x) => x <= h).length / heights.length : null,
  };
}

/** Players at the athlete's position in each of their four college seasons (known data only). */
export function positionTimeline(bundle: SchoolBundle, athlete: AthleteInput) {
  const { school, roster, commits } = bundle;
  const pos = athlete.position;
  const rosterSeason = school.rosterSeason ?? athlete.gradYear;
  return [0, 1, 2, 3].map((i) => {
    const season = athlete.gradYear + i;
    const current = roster.filter(
      (p) => p.primaryPosition === pos && (SEASONS_LEFT[p.classYear] ?? 0) >= season - rosterSeason,
    ).length;
    const inCommits = commits.filter((c) => c.primaryPosition === pos && c.gradYear <= season && c.gradYear + 3 >= season);
    return {
      season,
      label: ["Fr", "So", "Jr", "Sr"][i],
      currentRoster: current,
      olderCommits: inCommits.filter((c) => c.gradYear < athlete.gradYear).length,
      sameClass: inCommits.filter((c) => c.gradYear === athlete.gradYear).length,
      youngerCommits: inCommits.filter((c) => c.gradYear > athlete.gradYear).length,
    };
  });
}

// ---------- Cost, distance, coach ----------

export type CostSummary = { tuition: number | null; inState: boolean; estimated: boolean };

export function costFor(school: School, athlete: AthleteInput): CostSummary {
  const inState = !!athlete.homeState && athlete.homeState === school.state;
  const preferred = inState ? school.tuitionInState : school.tuitionOutState;
  const fallback = inState ? school.tuitionOutState : school.tuitionInState;
  return {
    tuition: preferred ?? fallback ?? null,
    inState,
    // In-state rate missing: we show the out-of-state rate as an upper bound.
    estimated: preferred == null && fallback != null,
  };
}

export function distanceFor(school: School, athlete: AthleteInput): number | null {
  if (school.latitude == null || school.longitude == null || athlete.latitude == null || athlete.longitude == null) {
    return null;
  }
  return milesBetween(
    { latitude: athlete.latitude, longitude: athlete.longitude },
    { latitude: school.latitude, longitude: school.longitude },
  );
}

export function coachTenure(school: School, asOf: Date = new Date()): number | null {
  if (school.coachSince == null) return null;
  const season = school.rosterSeason ?? asOf.getUTCFullYear();
  return Math.max(1, season - school.coachSince + 1);
}

// ---------- Full analysis + fit score ----------

export type SchoolAnalysis = {
  id: number;
  slug: string;
  name: string;
  division: string;
  conference: string | null;
  city: string | null;
  state: string | null;
  control: string | null;
  enrollment: number | null;
  headCoach: string | null;
  coachSince: number | null;
  coachTenure: number | null;
  apr: number | null;
  aprNote: string | null;
  commitDataQuality: string | null;
  recruitingNote: string | null;
  program: ProgramSummary;
  position: PositionOutlook;
  cost: CostSummary;
  distanceMiles: number | null;
};

export function analyzeSchool(bundle: SchoolBundle, athlete: AthleteInput, asOf: Date = new Date()): SchoolAnalysis {
  const s = bundle.school;
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    division: s.division,
    conference: s.conference,
    city: s.city,
    state: s.state,
    control: s.control,
    enrollment: s.enrollment,
    headCoach: s.headCoach,
    coachSince: s.coachSince,
    coachTenure: coachTenure(s, asOf),
    apr: s.apr,
    aprNote: s.aprNote,
    commitDataQuality: s.commitDataQuality,
    recruitingNote: s.recruitingNote,
    program: programSummary(bundle.seasons),
    position: positionOutlook(bundle, athlete, asOf),
    cost: costFor(s, athlete),
    distanceMiles: distanceFor(s, athlete),
  };
}

export const FACTORS = [
  { key: "program", label: "Program strength", help: "Win % and postseason appearances" },
  { key: "opportunity", label: "Playing-time opportunity", help: "Fewer players at your position when you arrive" },
  { key: "cost", label: "Cost", help: "Lower published tuition & fees" },
  { key: "distance", label: "Close to home", help: "Shorter distance from home" },
  { key: "coach", label: "Coaching stability", help: "Longer head-coach tenure (capped at 10 years)" },
  { key: "academics", label: "Academics (APR)", help: "Higher Academic Progress Rate" },
  { key: "height", label: "Height fit", help: "Taller relative to players at your position" },
] as const;

export type FactorKey = (typeof FACTORS)[number]["key"];
export type Weights = Record<FactorKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  program: 3,
  opportunity: 3,
  cost: 2,
  distance: 1,
  coach: 1,
  academics: 1,
  height: 1,
};

/** Raw value per factor, oriented so that higher is better; null = no data. */
export function factorValues(a: SchoolAnalysis): Record<FactorKey, number | null> {
  const p = a.program;
  return {
    program: p.winPct == null ? null : 0.7 * p.winPct + 0.3 * (p.seasonsTracked ? p.postseasonApps / p.seasonsTracked : 0),
    opportunity: a.position.covered ? -a.position.projectedCompetition : null,
    cost: a.cost.tuition == null ? null : -a.cost.tuition,
    distance: a.distanceMiles == null ? null : -a.distanceMiles,
    coach: a.coachTenure == null ? null : Math.min(a.coachTenure, 10),
    academics: a.apr,
    height: a.position.covered ? a.position.heightDelta : null,
  };
}

export type ScoredSchool = {
  id: number;
  score: number | null;
  /** 0–1 per factor, relative to the schools being compared; null = no data. */
  parts: Record<FactorKey, number | null>;
};

/**
 * Scores each school 0–100 relative to the set being compared: each factor is scaled
 * so the best school in the set gets 1 and the worst 0, then combined with the
 * family's weights. Factors a school has no data for are left out of its score
 * (its remaining weights are rescaled), not counted as zero.
 */
export function scoreSchools(analyses: SchoolAnalysis[], weights: Weights): ScoredSchool[] {
  const values = analyses.map(factorValues);
  const ranges = {} as Record<FactorKey, { min: number; max: number }>;
  for (const { key } of FACTORS) {
    const xs = values.map((v) => v[key]).filter((x): x is number => x != null);
    ranges[key] = { min: Math.min(...xs), max: Math.max(...xs) };
  }
  return analyses.map((a, i) => {
    const parts = {} as Record<FactorKey, number | null>;
    let total = 0;
    let weight = 0;
    for (const { key } of FACTORS) {
      const v = values[i][key];
      if (v == null) {
        parts[key] = null;
        continue;
      }
      const { min, max } = ranges[key];
      const norm = max > min ? (v - min) / (max - min) : 0.5;
      parts[key] = norm;
      total += norm * weights[key];
      weight += weights[key];
    }
    return { id: a.id, score: weight > 0 ? Math.round((100 * total) / weight) : null, parts };
  });
}
