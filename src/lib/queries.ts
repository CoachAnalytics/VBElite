import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, type SQL } from "drizzle-orm";
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

/** The athlete's recruiting log with school names, newest first. */
export async function getRecruitingEvents(athleteId: number) {
  return db
    .select({
      id: schema.recruitingEvents.id,
      schoolId: schema.recruitingEvents.schoolId,
      type: schema.recruitingEvents.type,
      date: schema.recruitingEvents.date,
      coachName: schema.recruitingEvents.coachName,
      note: schema.recruitingEvents.note,
      schoolName: schema.schools.name,
      schoolSlug: schema.schools.slug,
    })
    .from(schema.recruitingEvents)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.recruitingEvents.schoolId))
    .where(eq(schema.recruitingEvents.athleteId, athleteId))
    .orderBy(desc(schema.recruitingEvents.date), desc(schema.recruitingEvents.id));
}

/** Every school's id and name, for the log's school picker. */
export async function schoolNames() {
  return db.select({ id: schema.schools.id, name: schema.schools.name }).from(schema.schools).orderBy(asc(schema.schools.name));
}

/** Volleyball staff a recruit can contact at one school, in display order. */
export async function getSchoolContacts(schoolId: number) {
  return db
    .select()
    .from(schema.schoolContacts)
    .where(eq(schema.schoolContacts.schoolId, schoolId))
    .orderBy(asc(schema.schoolContacts.sortOrder));
}

/** Emails families added for one school that this user may see: approved ones, plus their own. */
export async function getContactSubmissions(schoolId: number, userId: number) {
  const rows = await db
    .select()
    .from(schema.contactSubmissions)
    .where(
      and(
        eq(schema.contactSubmissions.schoolId, schoolId),
        or(eq(schema.contactSubmissions.status, "approved"), eq(schema.contactSubmissions.userId, userId)),
      ),
    )
    .orderBy(asc(schema.contactSubmissions.createdAt));
  return rows.map((r) => ({ ...r, mine: r.userId === userId }));
}

/** Families' coach emails waiting for an admin, with what's needed to judge them. */
export async function pendingContactSubmissions() {
  return db
    .select({
      id: schema.contactSubmissions.id,
      name: schema.contactSubmissions.name,
      title: schema.contactSubmissions.title,
      role: schema.contactSubmissions.role,
      email: schema.contactSubmissions.email,
      source: schema.contactSubmissions.source,
      createdAt: schema.contactSubmissions.createdAt,
      schoolName: schema.schools.name,
      schoolSlug: schema.schools.slug,
      website: schema.schools.website,
      athleticsWebsite: schema.schools.athleticsWebsite,
      submittedBy: schema.users.email,
    })
    .from(schema.contactSubmissions)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.contactSubmissions.schoolId))
    .innerJoin(schema.users, eq(schema.users.id, schema.contactSubmissions.userId))
    .where(eq(schema.contactSubmissions.status, "pending"))
    .orderBy(asc(schema.contactSubmissions.createdAt));
}

/** Listed heights (inches) of every D1 commit at a position, all classes: U.S. elite peers. */
export async function commitHeights(position: string): Promise<number[]> {
  const rows = await db
    .select({ heightIn: schema.commits.heightIn })
    .from(schema.commits)
    .where(eq(schema.commits.primaryPosition, position));
  return rows.map((r) => r.heightIn).filter((h): h is number => h != null && h >= 60 && h <= 84);
}

/** When her measurables were last recorded (any source). */
export async function lastMeasuredAt(athleteId: number): Promise<Date | null> {
  const [row] = await db
    .select({ at: schema.athleteMeasurements.measuredAt })
    .from(schema.athleteMeasurements)
    .where(eq(schema.athleteMeasurements.athleteId, athleteId))
    .orderBy(desc(schema.athleteMeasurements.measuredAt))
    .limit(1);
  return row?.at ?? null;
}

/**
 * VB Elite's own dataset (athletes who haven't opted out), without names or contact details: every
 * measurement snapshot and every offer/commitment snapshot.
 */
