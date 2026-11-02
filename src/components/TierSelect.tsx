"use client";

import { setTier } from "@/app/actions";
import { TIERS } from "@/lib/tiers";

/** Moves a school between the athlete's lists (Top choice, Main list, ...); saves on change. */
export function TierSelect({ schoolId, tier, label }: { schoolId: number; tier: string; label: string }) {
  return (
    <form action={setTier}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <select
        name="tier"
        defaultValue={tier}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-ink-2"
        aria-label={label}
      >
        {TIERS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
      </select>
    </form>
  );
}
