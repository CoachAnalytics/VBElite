/**
 * The recruiting log: what happened with each school, how far each school has gone,
 * and schools similar to the ones showing interest. Pure functions, no database access.
 */
import { z } from "zod";
import { regionOf } from "./questionnaire";
import type { SchoolInfo } from "./recommend";

/** Event types in order of how strongly they show a coach's interest (`stage`). */
export const EVENT_TYPES = [
  { value: "emailed", label: "She emailed or messaged the coach", short: "Contacted", stage: 1 },
  { value: "replied", label: "Coach replied", short: "Coach replied", stage: 2 },
  { value: "camp", label: "Invited to a camp or clinic", short: "Camp invite", stage: 3 },
  { value: "call", label: "Phone or video call with a coach", short: "Call", stage: 3 },
  { value: "unofficial", label: "Unofficial visit", short: "Unofficial visit", stage: 4 },
  { value: "official", label: "Official visit", short: "Official visit", stage: 5 },
  { value: "offer", label: "Offer", short: "Offer", stage: 6 },
  { value: "committed", label: "Committed", short: "Committed", stage: 7 },
  { value: "declined", label: "Coach not interested / roster full", short: "Not interested", stage: 0 },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export const eventSchema = z.object({
  schoolId: z.coerce.number().int().positive({ message: "Choose a school from the list" }),
  type: z.enum(EVENT_TYPES.map((t) => t.value) as [EventType, ...EventType[]], { message: "Choose what happened" }),
  date: z.coerce.date({ message: "Enter a date" }),
  coachName: z.string().trim().max(80),
  note: z.string().trim().max(500),
});

export function eventInfo(type: string) {
  return EVENT_TYPES.find((t) => t.value === type) ?? EVENT_TYPES[0];
}

type Event = { schoolId: number; type: string; date: Date };

export type SchoolStatus = {
  schoolId: number;
  /** Furthest step reached (highest stage), unless the coach has since said no. */
  type: string;
  stage: number;
  lastDate: Date;
  events: number;
  declined: boolean;
};

/** Each school's furthest step. A "not interested" after everything else closes it out. */
export function schoolStatuses(events: Event[]): SchoolStatus[] {
  const bySchool = new Map<number, Event[]>();
  for (const e of events) bySchool.set(e.schoolId, [...(bySchool.get(e.schoolId) ?? []), e]);
  return [...bySchool.entries()]
    .map(([schoolId, list]) => {
      const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
      const last = sorted.at(-1)!;
      const declined = last.type === "declined";
      const best = sorted.reduce((b, e) => (eventInfo(e.type).stage >= eventInfo(b.type).stage ? e : b), sorted[0]);
      const top = declined ? last : best;
      return { schoolId, type: top.type, stage: declined ? 0 : eventInfo(top.type).stage, lastDate: last.date, events: list.length, declined };
    })
    .sort((a, b) => b.stage - a.stage || b.lastDate.getTime() - a.lastDate.getTime());
}

/** Interest worth learning from: a coach engaging, not just her reaching out. */
const INTEREST_WEIGHT: Record<number, number> = { 2: 0.5, 3: 1, 4: 2, 5: 3, 6: 4, 7: 4 };

export type SimilarSchool = { school: SchoolInfo; score: number; reasons: string[] };

/**
 * Schools like the ones showing her real interest (a reply or more): close in program
 * level, same conference or region, similar size and academics. Schools already in her
 * log are left out.
 */
export function similarSchools(
  statuses: SchoolStatus[],
  schools: SchoolInfo[],
  levels: Map<number, number>,
  limit = 10,
): SimilarSchool[] {
  const byId = new Map(schools.map((s) => [s.id, s]));
  const anchors = statuses
    .filter((s) => !s.declined && INTEREST_WEIGHT[s.stage])
    .map((s) => ({ school: byId.get(s.schoolId), weight: INTEREST_WEIGHT[s.stage], status: s }))
    .filter((a): a is { school: SchoolInfo; weight: number; status: SchoolStatus } => !!a.school && levels.has(a.school.id));
  if (!anchors.length) return [];
  const logged = new Set(statuses.map((s) => s.schoolId));

  const results = schools
    .filter((c) => !logged.has(c.id) && levels.has(c.id))
    .map((c) => {
      let total = 0;
      let weights = 0;
      let best = { sim: -1, anchor: anchors[0], why: [] as string[] };
      for (const a of anchors) {
        const why: string[] = [];
        const levelGap = Math.abs(levels.get(c.id)! - levels.get(a.school.id)!);
        let sim = Math.max(0, 1 - levelGap / 0.6);
        if (levelGap <= 0.2) why.push("a similar program level");
        if (c.conference && c.conference === a.school.conference) {
          sim += 0.35;
          why.push(`the same conference (${c.conference})`);
        } else if (regionOf(c.state) && regionOf(c.state) === regionOf(a.school.state)) {
          sim += 0.15;
          why.push("the same region");
        }
        if (c.enrollment && a.school.enrollment && Math.abs(Math.log(c.enrollment / a.school.enrollment)) < 0.4) {
          sim += 0.1;
          why.push("a similar size");
        }
        if (c.satAvg && a.school.satAvg && Math.abs(c.satAvg - a.school.satAvg) <= 80) {
          sim += 0.1;
          why.push("similar academics");
        }
        total += sim * a.weight;
        weights += a.weight;
        if (sim > best.sim) best = { sim, anchor: a, why };
      }
      const what = eventInfo(best.anchor.status.type).short.toLowerCase();
      const reasons = [
        `Like ${best.anchor.school.name} (${what})${best.why.length ? `: ${best.why.join(", ")}` : ""}.`,
      ];
      if (c.positionCovered) {
        reasons.push(
          c.incomingAtPosition === 0
            ? "No commits at her position yet in the classes ahead of her."
            : `${c.incomingAtPosition} commit${c.incomingAtPosition > 1 ? "s" : ""} at her position in the classes ahead of her.`,
        );
      }
      return { school: c, score: total / weights, reasons };
    })
    .filter((r) => r.score > 0.4)
    .sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * The strongest evidence of her level from real recruiting: the best program that has
 * offered or hosted her on an official visit. Null when there's none yet.
 */
export function interestLevel(statuses: SchoolStatus[], levels: Map<number, number>): { level: number; schoolId: number; type: string } | null {
  const strong = statuses
    .filter((s) => !s.declined && s.stage >= 5 && levels.has(s.schoolId))
    .map((s) => ({ level: levels.get(s.schoolId)!, schoolId: s.schoolId, type: s.type }))
    .sort((a, b) => b.level - a.level);
  return strong[0] ?? null;
}
