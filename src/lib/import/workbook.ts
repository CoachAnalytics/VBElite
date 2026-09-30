/**
 * Parses a "Volleyball Recruiting Comparison" workbook (the original research
 * spreadsheet format) into SchoolSeed records. Used by the CLI importer and the
 * admin upload page.
 *
 * The workbook's tuition column is priced for one home state: schools in that
 * state get it as in-state tuition, private schools get it for both, and other
 * public schools get it as out-of-state tuition.
 */
import ExcelJS from "exceljs";
import { slugify } from "@/lib/format";
import type { CommitSeed, RosterSeed, SchoolSeed, SeasonSeed } from "@/db/seed-types";

export type WorkbookOptions = {
  division: string;
  /** State the workbook's tuition column is priced for. */
  homeState: string;
  /** Season the roster tab describes (e.g. 2026 for the fall 2026 roster). */
  rosterSeason: number;
};

export class WorkbookError extends Error {}

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

export async function parseWorkbook(data: ArrayBuffer | Uint8Array, opts: WorkbookOptions): Promise<SchoolSeed[]> {
  const { division, homeState, rosterSeason } = opts;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const sheet = (name: string) => {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new WorkbookError(`Workbook is missing the "${name}" tab`);
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

  return schools;
}
