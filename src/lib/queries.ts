import "server-only";
import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AthleteInput, SchoolBundle } from "./analytics";
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

export type SchoolFilters = { q?: string; division?: string; state?: string; conference?: string };

export async function listSchools(f: SchoolFilters) {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(ilike(schema.schools.name, like), ilike(schema.schools.city, like))!);
  }
  if (f.division) where.push(eq(schema.schools.division, f.division));
  if (f.state) where.push(eq(schema.schools.state, f.state));
  if (f.conference) where.push(eq(schema.schools.conference, f.conference));
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
