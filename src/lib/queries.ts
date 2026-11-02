import "server-only";
import { and, asc, count, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { redirect } from "next/navigation";
import { programSummary, type AthleteInput, type SchoolBundle } from "./analytics";
import { requireUser } from "./auth";
import type { SchoolInfo } from "./recommend";
import type { Athlete } from "@/db/schema";

export async function getAthlete(userId: number): Promise<Athlete | null> {
  const [a] = await db.select().from(schema.athletes).where(eq(schema.athletes.userId, userId)).limit(1);
  return a ?? null;
}

export function athleteInput(a: Athlete): AthleteInput {
  return {
    gradYear: a.gradYear,
    position: a.position,
    heightIn: a.heightIn,
    homeState: a.homeState,
    latitude: a.latitude,
    longitude: a.longitude,
  };
}

export async function getSavedSchools(athleteId: number) {
  return db
    .select({ schoolId: schema.savedSchools.schoolId, tier: schema.savedSchools.tier })
    .from(schema.savedSchools)
    .where(eq(schema.savedSchools.athleteId, athleteId));
}

export type SchoolFilters = { q?: string; division?: string; state?: string; conference?: string; control?: string };

export async function listSchools(f: SchoolFilters) {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(ilike(schema.schools.name, like), ilike(schema.schools.city, like))!);
  }
  if (f.division) where.push(eq(schema.schools.division, f.division));
  if (f.state) where.push(eq(schema.schools.state, f.state));
  if (f.conference) where.push(eq(schema.schools.conference, f.conference));
  if (f.control) where.push(eq(schema.schools.control, f.control));
  const schools = await db
    .select()
    .from(schema.schools)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(schema.schools.name));
  const ids = schools.map((s) => s.id);
  const seasons = ids.length
    ? await db.select().from(schema.seasons).where(inArray(schema.seasons.schoolId, ids))
    : [];
  return schools.map((school) => ({ school, seasons: seasons.filter((s) => s.schoolId === school.id) }));
}

export async function filterOptions() {
  const rows = await db
    .select({ state: schema.schools.state, conference: schema.schools.conference, division: schema.schools.division })
    .from(schema.schools);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return {
    states: uniq(rows.map((r) => r.state)),
    conferences: uniq(rows.map((r) => r.conference)),
    divisions: uniq(rows.map((r) => r.division)),
  };
}

export async function getSchoolBundles(schoolIds: number[]): Promise<SchoolBundle[]> {
  if (!schoolIds.length) return [];
  const [schools, seasons, roster, commits] = await Promise.all([
    db.select().from(schema.schools).where(inArray(schema.schools.id, schoolIds)),
    db.select().from(schema.seasons).where(inArray(schema.seasons.schoolId, schoolIds)),
    db.select().from(schema.rosterPlayers).where(inArray(schema.rosterPlayers.schoolId, schoolIds)),
    db.select().from(schema.commits).where(inArray(schema.commits.schoolId, schoolIds)),
  ]);
  return schools.map((school) => ({
    school,
    seasons: seasons.filter((s) => s.schoolId === school.id),
    roster: roster.filter((p) => p.schoolId === school.id),
    commits: commits.filter((c) => c.schoolId === school.id),
  }));
}

export async function getSchoolBundleBySlug(slug: string): Promise<SchoolBundle | null> {
  const [s] = await db.select({ id: schema.schools.id }).from(schema.schools).where(eq(schema.schools.slug, slug));
  if (!s) return null;
  const [bundle] = await getSchoolBundles([s.id]);
  return bundle ?? null;
}

/** Players and commits (classes `from`–`to`) whose main position is `position`, per school. */
export async function positionCounts(position: string, from: number, to: number) {
  const [roster, commits] = await Promise.all([
    db
      .select({ schoolId: schema.rosterPlayers.schoolId, n: count() })
      .from(schema.rosterPlayers)
      .where(eq(schema.rosterPlayers.primaryPosition, position))
      .groupBy(schema.rosterPlayers.schoolId),
    db
      .select({ schoolId: schema.commits.schoolId, n: count() })
      .from(schema.commits)
      .where(and(eq(schema.commits.primaryPosition, position), gte(schema.commits.gradYear, from), lte(schema.commits.gradYear, to)))
      .groupBy(schema.commits.schoolId),
  ]);
  return {
    roster: new Map(roster.map((r) => [r.schoolId, r.n])),
    incoming: new Map(commits.map((r) => [r.schoolId, r.n])),
  };
}

/**
 * Every school summarized for the recommender, plus heights of players at `position`
 * (for the level benchmarks). Commits counted are those at the position in the classes
 * ahead of and with the athlete.
 */
export async function getRecommendationData(position: string, gradYear: number) {
  const [schools, seasons, players, commits] = await Promise.all([
    db.select().from(schema.schools),
    db.select().from(schema.seasons),
    db
      .select({ schoolId: schema.rosterPlayers.schoolId, heightIn: schema.rosterPlayers.heightIn })
      .from(schema.rosterPlayers)
      .where(eq(schema.rosterPlayers.primaryPosition, position)),
    db
      .select({ schoolId: schema.commits.schoolId, n: count() })
      .from(schema.commits)
      .where(
        and(
          eq(schema.commits.primaryPosition, position),
          gte(schema.commits.gradYear, gradYear - 3),
          lte(schema.commits.gradYear, gradYear),
        ),
      )
      .groupBy(schema.commits.schoolId),
  ]);
  const incoming = new Map(commits.map((c) => [c.schoolId, c.n]));
  const infos: SchoolInfo[] = schools.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    conference: s.conference,
    city: s.city,
    state: s.state,
    control: s.control,
    enrollment: s.enrollment,
    latitude: s.latitude,
    longitude: s.longitude,
    admissionRate: s.admissionRate,
    satAvg: s.satAvg,
    tuitionInState: s.tuitionInState,
    tuitionOutState: s.tuitionOutState,
    avgNetPrice: s.avgNetPrice,
    program: programSummary(seasons.filter((x) => x.schoolId === s.id)),
    positionCovered: s.positionsCovered.split(",").includes(position),
    incomingAtPosition: incoming.get(s.id) ?? 0,
  }));
  return { schools: infos, players };
}

/**
 * The signed-in user's athlete, sending them to the next onboarding step first:
 * the profile, then the starting-point questionnaire (required for everyone).
 */
export async function requireOnboarded() {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  if (!athlete) redirect("/profile");
  if (!athlete.questionnaireAt) redirect("/questionnaire");
  return { user, athlete };
}
