import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Athlete } from "@/db/schema";
import { ageYears } from "./development";
import { parseAnswers } from "./questionnaire";
import { programLevels } from "./recommend";
import { latestConfirmation } from "./coachLinks";
import { getRecommendationData } from "./queries";

/** Her measurables now: height from her profile, reach and touches from the questionnaire. */
export function currentMeasurables(a: Athlete) {
  const q = parseAnswers(a.questionnaire);
  return {
    heightIn: a.heightIn,
    standingReachIn: q?.standingReach ?? null,
    blockTouchIn: q?.blockTouch ?? null,
    approachTouchIn: q?.approachTouch ?? null,
  };
}

function age(a: Athlete, at: Date) {
  const birth = a.birthYear && a.birthMonth ? { year: a.birthYear, month: a.birthMonth } : null;
  return { ageYears: ageYears(at, a.gradYear, birth), ageExact: !!birth };
}

/**
 * Adds a dated snapshot of her measurables when any of them changed since the last one.
 * `override` lets a coach's confirmation supply her height.
 */
export async function recordMeasurement(athleteId: number, source: "profile" | "questionnaire" | "coach", override: { heightIn?: number | null } = {}) {
  const [a] = await db.select().from(schema.athletes).where(eq(schema.athletes.id, athleteId));
  if (!a) return;
  const m = { ...currentMeasurables(a), ...(override.heightIn != null && { heightIn: override.heightIn }) };
  if (m.heightIn == null && m.standingReachIn == null && m.blockTouchIn == null && m.approachTouchIn == null) return;
  const [last] = await db
    .select()
    .from(schema.athleteMeasurements)
    .where(eq(schema.athleteMeasurements.athleteId, athleteId))
    .orderBy(desc(schema.athleteMeasurements.measuredAt))
    .limit(1);
  const same =
    last &&
    last.heightIn === m.heightIn &&
    last.standingReachIn === m.standingReachIn &&
    last.blockTouchIn === m.blockTouchIn &&
    last.approachTouchIn === m.approachTouchIn &&
    last.position === a.position;
  if (same) return;
  const now = new Date();
  await db.insert(schema.athleteMeasurements).values({ athleteId, measuredAt: now, ...age(a, now), position: a.position, ...m, source });
}

/** Freezes who she was when an offer or commitment came: measurables, age, club level, program level. */
export async function recordOutcome(athleteId: number, event: { id: number; schoolId: number; type: string; date: Date }) {
  if (event.type !== "offer" && event.type !== "committed") return;
  const [a] = await db.select().from(schema.athletes).where(eq(schema.athletes.id, athleteId));
  if (!a) return;
  const [{ schools }, confirmation, [lastMeasured], seasons] = await Promise.all([
    getRecommendationData(a.position, a.gradYear),
    latestConfirmation(a.id),
    db
      .select({ measuredAt: schema.athleteMeasurements.measuredAt })
      .from(schema.athleteMeasurements)
      .where(eq(schema.athleteMeasurements.athleteId, athleteId))
      .orderBy(desc(schema.athleteMeasurements.measuredAt))
      .limit(1),
    db.select().from(schema.athleteSeasons).where(eq(schema.athleteSeasons.athleteId, athleteId)),
  ]);
  const latest = latestSeason(seasons);
  const school = schools.find((s) => s.id === event.schoolId);
  const q = parseAnswers(a.questionnaire);
  await db
    .insert(schema.recruitingOutcomes)
    .values({
      athleteId,
      eventId: event.id,
      schoolId: event.schoolId,
      type: event.type,
      occurredAt: event.date,
      gradYear: a.gradYear,
      position: a.position,
      ...age(a, event.date),
      ...currentMeasurables(a),
      ...(confirmation?.heightIn != null && { heightIn: confirmation.heightIn }),
      measuredAt: lastMeasured?.measuredAt ?? a.heightUpdatedAt ?? null,
      programLevel: programLevels(schools).get(event.schoolId) ?? null,
      conference: school?.conference ?? null,
      clubDivision: q?.clubDivision ?? null,
      clubRole: confirmation?.role ?? q?.clubRole ?? null,
      coachProjection: confirmation?.level ?? q?.coachProjection ?? null,
      stats: latest ? JSON.stringify(Object.fromEntries(Object.entries(latest).filter(([k]) => !["id", "athleteId", "updatedAt"].includes(k)))) : null,
    })
    .onConflictDoNothing();
}

const LEVEL_RANK: Record<string, number> = { varsity: 0, club: 1, jv: 2, freshman: 3 };

/** Her most recent season, preferring high school varsity, then club, within that season. */
export function latestSeason<T extends { season: number; level: string }>(seasons: T[]): T | null {
  return [...seasons].sort((a, b) => b.season - a.season || (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9))[0] ?? null;
}
