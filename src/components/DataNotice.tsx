import Link from "next/link";

/**
 * Shown wherever measurables or recruiting results are entered: they're included, without
 * her name or contact details, in VB Elite's anonymous statistics (opt out on the profile).
 */
export function DataNotice({ what = "Measurements" }: { what?: string }) {
  return (
    <p className="text-xs text-ink-3">
      {what} you enter here are also included, without her name or contact details, in VB Elite&apos;s anonymous statistics,
      which make age-based comparisons and projections more accurate for every athlete. You can{" "}
      <Link href="/profile#data" className="underline">opt out on her profile</Link>.
    </p>
  );
}
