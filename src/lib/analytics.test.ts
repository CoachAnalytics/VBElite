import { describe, expect, it } from "vitest";
import type { Commit, RosterPlayer, School, Season } from "@/db/schema";
import {
  analyzeSchool,
  classRecruitingOpen,
  costFor,
  DEFAULT_WEIGHTS,
  positionOutlook,
  positionTimeline,
  programSummary,
  scoreSchools,
  type AthleteInput,
  type SchoolBundle,
} from "./analytics";
import { normalizePositions } from "./positions";
import { parseHeight } from "./format";

const school = (over: Partial<School> = {}): School => ({
  id: 1,
  slug: "test-u",
  name: "Test U",
  city: "Columbus",
  state: "OH",
  latitude: 39.96,
  longitude: -83.0,
  division: "D1",
  conference: "Test",
  control: "public",
  enrollment: 10000,
  enrollmentNote: null,
  tuitionInState: 12000,
  tuitionOutState: 35000,
  tuitionYear: "2026-27",
  headCoach: "Coach",
  coachSince: 2020,
  apr: 1000,
  aprNote: null,
  rosterSize: 17,
  rosterSeason: 2026,
  positionsCovered: "OH",
  commitDataQuality: "good",
  recruitingNote: null,
  programNote: null,
  updatedAt: new Date(),
  ...over,
});

let nextId = 1;
const player = (classYear: string, positions = "OH", heightIn = 72): RosterPlayer => ({
  id: nextId++,
  schoolId: 1,
  season: 2026,
  name: `P${nextId}`,
  classYear,
  redshirt: false,
  positionRaw: positions,
  positions,
  primaryPosition: positions.split("/")[0],
  heightIn,
});
const commit = (gradYear: number, positions = "OH", heightIn = 73): Commit => ({
  id: nextId++,
  schoolId: 1,
  name: `C${nextId}`,
  gradYear,
  positionRaw: positions,
  positions,
  primaryPosition: positions.split("/")[0],
  heightIn,
  hometown: null,
  club: null,
  note: null,
});
const season = (year: number, wins: number, losses: number, postseason: string | null): Season => ({
  id: nextId++,
  schoolId: 1,
  year,
  wins,
  losses,
  postseason,
});

const athlete: AthleteInput = {
  gradYear: 2028,
  position: "OH",
  heightIn: 73,
  homeState: "OH",
  latitude: 39.96,
  longitude: -83.0,
};

const asOf = new Date("2026-09-30T00:00:00Z");

describe("normalizePositions", () => {
  it("maps aliases, keeps order, drops duplicates", () => {
    expect(normalizePositions("OH/DS/L")).toEqual(["OH", "LDS"]);
    expect(normalizePositions("RS/OH")).toEqual(["OPP", "OH"]);
    expect(normalizePositions("MH")).toEqual(["MB"]);
    expect(normalizePositions(null)).toEqual([]);
  });
});

describe("parseHeight", () => {
  it("parses common formats", () => {
    expect(parseHeight(`6'2"`)).toBe(74);
    expect(parseHeight("5-10")).toBe(70);
    expect(parseHeight("72")).toBe(72);
    expect(parseHeight("tall")).toBeNull();
  });
});

describe("programSummary", () => {
  it("totals records and finds the best postseason finish", () => {
    const p = programSummary([
      season(2024, 20, 10, "Sweet 16"),
      season(2023, 10, 20, "DNQ"),
      season(2025, 30, 0, "1st round"),
    ]);
    expect(p.wins).toBe(60);
    expect(p.losses).toBe(30);
    expect(p.winPct).toBeCloseTo(2 / 3);
    expect(p.postseasonApps).toBe(2);
    expect(p.bestFinish).toBe("Sweet 16 (2024)");
    expect(p.seasons.map((s) => s.year)).toEqual([2023, 2024, 2025]);
    expect(p.lastSeasonWinPct).toBe(1);
  });
});

