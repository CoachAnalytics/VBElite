/**
 * Season stats an athlete enters (typed, or pasted from her own MaxPreps page), per-set
 * rates, and the one-line summary used in coach emails. Pure functions, no database access.
 *
 * VB Elite never fetches MaxPreps: its terms (CBS Sports Interactive) prohibit automated
 * collection. The athlete copies her own stats table and pastes it; we read the columns.
 */

export const STAT_FIELDS = [
  { key: "matches", label: "Matches", short: "MP" },
  { key: "sets", label: "Sets played", short: "SP" },
  { key: "kills", label: "Kills", short: "K" },
  { key: "attackErrors", label: "Attack errors", short: "E" },
  { key: "attempts", label: "Attack attempts", short: "TA" },
  { key: "assists", label: "Assists", short: "Ast" },
  { key: "aces", label: "Aces", short: "SA" },
  { key: "serveErrors", label: "Serve errors", short: "SE" },
  { key: "digs", label: "Digs", short: "D" },
  { key: "receptions", label: "Serve receptions", short: "R" },
  { key: "receptionErrors", label: "Reception errors", short: "RE" },
  { key: "soloBlocks", label: "Solo blocks", short: "BS" },
  { key: "blockAssists", label: "Block assists", short: "BA" },
] as const;

export type StatKey = (typeof STAT_FIELDS)[number]["key"];
export type StatValues = Partial<Record<StatKey, number | null>>;

export const TEAM_LEVELS = [
  { value: "varsity", label: "High school varsity" },
  { value: "jv", label: "High school JV" },
  { value: "freshman", label: "High school freshman" },
  { value: "club", label: "Club" },
] as const;

// ---------- MaxPreps link ----------

/** A MaxPreps athlete page URL, normalized to https and without tracking parameters, or null. */
export function normalizeMaxprepsUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (!/(^|\.)maxpreps\.com$/i.test(url.hostname)) return null;
  if (!/\/athletes\//i.test(url.pathname)) return null;
  const careerid = url.searchParams.get("careerid");
  return `https://www.maxpreps.com${url.pathname}${careerid ? `?careerid=${encodeURIComponent(careerid)}` : ""}`;
}

// ---------- Reading a pasted stats table ----------

/** Column names (lower-case, spaces removed) that map to each stat, by table context. */
const HEADERS: Record<string, StatKey | "ignore"> = {
  mp: "matches", gp: "matches", matches: "matches", matchesplayed: "matches",
  sp: "sets", sets: "sets", setsplayed: "sets",
  k: "kills", kills: "kills",
  ta: "attempts", att: "attempts", attempts: "attempts", totalattempts: "attempts", attackattempts: "attempts",
  ast: "assists", assists: "assists", a: "assists",
  sa: "aces", aces: "aces", ace: "aces",
  se: "serveErrors", serveerrors: "serveErrors",
  d: "digs", digs: "digs", dig: "digs",
  r: "receptions", rec: "receptions", receptions: "receptions", serverec: "receptions",
  re: "receptionErrors", recerr: "receptionErrors",
  bs: "soloBlocks", solo: "soloBlocks", soloblocks: "soloBlocks", blocksolo: "soloBlocks",
  ba: "blockAssists", blockassists: "blockAssists", blockassist: "blockAssists",
};
/** Columns we recognize but don't store (rates and percentages are recomputed). */
const IGNORED = /\/|%|pct|per|avg|eff|be$|bhe|bha|^de$|^tb$|totalblocks|blocks$|^pts?$|points|season|year|level|team|class|grade|^#$|^no\.?$|^name$|^athlete$|^player$/;

export type ParsedRow = { label: string | null; values: StatValues };

