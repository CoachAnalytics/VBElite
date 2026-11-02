import { describe, expect, it } from "vitest";
import { programSummary } from "./analytics";
import { eventSchema, interestLevel, schoolStatuses, similarSchools } from "./recruiting";
import type { SchoolInfo } from "./recommend";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const school = (id: number, over: Partial<SchoolInfo> = {}): SchoolInfo => ({
  id,
  slug: `s${id}`,
  name: `School ${id}`,
  conference: "A",
  city: null,
  state: "OH",
  control: "public",
  enrollment: 10000,
  latitude: null,
  longitude: null,
  admissionRate: null,
  satAvg: 1200,
  tuitionInState: null,
  tuitionOutState: null,
  avgNetPrice: null,
  program: programSummary([]),
  positionCovered: true,
  incomingAtPosition: 0,
  ...over,
});

describe("eventSchema", () => {
  it("needs a school, a type and a date", () => {
    expect(eventSchema.safeParse({ schoolId: "3", type: "offer", date: "2026-11-01", coachName: "", note: "" }).success).toBe(true);
    expect(eventSchema.safeParse({ schoolId: "", type: "offer", date: "2026-11-01", coachName: "", note: "" }).success).toBe(false);
    expect(eventSchema.safeParse({ schoolId: "3", type: "maybe", date: "2026-11-01", coachName: "", note: "" }).success).toBe(false);
  });
});

describe("schoolStatuses", () => {
  it("keeps each school's furthest step, newest activity first among equals", () => {
    const st = schoolStatuses([
      { schoolId: 1, type: "emailed", date: d("2026-09-01") },
      { schoolId: 1, type: "camp", date: d("2026-09-10") },
      { schoolId: 1, type: "replied", date: d("2026-09-20") },
      { schoolId: 2, type: "emailed", date: d("2026-10-01") },
      { schoolId: 3, type: "offer", date: d("2026-10-05") },
    ]);
    expect(st.map((s) => [s.schoolId, s.type])).toEqual([[3, "offer"], [1, "camp"], [2, "emailed"]]);
    expect(st.find((s) => s.schoolId === 1)!.lastDate).toEqual(d("2026-09-20"));
  });

  it("closes a school out when the coach's last word is no", () => {
    const [s] = schoolStatuses([
      { schoolId: 1, type: "camp", date: d("2026-09-01") },
      { schoolId: 1, type: "declined", date: d("2026-10-01") },
    ]);
    expect(s.declined).toBe(true);
    expect(s.stage).toBe(0);
  });
});

describe("similarSchools", () => {
  const schools = [
    school(1, { conference: "A" }),
    school(2, { conference: "A" }), // same conference, same level as 1
    school(3, { conference: "B", state: "CA" }), // far away in level
    school(4, { conference: "C", state: "OH" }), // same region, near level
  ];
  const levels = new Map([[1, 2.0], [2, 2.05], [3, 3.0], [4, 2.1]]);

  it("suggests schools like the ones showing interest, not ones already logged", () => {
    const st = schoolStatuses([{ schoolId: 1, type: "camp", date: d("2026-10-01") }]);
    const out = similarSchools(st, schools, levels);
    expect(out.map((r) => r.school.id)).toEqual([2, 4]);
    expect(out[0].reasons[0]).toMatch(/Like School 1 \(camp invite\).*same conference/);
  });

  it("ignores schools she only emailed", () => {
    const st = schoolStatuses([{ schoolId: 1, type: "emailed", date: d("2026-10-01") }]);
    expect(similarSchools(st, schools, levels)).toEqual([]);
  });
});

describe("interestLevel", () => {
  it("uses the best program that offered or hosted an official visit", () => {
    const levels = new Map([[1, 2.0], [2, 2.6], [3, 2.9]]);
    const st = schoolStatuses([
      { schoolId: 1, type: "offer", date: d("2026-10-01") },
      { schoolId: 2, type: "official", date: d("2026-10-02") },
      { schoolId: 3, type: "camp", date: d("2026-10-03") },
    ]);
    expect(interestLevel(st, levels)).toEqual({ level: 2.6, schoolId: 2, type: "official" });
    expect(interestLevel(schoolStatuses([{ schoolId: 3, type: "camp", date: d("2026-10-03") }]), levels)).toBeNull();
  });
});
