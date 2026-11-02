import { describe, expect, it } from "vitest";
import { gradeIn, hittingPct, normalizeMaxprepsUrl, parseStatsPaste, perSet, seasonLabel, statLine } from "./stats";

describe("normalizeMaxprepsUrl", () => {
  it("accepts MaxPreps athlete pages and drops extra parameters", () => {
    expect(normalizeMaxprepsUrl("https://www.maxpreps.com/oh/powell/some-school/athletes/first-last/?careerid=abc123&utm_source=x")).toBe(
      "https://www.maxpreps.com/oh/powell/some-school/athletes/first-last/?careerid=abc123",
    );
    expect(normalizeMaxprepsUrl("maxpreps.com/oh/x/y/athletes/z/")).toBe("https://www.maxpreps.com/oh/x/y/athletes/z/");
  });
  it("rejects other sites and non-athlete pages", () => {
    expect(normalizeMaxprepsUrl("https://evil.com/maxpreps.com/athletes/x")).toBeNull();
    expect(normalizeMaxprepsUrl("https://www.maxpreps.com/oh/powell/some-school/volleyball/")).toBeNull();
    expect(normalizeMaxprepsUrl("not a url at all")).toBeNull();
  });
});

describe("parseStatsPaste", () => {
  it("reads a tab-separated table copied from a web page", () => {
    const text = "Season\tMP\tSP\tK\tK/S\tKill %\tE\tTA\tHit %\n25-26 Varsity\t28\t96\t312\t3.25\t38.0\t75\t820\t.289";
    const [row] = parseStatsPaste(text);
    expect(row.label).toBe("25-26 Varsity");
    expect(row.values).toEqual({ matches: 28, sets: 96, kills: 312, attackErrors: 75, attempts: 820 });
  });

  it("joins several tables for the same seasons, and ignores other tables' error columns", () => {
    const text = [
      "Attacking",
      "Year  SP  K  E  TA  Hit %",
      "24-25  70  150  40  500  .220",
      "25-26  96  312  75  820  .289",
      "Serving",
      "Year  SP  Aces  A/S  SE",
      "24-25  70  20  .29  15",
      "25-26  96  41  .43  22",
      "Digs",
      "Year  SP  D  D/S  DE",
      "25-26  96  180  1.88  9",
      "Blocking",
      "Year  SP  BS  BA  TB  B/S  BE",
      "25-26  96  12  40  32  .33  6",
    ].join("\n");
    const rows = parseStatsPaste(text);
    expect(rows.map((r) => r.label)).toEqual(["24-25", "25-26"]);
    expect(rows[1].values).toEqual({ sets: 96, kills: 312, attackErrors: 75, attempts: 820, aces: 41, serveErrors: 22, digs: 180, soloBlocks: 12, blockAssists: 40 });
    expect(rows[0].values.attackErrors).toBe(40);
  });

  it("reads label: value lines", () => {
    const [row] = parseStatsPaste("Kills: 312\nDigs: 180\nSets Played: 96\nAces 41");
    expect(row.values).toEqual({ kills: 312, digs: 180, sets: 96, aces: 41 });
  });

  it("returns nothing for text without stats", () => {
    expect(parseStatsPaste("Quinn plays outside hitter for the Patriots.")).toEqual([]);
  });
});

describe("rates and summaries", () => {
  const s = { season: 2025, level: "varsity", sets: 96, kills: 312, attackErrors: 75, attempts: 820, digs: 180, aces: 41, soloBlocks: 12, blockAssists: 40 };
  it("computes hitting % and per-set rates (block assists count half)", () => {
    expect(hittingPct(s)).toBeCloseTo(0.289, 3);
    expect(perSet(s).kills).toBeCloseTo(3.25, 2);
    expect(perSet(s).blocks).toBeCloseTo(32 / 96, 3);
    expect(perSet({ kills: 10 }).kills).toBeNull();
  });
  it("writes a coach-friendly line for her position", () => {
    expect(statLine(s, "OH", 2027)).toBe("2025-26 varsity (Jr): 312 kills (3.25/set), .289 hitting, 180 digs (1.88/set), 41 aces (.43/set)");
    expect(statLine({ season: 2025, level: "club" }, "OH", 2027)).toBeNull();
  });
  it("labels seasons and grades", () => {
    expect(seasonLabel(2025)).toBe("2025-26");
    expect(gradeIn(2025, 2027)).toBe("Jr");
    expect(gradeIn(2026, 2030)).toBe("Fr");
    expect(gradeIn(2025, 2030)).toBe("8th");
    expect(gradeIn(2026, 2027)).toBe("Sr");
  });
});

import { peerRanks, PEER_MIN } from "./stats";

describe("peerRanks", () => {
  it("ranks her per-set rates once enough peers have entered stats", () => {
    const peers = Array.from({ length: PEER_MIN }, (_, i) => ({ sets: 100, kills: 100 + i * 20 }));
    const r = peerRanks({ sets: 100, kills: 300 }, peers);
    expect(r.kills.value).toBe(3);
    expect(r.kills.n).toBe(PEER_MIN);
    expect(r.kills.pct).toBe(55);
    expect(r.digs).toEqual({ value: null, pct: null, n: 0 });
    expect(peerRanks({ sets: 100, kills: 300 }, peers.slice(0, 5)).kills.pct).toBeNull();
  });
});