const cleanHeader = (h: string) => h.toLowerCase().replace(/[\s.()]+/g, "");
const isNumber = (t: string) => /^-?(\d+(\.\d+)?|\.\d+)%?$/.test(t.replace(/,/g, ""));
const splitCells = (line: string) =>
  (line.includes("\t") ? line.split("\t") : line.replace(/\s+%/g, "%").replace(/\s*\/\s*/g, "/").trim().split(/\s+/))
    .map((c) => c.trim())
    .filter(Boolean);

/** A season label at the start of a row: "25-26", "2025-26", "2025", "Fr", "Varsity"... */
function rowLabel(cells: string[]): { label: string | null; rest: string[] } {
  const labels: string[] = [];
  let i = 0;
  while (i < cells.length && !isNumber(cells[i])) labels.push(cells[i++]);
  // A bare year at the start is a label, not a stat.
  if (i < cells.length && /^(19|20)\d{2}$/.test(cells[i])) labels.push(cells[i++]);
  return { label: labels.length ? labels.join(" ") : null, rest: cells.slice(i) };
}

/**
 * Reads stats from text copied off a stats page: one or more tables, each a header row of
 * column names followed by rows of numbers (one per season, or a single season). Also reads
 * "Kills: 312" style lines. Rows from different tables are joined by their season label.
 */
export function parseStatsPaste(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = new Map<string, ParsedRow>();
  const rowFor = (label: string | null, index: number) => {
    const key = label?.toLowerCase().replace(/\s+/g, " ") ?? `#${index}`;
    if (!rows.has(key)) rows.set(key, { label, values: {} });
    return rows.get(key)!;
  };
  let header: (StatKey | "ignore" | null)[] | null = null;
  let headerHasLabel = false;
  let index = 0;
  for (const line of lines) {
    // "Kills: 312" or "Kills 312" on its own line.
    const kv = line.match(/^([A-Za-z][A-Za-z %/.]*?)\s*[:=]?\s*(-?\d[\d,]*(?:\.\d+)?)$/);
    if (kv && HEADERS[cleanHeader(kv[1])] && !header) {
      const key = HEADERS[cleanHeader(kv[1])];
      if (key !== "ignore") rowFor(null, 0).values[key] = Number(kv[2].replace(/,/g, ""));
      continue;
    }
    const cells = splitCells(line);
    const known = cells.filter((c) => HEADERS[cleanHeader(c)] || IGNORED.test(cleanHeader(c))).length;
    const numbers = cells.filter(isNumber).length;
    if (known >= 2 && numbers === 0) {
      // A header row. "E" means attack errors only next to kills; elsewhere it's another table's errors.
      const names = cells.map(cleanHeader);
      const attacking = names.includes("k") || names.includes("kills");
      header = names.map((h) => (h === "e" || h === "err" || h === "errors" ? (attacking ? "attackErrors" : "ignore") : HEADERS[h] ?? (IGNORED.test(h) ? "ignore" : null)));
      headerHasLabel = !HEADERS[names[0]];
      index = 0;
      continue;
    }
    if (!header || numbers === 0) continue;
    const { label, rest } = rowLabel(cells);
    // Align the numbers with the stat columns: skip the header's leading label columns.
    const statCols = headerHasLabel ? header.slice(header.length - rest.length) : header;
    const row = rowFor(label && /total|career/i.test(label) ? "Career" : label, index++);
    rest.forEach((cell, i) => {
      const key = statCols[i];
      if (!key || key === "ignore" || !isNumber(cell) || cell.endsWith("%")) return;
      const n = Number(cell.replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 0) row.values[key] = n;
    });
  }
  return [...rows.values()].filter((r) => Object.keys(r.values).length > 0);
}

// ---------- Rates and summaries ----------

export type SeasonStats = StatValues & { season: number; level: string };

export const totalBlocks = (s: StatValues) =>
  s.soloBlocks == null && s.blockAssists == null ? null : (s.soloBlocks ?? 0) + (s.blockAssists ?? 0) * 0.5;

export function hittingPct(s: StatValues): number | null {
  if (s.kills == null || s.attackErrors == null || !s.attempts) return null;
  return (s.kills - s.attackErrors) / s.attempts;
}

