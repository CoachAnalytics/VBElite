/**
 * Converts a "Volleyball Recruiting Comparison" workbook into data/seed/schools.json.
 *
 *   npm run import:xlsx -- path/to/workbook.xlsx [--division D1] [--home-state OH] [--season 2026]
 *
 * The workbook's tuition column is priced for one home state, so --home-state says
 * which: schools in that state get it as in-state tuition, private schools get it for
 * both, and other public schools get it as out-of-state tuition.
 *
 * Existing entries in schools.json that the workbook doesn't mention are kept, so
 * several workbooks (e.g. one per division) can be merged into the same seed file.
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "../src/lib/format";
import type { CommitSeed, RosterSeed, SchoolSeed, SeasonSeed } from "../src/db/seed-types";

// Private institutions in the current workbook. Extend as schools are added.
const PRIVATE = new Set([
  "Creighton", "Xavier", "High Point", "Marquette", "Dayton", "San Diego",
  "Rice", "TCU", "Baylor", "USC",
]);

// "Type" column in the OH Commits tab: the researcher's call on where a recruit will
// actually play, which beats the order positions happen to be listed in.
const COMMIT_TYPE_PRIMARY: Record<string, string> = {
  "primary oh": "OH",
  "back-row hybrid": "LDS",
  "pin hybrid": "OPP",
  "mb hybrid": "MB",
  "setter hybrid": "S",
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

type Cell = string | number | boolean | null;

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if (v instanceof Date) return v.toISOString();
    return null;
  }
  return v;
}

/** Reads a sheet as objects keyed by header, stopping at the first blank "School" cell. */
function readTable(ws: ExcelJS.Worksheet): Record<string, Cell>[] {
  const headers = (ws.getRow(1).values as ExcelJS.CellValue[]).map((h) => String(cellValue(h) ?? "").trim());
  const rows: Record<string, Cell>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values = row.values as ExcelJS.CellValue[];
    const first = cellValue(values[1]);
    if (first == null || first === "") break;
    const obj: Record<string, Cell> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = cellValue(values[i]);
    });
    rows.push(obj);
  }
  return rows;
}

const str = (v: Cell) => (v == null || v === "" ? null : String(v).trim());
const int = (v: Cell) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

function classYear(v: Cell): RosterSeed["classYear"] | null {
  const s = str(v)?.replace(/^R-/, "");
  if (!s) return null;
  if (/^gr/i.test(s) || /5th/i.test(s)) return "Grad";
  const m = ["Fr", "So", "Jr", "Sr"].find((c) => c.toLowerCase() === s.slice(0, 2).toLowerCase());
  return (m as RosterSeed["classYear"]) ?? null;
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Usage: npm run import:xlsx -- path/to/workbook.xlsx [--division D1] [--home-state OH] [--season 2026]");
    process.exit(1);
  }
  const division = arg("division", "D1");
  const homeState = arg("home-state", "OH");
  const rosterSeason = Number(arg("season", "2026"));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = (name: string) => {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`Workbook is missing the "${name}" tab`);
    return readTable(ws);
  };

  const comparison = sheet("Comparison");
  const records = new Map(sheet("Records Data").map((r) => [str(r["School"]), r]));
  const pipeline = new Map(sheet("Recruiting Pipeline").map((r) => [str(r["School"]), r]));
  const breakdown = new Map(sheet("OH Breakdown").map((r) => [str(r["School"]), r]));
  const notes = new Map(sheet("Notes & Sources").map((r) => [str(r["School"]), r]));
  const roster = sheet("OH Roster");
  const commits = sheet("OH Commits");

  const seasonYears = Object.keys(comparison[0])
    .map((h) => h.match(/^(\d{4}) Record$/)?.[1])
    .filter(Boolean)
    .map(Number);

  const schools: SchoolSeed[] = comparison.map((c) => {
    const name = str(c["School"])!;
    const rec = records.get(name);
    const pipe = pipeline.get(name);
    const note = notes.get(name);
    const state = str(c["State"]);
    const tuition = int(c[Object.keys(c).find((k) => k.startsWith("Tuition")) ?? ""] ?? null);
    const isPrivate = PRIVATE.has(name);

    const seasons: SeasonSeed[] = [];
    for (const y of seasonYears) {
      const w = int(rec?.[`${y} W`] ?? null);
      const l = int(rec?.[`${y} L`] ?? null);
      if (w == null || l == null) continue;
      seasons.push({ year: y, wins: w, losses: l, postseason: str(c[`${y} NCAA`]) });
    }

    const aprRaw = c["Volleyball APR"];
    const quality = str(pipe?.["Data Completeness"] ?? null)?.toLowerCase();

    return {
      slug: slugify(name),
      name,
      city: str(c["City"]),
      state,
      division,
      conference: str(c["Conference"]),
      control: isPrivate ? "private" : "public",
      enrollment: int(c["Enrollment"]),
      enrollmentNote: str(note?.["Enrollment basis"] ?? null),
      tuitionInState: isPrivate || state === homeState ? tuition : null,
      tuitionOutState: isPrivate || state !== homeState ? tuition : null,
      tuitionYear: "2026-27",
      headCoach: str(c["Head Coach"]),
      coachSince: int(c["Coach Since"]),
      apr: int(aprRaw),
      aprNote: str(c["APR Year"]) ?? str(note?.["APR note"] ?? null),
      rosterSize: int(breakdown.get(name)?.["Roster Size"] ?? null),
      rosterSeason,
      positionsCovered: ["OH"],
      commitDataQuality: quality === "good" ? "good" : quality === "partial" ? "partial" : null,
      recruitingNote: str(pipe?.["Notes"] ?? null),
      programNote: str(note?.["Program notes"] ?? null),
      seasons,
      roster: roster
        .filter((r) => str(r["School"]) === name && str(r["Player"]))
        .flatMap((r): RosterSeed[] => {
          const cy = classYear(r["Class"] ?? r["Class (as listed)"]);
          if (!cy) return [];
          return [{
            name: str(r["Player"])!,
            classYear: cy,
            redshirt: str(r["Redshirt"]) === "Y",
            positionRaw: str(r["Position"]),
            heightIn: int(r["Height (in)"]),
          }];
        }),
      commits: commits
        .filter((r) => str(r["School"]) === name && str(r["Player"]) && int(r["HS Class"]))
        .map((r): CommitSeed => ({
          name: str(r["Player"])!,
          gradYear: int(r["HS Class"])!,
          positionRaw: str(r["Position"]),
          primaryPosition: COMMIT_TYPE_PRIMARY[str(r["Type"] ?? null)?.toLowerCase() ?? ""] ?? null,
          heightIn: int(r["Height (in)"]),
          hometown: str(r["High School / Hometown"]),
          club: str(r["Club"]),
          note: str(r["Note"]),
        })),
    };
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
