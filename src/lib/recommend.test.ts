import { describe, expect, it } from "vitest";
import { programSummary } from "./analytics";
import type { Answers } from "./questionnaire";
import { answersSchema } from "./questionnaire";
import {
  estimateLevel,
  heightBenchmarks,
  programLevels,
  recommend,
  weightsFromAnswers,
  type SchoolInfo,
} from "./recommend";

const answers = (over: Partial<Answers> = {}): Answers => ({
  standingReach: null,
  approachTouch: null,
  blockTouch: null,
  hand: "right",
  secondPosition: "",
  clubDivision: "usa",
  clubFinish: "qualifier",
  clubRole: "starter",
  hsRole: "varsity-starter",
  yearsClub: "4",
  coachProjection: "mid",
  contact: "camps",
  video: "",
  gpa: "3.5",
  sat: null,
  wantPlayingTime: "2",
  wantWinning: "1",
  wantAcademics: "1",
  wantCost: "1",
  maxDistance: "0",
  regions: [],
  size: "any",
  control: "any",
  ...over,
});

let nextId = 1;
/** A school whose five seasons all had this win %, with `apps` NCAA appearances. */
const school = (winPct: number, apps = 0, over: Partial<SchoolInfo> = {}): SchoolInfo => {
  const id = nextId++;
  const wins = Math.round(30 * winPct);
  return {
    id,
    slug: `s${id}`,
    name: `School ${id}`,
    conference: "Test",
    city: "Columbus",
    state: "OH",
    control: "public",
    enrollment: 10000,
    latitude: 39.96,
    longitude: -83,
    admissionRate: 0.7,
    satAvg: 1200,
    tuitionInState: 12000,
    tuitionOutState: 30000,
    avgNetPrice: 18000,
    program: programSummary(
      [2021, 2022, 2023, 2024, 2025].map((year, i) => ({
        id: id * 10 + i,
        schoolId: id,
        year,
        wins,
        losses: 30 - wins,
        postseason: i < apps ? "2nd round" : "DNQ",
        ncaaSeed: null,
      })),
    ),
    positionCovered: true,
    incomingAtPosition: 1,
    ...over,
  };
};

const athlete = { position: "OH", heightIn: 72, homeState: "OH", latitude: 39.96, longitude: -83 };
const noHeights = { low: null, mid: null, high: null };

describe("answersSchema", () => {
  it("accepts a complete set of answers", () => {
    expect(answersSchema.safeParse(answers()).success).toBe(true);
  });
  it("rejects an unknown choice", () => {
    expect(answersSchema.safeParse({ ...answers(), clubDivision: "elite" }).success).toBe(false);
  });
});

describe("programLevels", () => {
  it("ranks programs from 1 (weakest) to 3 (strongest)", () => {
    const weak = school(0.2);
    const mid = school(0.5);
    const strong = school(0.9, 5);
    const levels = programLevels([mid, strong, weak]);
    expect(levels.get(weak.id)).toBe(1);
    expect(levels.get(mid.id)).toBe(2);
    expect(levels.get(strong.id)).toBe(3);
  });
});

describe("heightBenchmarks", () => {
  it("averages heights by program level, needing at least 5 players", () => {
    const levels = new Map([[1, 1], [2, 3]]);
    const players = [...Array(5)].map(() => ({ schoolId: 1, heightIn: 70 })).concat(
      [...Array(5)].map(() => ({ schoolId: 2, heightIn: 74 })),
    );
    expect(heightBenchmarks(players, levels)).toEqual({ low: 70, mid: null, high: 74 });
  });
});

describe("estimateLevel", () => {
  it("leans on the coach's projection", () => {
    const top = estimateLevel(answers({ coachProjection: "high", clubDivision: "open", clubFinish: "medal" }), athlete, noHeights);
    expect(top.label).toBe("Top D1 (Power conferences)");
    const low = estimateLevel(answers({ coachProjection: "d3", clubDivision: "regional", clubRole: "developing" }), athlete, noHeights);
    expect(low.belowD1).toBe(true);
  });

  it("widens the range without a coach projection", () => {
    const withCoach = estimateLevel(answers(), athlete, noHeights);
    const without = estimateLevel(answers({ coachProjection: "unknown" }), athlete, noHeights);
    expect(without.high - without.low).toBeGreaterThan(withCoach.high - withCoach.low);
    expect(without.drivers[0]).toMatch(/No coach projection/);
  });

  it("counts height against players at her position", () => {
    const benchmarks = { low: 70, mid: 72, high: 74 };
    const tall = estimateLevel(answers(), { ...athlete, heightIn: 76 }, benchmarks);
    const short = estimateLevel(answers(), { ...athlete, heightIn: 68 }, benchmarks);
    expect(tall.level).toBeGreaterThan(short.level);
  });
});

describe("recommend", () => {
  const schools = [school(0.15), school(0.3), school(0.45), school(0.6, 1), school(0.75, 3), school(0.9, 5)];
  const levels = programLevels(schools);

  it("sorts schools into reach, target and likely around her level", () => {
    const estimate = estimateLevel(answers(), athlete, noHeights);
    const picks = recommend(schools, levels, estimate, answers(), athlete);
    for (const p of picks) {
      const diff = p.level - estimate.level;
      if (p.tier === "reach") expect(diff).toBeGreaterThan(0.35);
      if (p.tier === "likely") expect(diff).toBeLessThan(-0.35);
      if (p.tier === "target") expect(Math.abs(diff)).toBeLessThanOrEqual(0.35);
      expect(p.reasons.length).toBeGreaterThan(0);
    }
    expect(picks.some((p) => p.tier === "target")).toBe(true);
  });

  it("leaves out schools beyond her distance limit", () => {
    const far = school(0.5, 0, { latitude: 34.05, longitude: -118.24 }); // Los Angeles
    const all = [...schools, far];
    const lv = programLevels(all);
    const estimate = estimateLevel(answers(), athlete, noHeights);
    const near = recommend(all, lv, estimate, answers({ maxDistance: "600" }), athlete);
    expect(near.some((p) => p.school.id === far.id)).toBe(false);
    const anywhere = recommend(all, lv, estimate, answers({ maxDistance: "0" }), athlete);
    expect(anywhere.some((p) => p.school.id === far.id)).toBe(true);
  });
});

describe("weightsFromAnswers", () => {
  it("turns priorities into Compare weights", () => {
    const w = weightsFromAnswers(answers({ wantPlayingTime: "3", wantCost: "0", maxDistance: "250" }));
    expect(w.opportunity).toBe(5);
    expect(w.cost).toBe(1);
    expect(w.distance).toBe(4);
  });
});
