import { describe, expect, it } from "vitest";
import { ageAdjusted, ageYears, collegeMeasurables, elitePeer, heightAtZ, heightZ, jumpFactor, percentile, projectHeightCm } from "./development";

describe("ageYears", () => {
  it("uses birth month and year when known", () => {
    expect(ageYears(new Date("2026-11-02"), 2030, { year: 2012, month: 3 })).toBeCloseTo(14.63, 1);
  });
  it("estimates from graduation year otherwise", () => {
    expect(ageYears(new Date("2026-11-02"), 2030)).toBeCloseTo(14.67, 1);
  });
});

describe("CDC height", () => {
  it("matches the published median and percentiles", () => {
    // CDC girls, 168.5 months (statage.csv): median 160.48 cm; 97th percentile 172.88 cm.
    expect(heightAtZ(0, 14.0417)).toBeCloseTo(160.48, 1);
    expect(heightAtZ(1.8808, 14.0417)).toBeCloseTo(172.88, 1);
    expect(heightZ(heightAtZ(1.2, 15), 15)).toBeCloseTo(1.2, 5);
  });
  it("gives a 6'0\" 14-year-old a small, uncertain amount of growth left", () => {
    const r = projectHeightCm(182.88, 14);
    expect(r.mid - 182.88).toBeGreaterThan(1);
    expect(r.mid - 182.88).toBeLessThan(5);
    expect(r.low).toBeLessThan(r.mid);
    expect(r.high).toBeGreaterThan(r.mid);
    expect(projectHeightCm(175, 18.5)).toEqual({ low: 175, mid: 175, high: 175 });
  });
});

describe("percentile", () => {
  it("is the normal CDF", () => {
    expect(percentile(0)).toBe(50);
    expect(percentile(1)).toBeCloseTo(84.1, 0);
    expect(percentile(-1.96)).toBeCloseTo(2.5, 0);
  });
});

describe("jump development", () => {
  it("adds less each year as girls get older (Grbić 2026)", () => {
    expect(jumpFactor(18)).toBe(1);
    expect(jumpFactor(12)).toBeGreaterThan(jumpFactor(14));
    expect(jumpFactor(14)).toBeCloseTo(26.67 / 25.25, 3);
  });
});

describe("elite peers", () => {
  it("reproduces the Greek junior national pool's approach jump at 14.4", () => {
    const p = elitePeer(14.4, "OH");
    expect(p.approach[0] - p.reach[0]).toBeCloseTo(49.5, 1);
  });
  it("makes older elite peers taller and higher-touching", () => {
    const a = elitePeer(14, "MB");
    const b = elitePeer(17, "MB");
    expect(b.height[0]).toBeGreaterThan(a.height[0]);
    expect(b.approach[0]).toBeGreaterThan(a.approach[0]);
  });
});

describe("ageAdjusted", () => {
  // The athlete in the screenshots: 14, middle, 6'0", 7'9" reach, 9'2" block, 9'11.5" approach.
  const views = ageAdjusted({ heightIn: 72, standingReachIn: 93, blockTouchIn: 110, approachTouchIn: 119.5 }, 14, "MB");
  const get = (k: string) => views.find((v) => v.key === k)!;
  it("places a 6'0\" 14-year-old middle well above elite peers her age", () => {
    expect(get("height").cdcPct).toBeGreaterThan(99);
    expect(get("height").elitePct).toBeGreaterThan(70);
    expect(get("approach").elitePct).toBeGreaterThan(80);
  });
  it("projects every measurable up, as a range", () => {
    for (const v of views) {
      expect(v.projectedIn.mid).toBeGreaterThan(v.nowIn);
      expect(v.projectedIn.low).toBeLessThanOrEqual(v.projectedIn.mid);
      expect(v.projectedIn.high).toBeGreaterThanOrEqual(v.projectedIn.mid);
    }
    // Approach touch: about +2" from growth and jump by 18.
    expect(get("approach").projectedIn.mid - 119.5).toBeGreaterThan(1);
    expect(get("approach").projectedIn.mid - 119.5).toBeLessThan(5);
  });
  it("estimates reach from height when it wasn't measured, and skips unmeasured touches", () => {
    const v = ageAdjusted({ heightIn: 70, standingReachIn: null, blockTouchIn: null, approachTouchIn: null }, 15, "OH");
    expect(v.map((x) => x.key)).toEqual(["height", "reach"]);
    expect(v[1].estimated).toBe(true);
    expect(v[1].nowIn).toBeCloseTo(91, 0);
  });
});

describe("collegeMeasurables", () => {
  it("builds touches from height", () => {
    const c = collegeMeasurables(74, "MB");
    expect(c.reach).toBeCloseTo(96.2, 0);
    expect(c.approach - c.reach).toBeCloseTo(20.6, 0);
    expect(c.block - c.reach).toBeCloseTo(18, 0);
  });
});
