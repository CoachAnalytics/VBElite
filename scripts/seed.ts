/**
 * Loads data/seed/schools.json into the database. Safe to re-run: schools are
 * upserted by slug and their seasons, roster and commits are replaced.
 *
 *   npm run db:seed            # school data only
 *   npm run db:seed -- --demo  # also create demo@vbelite.local / demo-password (local only)
 */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { databaseUrl } from "../src/db/url";
import type { SchoolSeed } from "../src/db/seed-types";
import { lookupZip } from "../src/lib/geo";
import { loadSchools } from "../src/lib/import/load";
import { hashPassword } from "../src/lib/password";

async function seedSchools() {
  const file = "data/seed/schools.json";
  if (!fs.existsSync(file)) {
    console.warn(`${file} not found. Run \`npm run import:xlsx -- workbook.xlsx\` first. Skipping schools.`);
    return;
  }
  const seeds: SchoolSeed[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const summary = await loadSchools(seeds);
  console.log(`Seeded ${summary.schools} schools.`);
  if (summary.missingGeo.length) console.warn(`No coordinates found for: ${summary.missingGeo.join(", ")}`);
}

async function seedDemo() {
  if (databaseUrl() && !process.argv.includes("--force-demo")) {
    // A demo login with a published password must never exist on the live site.
    console.warn("DATABASE_URL is set: skipping the demo account (pass --force-demo to override).");
    return;
  }
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