export async function researchDataset() {
  const consented = eq(schema.athletes.researchConsent, true);
  const [measurements, outcomes, seasons] = await Promise.all([
    db
      .select({
        athleteId: schema.athleteMeasurements.athleteId,
        measuredAt: schema.athleteMeasurements.measuredAt,
        ageYears: schema.athleteMeasurements.ageYears,
        ageExact: schema.athleteMeasurements.ageExact,
        position: schema.athleteMeasurements.position,
        gradYear: schema.athletes.gradYear,
        heightIn: schema.athleteMeasurements.heightIn,
        standingReachIn: schema.athleteMeasurements.standingReachIn,
        blockTouchIn: schema.athleteMeasurements.blockTouchIn,
        approachTouchIn: schema.athleteMeasurements.approachTouchIn,
        source: schema.athleteMeasurements.source,
      })
      .from(schema.athleteMeasurements)
      .innerJoin(schema.athletes, eq(schema.athletes.id, schema.athleteMeasurements.athleteId))
      .where(consented)
      .orderBy(asc(schema.athleteMeasurements.measuredAt)),
    db
      .select({
        athleteId: schema.recruitingOutcomes.athleteId,
        type: schema.recruitingOutcomes.type,
        occurredAt: schema.recruitingOutcomes.occurredAt,
        school: schema.schools.name,
        conference: schema.recruitingOutcomes.conference,
        programLevel: schema.recruitingOutcomes.programLevel,
        gradYear: schema.recruitingOutcomes.gradYear,
        position: schema.recruitingOutcomes.position,
        ageYears: schema.recruitingOutcomes.ageYears,
        ageExact: schema.recruitingOutcomes.ageExact,
        heightIn: schema.recruitingOutcomes.heightIn,
        standingReachIn: schema.recruitingOutcomes.standingReachIn,
        blockTouchIn: schema.recruitingOutcomes.blockTouchIn,
        approachTouchIn: schema.recruitingOutcomes.approachTouchIn,
        measuredAt: schema.recruitingOutcomes.measuredAt,
        clubDivision: schema.recruitingOutcomes.clubDivision,
        clubRole: schema.recruitingOutcomes.clubRole,
        coachProjection: schema.recruitingOutcomes.coachProjection,
        stats: schema.recruitingOutcomes.stats,
      })
      .from(schema.recruitingOutcomes)
      .innerJoin(schema.athletes, eq(schema.athletes.id, schema.recruitingOutcomes.athleteId))
      .innerJoin(schema.schools, eq(schema.schools.id, schema.recruitingOutcomes.schoolId))
      .where(consented)
      .orderBy(asc(schema.recruitingOutcomes.occurredAt)),
    db
      .select({
        athleteId: schema.athleteSeasons.athleteId,
        season: schema.athleteSeasons.season,
        level: schema.athleteSeasons.level,
        position: schema.athleteSeasons.position,
        gradYear: schema.athletes.gradYear,
        matches: schema.athleteSeasons.matches,
        sets: schema.athleteSeasons.sets,
        kills: schema.athleteSeasons.kills,
        attackErrors: schema.athleteSeasons.attackErrors,
        attempts: schema.athleteSeasons.attempts,
        assists: schema.athleteSeasons.assists,
        aces: schema.athleteSeasons.aces,
        serveErrors: schema.athleteSeasons.serveErrors,
        digs: schema.athleteSeasons.digs,
        receptions: schema.athleteSeasons.receptions,
        receptionErrors: schema.athleteSeasons.receptionErrors,
        soloBlocks: schema.athleteSeasons.soloBlocks,
        blockAssists: schema.athleteSeasons.blockAssists,
        source: schema.athleteSeasons.source,
      })
      .from(schema.athleteSeasons)
      .innerJoin(schema.athletes, eq(schema.athletes.id, schema.athleteSeasons.athleteId))
      .where(consented)
      .orderBy(asc(schema.athleteSeasons.season)),
  ]);
  // Replace database ids with per-export pseudonyms so rows from one athlete still link up.
  const alias = new Map<number, string>();
  const pseudo = (id: number) => alias.get(id) ?? (alias.set(id, `A${alias.size + 1}`), alias.get(id)!);
  return {
    measurements: measurements.map(({ athleteId, ...r }) => ({ athlete: pseudo(athleteId), ...r })),
    outcomes: outcomes.map(({ athleteId, ...r }) => ({ athlete: pseudo(athleteId), ...r })),
    seasons: seasons.map(({ athleteId, ...r }) => ({ athlete: pseudo(athleteId), ...r })),
  };
}

/** Her seasons of stats, newest first. */
export async function getSeasons(athleteId: number) {
  return db
    .select()
    .from(schema.athleteSeasons)
    .where(eq(schema.athleteSeasons.athleteId, athleteId))
    .orderBy(desc(schema.athleteSeasons.season), asc(schema.athleteSeasons.level));
}

/**
 * Seasons from other athletes (not opted out) at a position and team level, with each one's
 * graduation year so callers can match grade: the peer group for stat comparisons.
 */
export async function seasonPeers(position: string, level: string, excludeAthleteId: number) {
  return db
    .select({ season: schema.athleteSeasons, gradYear: schema.athletes.gradYear })
    .from(schema.athleteSeasons)
    .innerJoin(schema.athletes, eq(schema.athletes.id, schema.athleteSeasons.athleteId))
    .where(
      and(
        eq(schema.athleteSeasons.position, position),
        eq(schema.athleteSeasons.level, level),
        eq(schema.athletes.researchConsent, true),
        ne(schema.athleteSeasons.athleteId, excludeAthleteId),
      ),
    );
}
