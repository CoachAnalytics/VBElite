export const POSITIONS = [
  { code: "S", label: "Setter" },
  { code: "OH", label: "Outside hitter" },
  { code: "OPP", label: "Opposite / right side" },
  { code: "MB", label: "Middle blocker" },
  { code: "LDS", label: "Libero / defensive specialist" },
] as const;

export type Position = (typeof POSITIONS)[number]["code"];

export const DIVISIONS = ["D1", "D2", "D3", "NAIA", "JUCO"] as const;
export type Division = (typeof DIVISIONS)[number];

const ALIASES: Record<string, Position> = {
  S: "S",
  SETTER: "S",
  OH: "OH",
  OS: "OH",
  LS: "OH",
  OPP: "OPP",
  OP: "OPP",
  RS: "OPP",
  RH: "OPP",
  MB: "MB",
  MH: "MB",
  M: "MB",
  L: "LDS",
  LIB: "LDS",
  DS: "LDS",
};

// Spelled-out positions as rosters list them ("Outside Hitter", "Right Side").
const PHRASES: [RegExp, string][] = [
  [/outside\s*hitter|left\s*side(\s*hitter)?/g, "OH"],
  [/opposite(\s*(side\s*)?hitter)?|right\s*side(\s*hitter)?/g, "OPP"],
  [/middle\s*(blocker|hitter)?/g, "MB"],
  [/defensive\s*specialist/g, "DS"],
  [/libero/g, "L"],
  [/setter/g, "S"],
];

/** "OH/DS/L" or "Outside Hitter/Libero" -> ["OH", "LDS"]; unknown tokens are dropped, order kept. */
export function normalizePositions(raw: string | null | undefined): Position[] {
  if (!raw) return [];
  let text = raw.toLowerCase();
  for (const [re, code] of PHRASES) text = text.replace(re, ` ${code} `);
  const out: Position[] = [];
  for (const token of text.toUpperCase().split(/[\/,&\s-]+/)) {
    const code = ALIASES[token.trim()];
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

export function positionLabel(code: string): string {
  return POSITIONS.find((p) => p.code === code)?.label ?? code;
}

export function isPosition(value: string): value is Position {
  return POSITIONS.some((p) => p.code === value);
}
