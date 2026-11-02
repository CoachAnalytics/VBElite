import Link from "next/link";
import { setResearchConsent } from "@/app/actions";
import type { MetricKey, MetricView } from "@/lib/development";
import { positionLabel } from "@/lib/positions";

/** Inches as feet and inches, to the nearest half inch: 9'11.5". */
export function feetInches(inches: number): string {
  const half = Math.round(inches * 2) / 2;
  const ft = Math.floor(half / 12);
  const rem = half - ft * 12;
  return `${ft}'${Number.isInteger(rem) ? rem : rem.toFixed(1)}"`;
}

const ordinal = (n: number) => {
  const r = Math.round(n);
  const s = r % 100 >= 11 && r % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[r % 10] ?? "th";
  return `${r}${s}`;
};
/** "82nd percentile", "Top 1%", "Below the 1st percentile" */
const pctText = (p: number) => (p >= 99 ? "Top 1%" : p < 1 ? "Below the 1st percentile" : `${ordinal(p)} percentile`);

export type CollegeBand = { label: string; values: Record<MetricKey, number> };

export function MeasurablesCard({
  first,
  position,
  age,
  ageExact,
  views,
  college,
  commitPct,
  monthsSinceMeasured,
  consent,
}: {
  first: string;
  position: string;
  age: number;
  ageExact: boolean;
  views: MetricView[];
  college: CollegeBand[];
  /** Share of D1 commits at her position no taller than her projected height. */
  commitPct: number | null;
  monthsSinceMeasured: number | null;
  consent: boolean;
}) {
  const pos = positionLabel(position).toLowerCase();
  const ageText = age.toFixed(1);
  const height = views.find((v) => v.key === "height");
  const hasTouches = views.some((v) => v.key === "approach" || v.key === "block");
  const projected = Object.fromEntries(views.map((v) => [v.key, v.projectedIn.mid])) as Partial<Record<MetricKey, number>>;
  const collegeRows: { key: MetricKey; label: string }[] = [
    { key: "height", label: "Height" },
    { key: "reach", label: "Standing reach" },
    { key: "block", label: "Block touch" },
    { key: "approach", label: "Approach touch" },
  ];

  return (
    <section className="card space-y-4 p-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-3">Measurables for her age</div>
        <p className="mt-1 text-sm text-ink-2">
          {first} is {ageText}
          {ageExact ? "" : " (estimated from her class; add her birth month on her profile for an exact age)"}. A{" "}
          {ageText}-year-old is compared with elite {pos}s her age, not with college players, and projected to 18.
        </p>
      </div>

      {height == null ? (
        <p className="text-sm text-ink-3">
          Add her height on her <Link href="/profile" className="text-accent-ink underline">profile</Link> to see this.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-2 pr-3 font-medium">Measurable</th>
                <th className="py-2 pr-3 font-medium">Now</th>
                <th className="py-2 pr-3 font-medium">For her age</th>
                <th className="py-2 font-medium">Projected at 18</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.key} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-3 font-medium">{v.label}</td>
                  <td className="tabular py-2 pr-3">
                    {v.estimated ? "≈" : ""}
                    {feetInches(v.nowIn)}
                    {v.estimated && <div className="text-xs text-ink-3">from her height</div>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{pctText(v.elitePct)}</span>
                    <span className="text-ink-3"> of elite {pos}s</span>
                    {v.cdcPct != null && (
                      <div className="text-xs text-ink-3">Taller than {v.cdcPct >= 99.5 ? "99%+" : `${Math.round(v.cdcPct)}%`} of U.S. girls her age</div>
                    )}
                  </td>
                  <td className="tabular py-2">
                    <span className="font-medium">{feetInches(v.projectedIn.mid)}</span>
                    <div className="text-xs text-ink-3">
                      {feetInches(v.projectedIn.low)} – {feetInches(v.projectedIn.high)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {height && commitPct != null && (
        <p className="text-sm text-ink-2">
          At a projected {feetInches(height.projectedIn.mid)}, she&apos;d be taller than {commitPct}% of the D1 {pos} commits in our
          data.
        </p>
      )}

      {height && !hasTouches && (
        <p className="rounded-md bg-surface-2 p-3 text-sm text-ink-2">
          Add her standing reach, block touch and approach touch in the{" "}
          <Link href="/questionnaire" className="text-accent-ink underline">questionnaire</Link> to see how her jump compares.
        </p>
      )}

      {height && college.length > 0 && (
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">What D1 {pos}s measure, by level</summary>
          <div className="overflow-x-auto border-t border-line p-3">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="py-1 pr-3 font-medium" />
                  {college.map((c) => <th key={c.label} className="py-1 pr-3 font-medium">{c.label}</th>)}
                  <th className="py-1 font-medium">{first} at 18</th>
                </tr>
              </thead>
              <tbody>
                {collegeRows.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="py-1.5 pr-3">{r.label}</td>
                    {college.map((c) => <td key={c.label} className="tabular py-1.5 pr-3">{feetInches(c.values[r.key])}</td>)}
                    <td className="tabular py-1.5 font-medium">{projected[r.key] != null ? feetInches(projected[r.key]!) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">
              Heights are the average for her position on current D1 rosters at each level. Reach and touches are VB Elite
              estimates from those heights and published college testing; no source reports touches by D1 level.
            </p>
          </div>
        </details>
      )}

      {monthsSinceMeasured != null && monthsSinceMeasured >= 6 && age < 18 && (
        <p className="rounded-md border border-warn/40 p-3 text-sm">
          Her measurements are {Math.floor(monthsSinceMeasured)} months old. Growing athletes should re-measure every 6 months:
          update her height on her <Link href="/profile" className="text-accent-ink underline">profile</Link> and touches in the{" "}
          <Link href="/questionnaire" className="text-accent-ink underline">questionnaire</Link>.
        </p>
      )}

      <form action={setResearchConsent} className="rounded-lg bg-surface-2 p-3 text-sm">
        <input type="hidden" name="consent" value={consent ? "no" : "yes"} />
        {consent ? (
          <p className="text-ink-2">
            ✓ {first}&apos;s measurements and offers help build VB Elite&apos;s own age-by-position norms (anonymously, without her name
            or contact details).{" "}
            <button className="text-accent-ink underline">Turn off</button>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-ink-2">
              Help build better projections: include {first}&apos;s measurements and offers, without her name or contact details, in
              VB Elite&apos;s anonymous statistics. Every family who joins makes the comparisons more accurate.
            </p>
            <button className="btn-secondary px-3 py-1.5 text-sm">Include her anonymously</button>
          </div>
        )}
      </form>

      <details className="text-xs text-ink-3">
        <summary className="cursor-pointer">How this is calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Height growth: CDC growth charts for girls; she&apos;s assumed to stay on her percentile, with a range for early and late maturers (tall girls often finish growing early).</li>
          <li>Standing reach: 1.30 × height when she hasn&apos;t measured it (Tsoukos 2019; Sieroń 2023; AVCA testing).</li>
          <li>Jump growth by age: Grbić 2026, 2,798 girls ages 10–18; jumps grow about 1 cm a year to 14, then about 0.4 cm a year.</li>
          <li>Elite peers: Milić 2017 (club players at 14, by position) and Tsoukos 2019 (junior national pool at 14), scaled to her exact age. These are European samples; no U.S. age norms by position are published. VB Elite will replace them with its own data as families opt in.</li>
        </ul>
      </details>
    </section>
  );
}
