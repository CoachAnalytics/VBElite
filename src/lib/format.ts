export function formatHeight(inches: number | null | undefined): string {
  if (inches == null || Number.isNaN(inches)) return "—";
  const ft = Math.floor(inches / 12);
  const rem = Math.round((inches - ft * 12) * 10) / 10;
  return `${ft}'${rem}"`;
}

/** Parses 6'2", 6-2, 6 2, or plain inches (74). */
export function parseHeight(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = value.trim();
  const m = s.match(/^(\d)\s*(?:'|ft|-|\s)\s*(\d{1,2}(?:\.\d)?)?\s*(?:"|in)?$/i);
  if (m) return Number(m[1]) * 12 + (m[2] ? Number(m[2]) : 0);
  const n = Number(s);
  return Number.isFinite(n) && n > 48 && n < 96 ? n : null;
}

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
