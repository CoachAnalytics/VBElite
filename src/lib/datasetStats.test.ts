import { describe, expect, it } from "vitest";
import { ageGroup, coverage } from "./datasetStats";

describe("ageGroup", () => {
  it("maps age to the club age group she plays in", () => {
    expect(ageGroup(13.4)).toBe("14U");
    expect(ageGroup(14.0)).toBe("15U");
    expect(ageGroup(10)).toBe("12U");
    expect(ageGroup(19)).toBe("18U");
  });
});

describe("coverage", () => {
  it("counts each athlete once per position and age group", () => {
    const c = coverage([
      { athlete: "A1", position: "MB", ageYears: 13.2 },
      { athlete: "A1", position: "MB", ageYears: 13.7 },
      { athlete: "A2", position: "MB", ageYears: 13.9 },
      { athlete: "A1", position: "MB", ageYears: 14.3 },
    ]);
    expect(c("MB", "14U")).toBe(2);
    expect(c("MB", "15U")).toBe(1);
    expect(c("OH", "14U")).toBe(0);
  });
});