/** Per-set rates; null where the stat or sets played is missing. */
export function perSet(s: StatValues) {
  const per = (n: number | null | undefined) => (n == null || !s.sets ? null : n / s.sets);
  return {
    kills: per(s.kills),
    assists: per(s.assists),
    aces: per(s.aces),
    digs: per(s.digs),
    blocks: per(totalBlocks(s)),
  };
}

export const RATE_LABELS = { kills: "Kills", assists: "Assists", aces: "Aces", digs: "Digs", blocks: "Blocks" } as const;

/** The stats that matter most for each position, in order. */
export const KEY_RATES: Record<string, (keyof typeof RATE_LABELS)[]> = {
  OH: ["kills", "digs", "aces"],
  OPP: ["kills", "blocks", "digs"],
  MB: ["kills", "blocks", "aces"],
  S: ["assists", "digs", "aces"],
  LDS: ["digs", "aces", "assists"],
};

/** "2025-26" for the fall 2025 season. */
export const seasonLabel = (season: number) => `${season}-${String((season + 1) % 100).padStart(2, "0")}`;

/** Grade during a fall season for a given graduation class: Fr, So, Jr, Sr (or 8th and below). */
export function gradeIn(season: number, gradYear: number): string {
  const g = 12 - (gradYear - season - 1);
  return g >= 12 ? "Sr" : g === 11 ? "Jr" : g === 10 ? "So" : g === 9 ? "Fr" : `${g}th`;
}

const fmtRate = (n: number) => n.toFixed(n >= 10 ? 1 : 2).replace(/^0(?=\.)/, "");
const fmtPct = (n: number) => (n < 0 ? "-" : "") + Math.abs(n).toFixed(3).replace(/^0/, "");

/** One line for a coach email: "2025-26 varsity (Jr): 312 kills (3.12/set), .245 hitting, 1.85 digs/set". */
export function statLine(s: SeasonStats, position: string, gradYear: number): string | null {
  const rates = perSet(s);
  const parts: string[] = [];
  for (const key of KEY_RATES[position] ?? KEY_RATES.OH) {
    const total = key === "blocks" ? totalBlocks(s) : s[key as StatKey];
    const r = rates[key];
    if (total == null) continue;
    parts.push(r != null ? `${Math.round(total)} ${RATE_LABELS[key].toLowerCase()} (${fmtRate(r)}/set)` : `${Math.round(total)} ${RATE_LABELS[key].toLowerCase()}`);
    if (key === "kills") {
      const h = hittingPct(s);
      if (h != null) parts.push(`${fmtPct(h)} hitting`);
    }
  }
  if (!parts.length) return null;
  const level = TEAM_LEVELS.find((l) => l.value === s.level)?.label.replace("High school ", "") ?? s.level;
  return `${seasonLabel(s.season)} ${level.toLowerCase()} (${gradeIn(s.season, gradYear)}): ${parts.join(", ")}`;
}

export { fmtPct, fmtRate };

export const PEER_MIN = 20;

/**
 * Where her per-set rates rank among peers' seasons (same position, grade and team level).
 * A rate gets a percentile only when at least PEER_MIN peers have it; `n` says how many do.
 */
export function peerRanks(mine: StatValues, peers: StatValues[]) {
  const rates = perSet(mine);
  const out = {} as Record<keyof typeof RATE_LABELS, { value: number | null; pct: number | null; n: number }>;
  for (const key of Object.keys(RATE_LABELS) as (keyof typeof RATE_LABELS)[]) {
    const list = peers.map((p) => perSet(p)[key]).filter((x): x is number => x != null);
    const value = rates[key];
    out[key] = {
      value,
      n: list.length,
      pct: value == null || list.length < PEER_MIN ? null : Math.round((100 * list.filter((x) => x <= value).length) / list.length),
    };
  }
  return out;
}