describe("positionOutlook", () => {
  const bundle: SchoolBundle = {
    school: school(),
    seasons: [],
    roster: [player("Fr"), player("So"), player("Jr"), player("Sr"), player("Grad"), player("Fr", "OPP/OH")],
    commits: [commit(2027), commit(2027, "DS/OH"), commit(2028), commit(2029), commit(2027, "MB")],
  };

  it("projects who is still around in the athlete's freshman season", () => {
    const o = positionOutlook(bundle, athlete, asOf);
    // 2028 freshman season is 2 seasons after 2026: current Fr (3 left) and So (2 left) remain.
    expect(o.yearsUntilArrival).toBe(2);
    expect(o.currentAtPosition).toBe(5);
    expect(o.returningAtArrival).toBe(2);
    expect(o.commitsAhead).toBe(1);
    expect(o.sameClassCommits).toBe(1);
    expect(o.projectedCompetition).toBe(4);
    // Hybrids: the OPP/OH freshman and the DS/OH 2027 commit also count.
    expect(o.projectedCompetitionWithHybrids).toBe(6);
    expect(o.commitsAheadByClass).toEqual({ 2027: 1 });
    expect(o.classesNotYetRecruited).toEqual([]);
  });

  it("flags ahead classes whose recruiting has not opened", () => {
    const o = positionOutlook(bundle, { ...athlete, gradYear: 2030 }, asOf);
    expect(o.classesNotYetRecruited).toEqual([2029]);
    expect(o.returningAtArrival).toBe(0);
    expect(o.commitsAhead).toBe(3); // 2027, 2028, 2029 OH commits
  });

  it("reports height relative to the position group", () => {
    const o = positionOutlook(bundle, athlete, asOf);
    expect(o.avgHeightAtPosition).toBeCloseTo((72 * 5 + 73 * 3) / 8);
    expect(o.heightPercentile).toBe(1);
  });

  it("marks positions without collected data", () => {
    expect(positionOutlook(bundle, { ...athlete, position: "S" }, asOf).covered).toBe(false);
  });

  it("builds a four-season timeline", () => {
    const t = positionTimeline(bundle, athlete);
    expect(t.map((x) => x.season)).toEqual([2028, 2029, 2030, 2031]);
    expect(t[0]).toMatchObject({ currentRoster: 2, olderCommits: 1, sameClass: 1, youngerCommits: 0 });
    expect(t[1]).toMatchObject({ currentRoster: 1, olderCommits: 1, youngerCommits: 1 });
  });
});

describe("classRecruitingOpen", () => {
  it("opens Aug 1 two years before graduation", () => {
    expect(classRecruitingOpen(2028, new Date("2026-07-31T00:00:00Z"))).toBe(false);
    expect(classRecruitingOpen(2028, new Date("2026-08-01T00:00:00Z"))).toBe(true);
  });
});

describe("costFor", () => {
  it("uses in-state tuition for home-state public schools", () => {
    expect(costFor(school(), athlete)).toEqual({ tuition: 12000, inState: true, estimated: false });
    expect(costFor(school(), { ...athlete, homeState: "KY" })).toEqual({ tuition: 35000, inState: false, estimated: false });
  });
  it("falls back to the other rate and marks it estimated", () => {
    expect(costFor(school({ tuitionInState: null }), athlete)).toEqual({ tuition: 35000, inState: true, estimated: true });
  });
});

describe("scoreSchools", () => {
  const a = analyzeSchool(
    { school: school({ id: 1 }), seasons: [season(2025, 30, 0, "Champion")], roster: [], commits: [] },
    athlete,
    asOf,
  );
  const b = analyzeSchool(
    {
      school: school({ id: 2, tuitionInState: 50000, tuitionOutState: 50000, latitude: 34, longitude: -118, apr: null }),
      seasons: [season(2025, 0, 30, "DNQ")],
      roster: [player("Fr"), player("So")],
      commits: [],
    },
    athlete,
    asOf,
  );

  it("ranks the better school higher and scores 0–100", () => {
    const [sa, sb] = scoreSchools([a, b], DEFAULT_WEIGHTS);
    expect(sa.score).toBeGreaterThan(sb.score!);
    expect(sa.score).toBeLessThanOrEqual(100);
    expect(sb.score).toBeGreaterThanOrEqual(0);
  });

  it("leaves missing data out instead of counting it as zero", () => {
    const [, sb] = scoreSchools([a, b], DEFAULT_WEIGHTS);
    expect(sb.parts.academics).toBeNull();
  });

  it("respects weights", () => {
    const onlyCost = { ...DEFAULT_WEIGHTS, program: 0, opportunity: 0, distance: 0, coach: 0, academics: 0, height: 0 };
    const [sa, sb] = scoreSchools([a, b], onlyCost);
    expect(sa.score).toBe(100);
    expect(sb.score).toBe(0);
  });
});
