/**
 * Progress toward VB Elite's own age-by-position norms: distinct opted-in athletes measured
 * in each position and age group. Pure function.
 */
export const AGE_GROUPS = ["12U", "13U", "14U", "15U", "16U", "17U", "18U"] as const;
export const NORM_TARGET = 30;

/** Club age group from age in years (13.4 -> 14U, the age she'll play at). */
export function ageGroup(age: number): string {
  const u = Math.min(18, Math.max(12, Math.floor(age) + 1));
  return `${u}U`;
}

export function coverage(rows: { athlete: string; position: string; ageYears: number }[]) {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.position}|${ageGroup(r.ageYears)}`;
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key)!.add(r.athlete);
  }
  return (position: string, group: string) => seen.get(`${position}|${group}`)?.size ?? 0;
}
