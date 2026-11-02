export function formatHeight(inches: number | null | undefined): string {
  if (inches == null || Number.isNaN(inches)) return "—";
  const ft = Math.floor(inches / 12);
  const rem = Math.round((inches - ft * 12) * 10) / 10;
  return `${ft}'${rem}"`;
}

/** Apostrophe-like marks phones and keyboards insert for feet: ' ‘ ’ ′ ` ´ ʼ ʹ ＇ */
const FOOT_MARKS = /['\u2018\u2019\u201B\u2032`\u00B4\u02BC\u02B9\uFF07]/g;
/** Quote-like marks for inches: " “ ” ″ ʺ ＂ */
const INCH_MARKS = /["\u201C\u201D\u201F\u2033\u02BA\uFF02]/g;

/**
 * Parses a height or reach: 6'2", 9'3", 6-2, 6 2, 6 ft 2 in, or plain inches (74, 111").
 * Phones' curly quotes and primes (9’3”, 9′3″) work too. Returns whole inches, or null when the
 * text can't be read or falls outside [min, max] (defaults fit a player's height; pass a wider
 * range for standing reach and touches).
 */
export function parseHeight(value: string | null | undefined, range: { min?: number; max?: number } = {}): number | null {
  const { min = 48, max = 96 } = range;
  if (!value) return null;
  const s = value
    .trim()
    .toLowerCase()
    .replace(INCH_MARKS, " in ")
    .replace(/(?:\s*'\s*){2}/g, " in ") // two apostrophes typed for inches
    .replace(FOOT_MARKS, " ft ")
    .replace(/\b(?:feet|foot)\b/g, " ft ")
    .replace(/\b(?:inches|inch)\b/g, " in ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/(\d)\s*-\s*(\d)/g, "$1 ft $2");
  // Only numbers and the ft/in units are allowed.
  if (!/^[\d.\s]*(?:(?:ft|in)[\d.\s]*)*$/.test(s) || !/\d/.test(s)) return null;
  const tokens = s.match(/\d+(?:\.\d+)?|ft|in/g)!;
  const nums = tokens.filter((t) => /\d/.test(t)).map(Number);
  let inches: number;
  if (nums.length === 2) {
    const [ft, rest] = nums;
    if (!Number.isInteger(ft) || rest >= 12) return null;
    inches = ft * 12 + rest;
  } else if (nums.length === 1) {
    const unit = tokens[tokens.indexOf(String(nums[0])) + 1] ?? tokens.find((t) => !/\d/.test(t));
    inches = unit === "ft" ? nums[0] * 12 : nums[0];
  } else {
    return null;
  }
  inches = Math.round(inches);
  return inches >= min && inches <= max ? inches : null;
}

/** Standing reach, approach touch and block touch: 5' to 12'6". */
export const REACH_RANGE = { min: 60, max: 150 };

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatPct(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
