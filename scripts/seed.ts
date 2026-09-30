/**
 * Loads data/seed/schools.json into the database. Safe to re-run: schools are
 * upserted by slug and their seasons, roster and commits are replaced.
 *
 *   npm run db:seed            # school data only
 *   npm run db:seed -- --demo  # also create demo@vbelite.local / demo-password
 */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import type { SchoolSeed } from "../src/db/seed-types";
import { lookupCity, lookupZip } from "../src/lib/geo";
import { isPosition, normalizePositions } from "../src/lib/positions";
import { hashPassword } from "../src/lib/password";

function positionsOf(raw: string | null, fallback: string, primary?: string | null) {
  const list = normalizePositions(raw);
  if (primary && isPosition(primary)) {
    // Put the curated primary position first, keeping the rest as secondary.
    list.splice(0, list.length, primary, ...list.filter((p) => p !== primary));
  }
  // Rows collected for a position-specific tab (e.g. "OH Roster") with no listed
  // position still belong to that position.
  if (!list.length) list.push(fallback as never);
  return { positions: list.join("/"), primaryPosition: list[0] };
}

async function seedSchools() {
  const seeds: SchoolSeed[] = JSON.parse(fs.readFileSync("data/seed/schools.json", "utf8"));
  const missingGeo: string[] = [];

  for (const s of seeds) {
    let { latitude, longitude } = s;
    if ((latitude == null || longitude == null) && s.city && s.state) {
      const place = lookupCity(s.city, s.state);
      latitude = place?.latitude ?? null;
      longitude = place?.longitude ?? null;
    }
    if (latitude == null) missingGeo.push(s.name);

    const values = {
      slug: s.slug,
      name: s.name,
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
    const [row] = await db
      .insert(schema.schools)
      .values(values)
      .onConflictDoUpdate({ target: schema.schools.slug, set: values })
      .returning({ id: schema.schools.id });
    const schoolId = row.id;
    const fallback = s.positionsCovered[0] ?? "OH";

    await db.delete(schema.seasons).where(eq(schema.seasons.schoolId, schoolId));
    await db.delete(schema.rosterPlayers).where(eq(schema.rosterPlayers.schoolId, schoolId));
    await db.delete(schema.commits).where(eq(schema.commits.schoolId, schoolId));

    if (s.seasons.length) {
      await db.insert(schema.seasons).values(s.seasons.map((x) => ({ ...x, schoolId })));
    }
    if (s.roster.length) {
      await db.insert(schema.rosterPlayers).values(
        s.roster.map((p) => ({
          ...p,
          schoolId,
          season: s.rosterSeason ?? new Date().getFullYear(),
          ...positionsOf(p.positionRaw, fallback),
        })),
      );
    }
    if (s.commits.length) {
      await db.insert(schema.commits).values(
        s.commits.map(({ primaryPosition, ...c }) => ({
          ...c,
          schoolId,
          ...positionsOf(c.positionRaw, fallback, primaryPosition),
        })),
      );
    }
  }

  console.log(`Seeded ${seeds.length} schools.`);
  if (missingGeo.length) console.warn(`No coordinates found for: ${missingGeo.join(", ")}`);
}

async function seedDemo() {
  const email = "demo@vbelite.local";
  await db.delete(schema.users).where(eq(schema.users.email, email));
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash: hashPassword("demo-password") })
    .returning();
  const home = lookupZip("43215")!;
  const [athlete] = await db
    .insert(schema.athletes)
    .values({
      userId: user.id,
      name: "Demo Athlete",
      gradYear: 2030,
      position: "OH",
      heightIn: 72,
      homeZip: "43215",
      homeCity: home.city,
      homeState: home.state,
      latitude: home.latitude,
      longitude: home.longitude,
    })
    .returning();
  const all = await db.select({ id: schema.schools.id, slug: schema.schools.slug }).from(schema.schools);
  // Save up to 15 schools, spread across the list tiers, so the dashboard has something to show.
  const tiers = ["top", "main", "main", "reach"];
  const picks = all.slice(0, 15);
  if (picks.length) {
    await db
      .insert(schema.savedSchools)
      .values(picks.map((s, i) => ({ athleteId: athlete.id, schoolId: s.id, tier: tiers[i % tiers.length] })));
  }
  console.log(`Demo account: ${email} / demo-password (${picks.length} saved schools)`);
}

async function main() {
  await seedSchools();
  if (process.argv.includes("--demo")) await seedDemo();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
