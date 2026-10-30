import { eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SchoolSeed } from "@/db/seed-types";
import { lookupCity } from "@/lib/geo";
import { isPosition, normalizePositions } from "@/lib/positions";

function positionsOf(raw: string | null, fallback: string | null, primary?: string | null) {
  const list = normalizePositions(raw);
  if (primary && isPosition(primary)) {
    // Put the curated primary position first, keeping the rest as secondary.
    list.splice(0, list.length, primary, ...list.filter((p) => p !== primary));
  }
  // Rows collected for a single-position tab (e.g. the spreadsheet's "OH Roster") with no
  // listed position belong to that position. Otherwise an unreadable position stays unknown.
  if (!list.length && fallback) list.push(fallback as never);
  return { positions: list.join("/"), primaryPosition: list[0] ?? "?" };
}

export type LoadSummary = {
  schools: number;
  seasons: number;
  roster: number;
  commits: number;
  missingGeo: string[];
};

/**
 * Upserts schools by slug and replaces each one's seasons, roster and commits.
 * Each school is written in its own transaction, so a failure never leaves a
 * school half-updated.
 */
export async function loadSchools(seeds: SchoolSeed[]): Promise<LoadSummary> {
  const summary: LoadSummary = { schools: 0, seasons: 0, roster: 0, commits: 0, missingGeo: [] };

  for (const s of seeds) {
    let { latitude, longitude } = s;
    if ((latitude == null || longitude == null) && s.city && s.state) {
      const place = lookupCity(s.city, s.state);
      latitude = place?.latitude ?? null;
      longitude = place?.longitude ?? null;
    }
    if (latitude == null) summary.missingGeo.push(s.name);

    const values = {
      slug: s.slug,
      name: s.name,
      ncaaOrgId: s.ncaaOrgId ?? null,
      scorecardUnitId: s.scorecardUnitId ?? null,
      officialName: s.officialName ?? null,
      team: s.team ?? null,
      website: s.website ?? null,
      athleticsWebsite: s.athleticsWebsite ?? null,
      admissionRate: s.admissionRate ?? null,
      satAvg: s.satAvg ?? null,
      act25: s.act25 ?? null,
      act75: s.act75 ?? null,
      costOfAttendance: s.costOfAttendance ?? null,
      avgNetPrice: s.avgNetPrice ?? null,
      graduationRate: s.graduationRate ?? null,
      retentionRate: s.retentionRate ?? null,
      medianEarnings: s.medianEarnings ?? null,
      studentFacultyRatio: s.studentFacultyRatio ?? null,
      researchedAt: s.researchedAt ? new Date(s.researchedAt) : null,
      sources: s.sources?.length ? JSON.stringify(s.sources) : null,
      city: s.city,
      state: s.state,
      latitude,
      longitude,
      division: s.division,
      conference: s.conference,
      control: s.control,
      enrollment: s.enrollment,
      enrollmentNote: s.enrollmentNote,
      tuitionInState: s.tuitionInState,
      tuitionOutState: s.tuitionOutState,
      tuitionYear: s.tuitionYear,
      headCoach: s.headCoach,
      coachSince: s.coachSince,
      apr: s.apr,
      aprNote: s.aprNote,
      rosterSize: s.rosterSize,
      rosterSeason: s.rosterSeason,
      positionsCovered: s.positionsCovered.join(","),
      commitDataQuality: s.commitDataQuality,
      recruitingNote: s.recruitingNote,
      programNote: s.programNote,
      updatedAt: new Date(),
    };
    const fallback = s.positionsCovered.length === 1 ? s.positionsCovered[0] : null;

    await db.transaction(async (tx) => {
      // Match an existing school by NCAA id (stable) or slug (older spreadsheet imports).
      const [existing] = await tx
        .select({ id: schema.schools.id })
        .from(schema.schools)
        .where(
          values.ncaaOrgId != null
            ? or(eq(schema.schools.ncaaOrgId, values.ncaaOrgId), eq(schema.schools.slug, values.slug))
            : eq(schema.schools.slug, values.slug),
        )
        .limit(1);
      let schoolId: number;
      if (existing) {
        await tx.update(schema.schools).set(values).where(eq(schema.schools.id, existing.id));
        schoolId = existing.id;
      } else {
        const [row] = await tx.insert(schema.schools).values(values).returning({ id: schema.schools.id });
        schoolId = row.id;
      }

      await tx.delete(schema.seasons).where(eq(schema.seasons.schoolId, schoolId));
      await tx.delete(schema.rosterPlayers).where(eq(schema.rosterPlayers.schoolId, schoolId));
      await tx.delete(schema.commits).where(eq(schema.commits.schoolId, schoolId));

      if (s.seasons.length) {
        await tx.insert(schema.seasons).values(s.seasons.map((x) => ({ ...x, ncaaSeed: x.ncaaSeed ?? null, schoolId })));
      }
      if (s.roster.length) {
        await tx.insert(schema.rosterPlayers).values(
          s.roster.map((p) => ({
            ...p,
            schoolId,
            season: s.rosterSeason ?? new Date().getFullYear(),
            ...positionsOf(p.positionRaw, fallback),
          })),
        );
      }
      if (s.commits.length) {
        await tx.insert(schema.commits).values(
          s.commits.map(({ primaryPosition, ...c }) => ({
            ...c,
            schoolId,
            ...positionsOf(c.positionRaw, fallback, primaryPosition),
          })),
        );
      }
    });

    summary.schools++;
    summary.seasons += s.seasons.length;
    summary.roster += s.roster.length;
    summary.commits += s.commits.length;
  }
  return summary;
}
