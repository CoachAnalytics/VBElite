/**
 * Converts a "Volleyball Recruiting Comparison" workbook into data/seed/schools.json.
 *
 *   npm run import:xlsx -- path/to/workbook.xlsx [--division D1] [--home-state OH] [--season 2026]
 *
 * Existing entries in schools.json that the workbook doesn't mention are kept, so
 * several workbooks (e.g. one per division) can be merged into the same seed file.
 * (On the live site, upload the workbook on the /admin page instead.)
 */
import fs from "node:fs";
import path from "node:path";
import type { SchoolSeed } from "../src/db/seed-types";
import { parseWorkbook } from "../src/lib/import/workbook";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Usage: npm run import:xlsx -- path/to/workbook.xlsx [--division D1] [--home-state OH] [--season 2026]");
    process.exit(1);
  }
  const schools = await parseWorkbook(fs.readFileSync(file), {
    division: arg("division", "D1"),
    homeState: arg("home-state", "OH"),
    rosterSeason: Number(arg("season", "2026")),
  });
  const out = path.resolve("data/seed/schools.json");
  const existing: SchoolSeed[] = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : [];
  const bySlug = new Map(existing.map((s) => [s.slug, s]));
  for (const s of schools) bySlug.set(s.slug, { ...bySlug.get(s.slug), ...s });
  const merged = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(merged, null, 2) + "\n");

  const nRoster = schools.reduce((n, s) => n + s.roster.length, 0);
  const nCommits = schools.reduce((n, s) => n + s.commits.length, 0);
  console.log(`Imported ${schools.length} schools, ${nRoster} roster players, ${nCommits} commits -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
