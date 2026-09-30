"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { setTier, toggleSchool } from "@/app/actions";
import {
  DEFAULT_WEIGHTS,
  FACTORS,
  scoreSchools,
  type FactorKey,
  type SchoolAnalysis,
  type Weights,
} from "@/lib/analytics";
import { formatMoney, formatPct } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { TIERS } from "@/lib/tiers";
import { CompetitionChart } from "./CompetitionChart";
import { Sparkline } from "./Sparkline";

type Row = SchoolAnalysis & { tier: string };
type SortKey = "score" | "name" | "winPct" | "competition" | "cost" | "distance" | "coach" | "apr";

// Weights are a per-browser convenience kept in localStorage; if storage is
// unavailable they live in memory for the visit and the page still works.
const WEIGHTS_KEY = "vbelite.weights";
const listeners = new Set<() => void>();
let memoryWeights: string | null = null;

function readWeightsRaw(): string | null {
  try {
    return localStorage.getItem(WEIGHTS_KEY) ?? memoryWeights;
  } catch {
    return memoryWeights;
  }
}

function writeWeights(w: Weights | null) {
  memoryWeights = w ? JSON.stringify(w) : null;
  try {
    if (w) localStorage.setItem(WEIGHTS_KEY, memoryWeights!);
    else localStorage.removeItem(WEIGHTS_KEY);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribeWeights(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function useWeights(): Weights {
  const raw = useSyncExternalStore(subscribeWeights, readWeightsRaw, () => null);
  return useMemo(() => {
    try {
      if (raw) return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WEIGHTS;
  }, [raw]);
}

export function CompareDashboard({
  analyses,
  athleteName,
  position,
  gradYear,
}: {
  analyses: Row[];
  athleteName: string;
  position: string;
  gradYear: number;
}) {
  const weights = useWeights();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });

  const updateWeight = (key: FactorKey, value: number) => writeWeights({ ...weights, [key]: value });

  const visible = tierFilter === "all" ? analyses : analyses.filter((a) => a.tier === tierFilter);
  const scores = useMemo(() => new Map(scoreSchools(visible, weights).map((s) => [s.id, s])), [visible, weights]);

  const sorted = useMemo(() => {
    const val = (a: Row): number | string | null => {
      switch (sort.key) {
        case "score": return scores.get(a.id)?.score ?? null;
        case "name": return a.name;
        case "winPct": return a.program.winPct;
        case "competition": return a.position.covered ? a.position.projectedCompetition : null;
        case "cost": return a.cost.tuition;
        case "distance": return a.distanceMiles;
        case "coach": return a.coachTenure;
        case "apr": return a.apr;
      }
    };
    return [...visible].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // missing data always last
      if (vb == null) return -1;
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return sort.desc ? -cmp : cmp;
    });
  }, [visible, scores, sort]);

  const header = (key: SortKey, label: string, align: "left" | "right" = "right", title?: string) => (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`} title={title}
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button
        className="hover:text-ink"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" && key !== "competition" && key !== "cost" && key !== "distance" }))}
      >
        {label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  const posName = positionLabel(position).toLowerCase();
  const uncovered = analyses.filter((a) => !a.position.covered).length;
  const notYet = [...new Set(analyses.flatMap((a) => a.position.classesNotYetRecruited))].sort();

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">What matters most to {athleteName}?</h2>
          <button className="text-xs text-ink-3 hover:text-ink" onClick={() => writeWeights(null)}>
            Reset weights
          </button>
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACTORS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="flex justify-between">
                <span className="font-medium text-ink-2">{f.label}</span>
                <span className="tabular text-ink-3">{weights[f.key] === 0 ? "off" : weights[f.key]}</span>
              </span>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={weights[f.key]}
                onChange={(e) => updateWeight(f.key, Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
                aria-describedby={`help-${f.key}`}
              />
              <span id={`help-${f.key}`} className="block text-xs text-ink-3">{f.help}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-3">Show</span>
        {[{ code: "all", label: "All" }, ...TIERS].map((t) => {
          const n = t.code === "all" ? analyses.length : analyses.filter((a) => a.tier === t.code).length;
          if (!n && t.code !== "all") return null;
          return (
            <button
              key={t.code}
              onClick={() => setTierFilter(t.code)}
              className={`rounded-full border px-3 py-1 ${tierFilter === t.code ? "border-accent bg-accent text-white" : "border-line text-ink-2 hover:bg-surface-2"}`}
              aria-pressed={tierFilter === t.code}
            >
              {t.label} <span className="tabular opacity-70">{n}</span>
            </button>
          );
        })}
        <Link href="/schools" className="ml-auto text-accent-ink underline">Add schools</Link>
      </div>

      <section className="card relative overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              {header("name", "School", "left")}
              {header("score", "Fit score", "left", "Relative to the schools shown, using your weights")}
              {header("winPct", "Win % (5 yr)")}
              <th className="px-3 py-2 text-right font-medium">Postseason</th>
              {header("competition", `${position}s when you arrive`, "right", `Primary ${posName}s on the roster in fall ${gradYear}`)}
              <th className="px-3 py-2 text-right font-medium">Height vs {position}s</th>
              {header("cost", "Tuition & fees")}
              {header("distance", "Miles")}
              {header("coach", "Coach yrs")}
              {header("apr", "APR")}
              <th className="px-3 py-2"><span className="sr-only">List</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const s = scores.get(a.id);
              const p = a.position;
              return (
                <tr key={a.id} className="border-b border-line align-top last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/schools/${a.slug}`} className="font-medium hover:underline">{a.name}</Link>
                    <div className="text-xs text-ink-3">{a.division} · {a.conference}</div>
                    <form action={setTier} className="mt-1">
                      <input type="hidden" name="schoolId" value={a.id} />
                      <select
                        name="tier"
                        defaultValue={a.tier}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded border border-line bg-surface px-1 py-0.5 text-xs text-ink-2"
                        aria-label={`List for ${a.name}`}
                      >
                        {TIERS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                      </select>
                    </form>
                  </td>
                  <td className="px-3 py-2.5">
                    {s?.score == null ? "—" : (
                      <div className="flex items-center gap-2" title={FACTORS.map((f) => `${f.label}: ${s.parts[f.key] == null ? "no data" : Math.round(s.parts[f.key]! * 100)}`).join("\n")}>
                        <div className="h-2 w-24 rounded-full bg-surface-2">
                          <div className="h-2 rounded-full bg-accent" style={{ width: `${s.score}%` }} />
                        </div>
                        <span className="tabular font-medium">{s.score}</span>
                      </div>
                    )}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    <Sparkline values={a.program.seasons.map((x) => x.winPct)} label={`Win % by season: ${a.program.seasons.map((x) => `${x.year} ${formatPct(x.winPct)}`).join(", ")}`} />
                    <span className="ml-2">{formatPct(a.program.winPct)}</span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {a.program.postseasonApps}/{a.program.seasonsTracked}
                    {a.program.bestFinish && <div className="text-xs text-ink-3">Best: {a.program.bestFinish}</div>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {p.covered ? (
                      <>
                        <span className="font-medium">{p.projectedCompetition}</span>
                        {p.projectedCompetitionWithHybrids !== p.projectedCompetition && (
                          <span className="text-ink-3"> ({p.projectedCompetitionWithHybrids} w/ hybrids)</span>
                        )}
                        {a.commitDataQuality === "partial" && (
                          <div className="text-xs text-warn" title="Public commit lists for this school look incomplete">⚠ commit data partial</div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-ink-3">No {position} data yet</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {p.covered && p.heightDelta != null ? `${p.heightDelta >= 0 ? "+" : "−"}${Math.abs(p.heightDelta).toFixed(1)}"` : "—"}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {formatMoney(a.cost.tuition)}
                    <div className="text-xs text-ink-3">
                      {a.control === "private" ? "private" : a.cost.inState ? (a.cost.estimated ? "in-state rate n/a" : "in-state") : "out-of-state"}
                    </div>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{a.distanceMiles == null ? "—" : Math.round(a.distanceMiles).toLocaleString()}</td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {a.coachTenure ?? "—"}
                    {a.coachTenure != null && a.coachTenure <= 2 && <div className="text-xs text-warn">new coach</div>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right" title={a.aprNote ?? undefined}>{a.apr ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <form action={toggleSchool}>
                      <input type="hidden" name="schoolId" value={a.id} />
                      <button className="text-xs text-ink-3 hover:text-bad" aria-label={`Remove ${a.name} from list`}>Remove</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="font-medium">{positionLabel(position)}s on each roster in {athleteName}&apos;s freshman season (fall {gradYear})</h2>
        <p className="mt-1 text-sm text-ink-2">
          Players still eligible from today&apos;s roster, commits from the classes ahead, and commits in the same class.
          Fewer means more room to compete for playing time.
          {notYet.length > 0 && ` Classes of ${notYet.join(", ")} haven't started committing yet, so these numbers will grow.`}
        </p>
        <CompetitionChart rows={sorted.filter((a) => a.position.covered)} />
        {uncovered > 0 && (
          <p className="mt-2 text-xs text-ink-3">
            {uncovered} school{uncovered > 1 ? "s have" : " has"} no {posName} roster data yet and {uncovered > 1 ? "are" : "is"} left out.
          </p>
        )}
      </section>

      <details className="text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">How these numbers are calculated</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b>Fit score</b> ranks the schools shown against each other: each factor is scaled so the best school in view gets full marks and the worst gets none, then combined with your weights. Missing data is left out rather than counted as zero. Add or remove schools and the scores shift.</li>
          <li><b>{position}s when you arrive</b> counts primary-position players only: current players with eligibility left in fall {gradYear} (freshmen have 3 more seasons, sophomores 2, juniors 1), plus verbal commits in classes {gradYear - 3}–{gradYear}. Redshirts, transfers and future commits aren&apos;t predicted.</li>
          <li><b>Tuition</b> is published tuition & fees before aid or scholarships. In-state rates apply when the school is in your home state.</li>
          <li><b>Miles</b> is straight-line distance from your ZIP code; driving distance is usually 15–25% more.</li>
          <li><b>APR</b> is the NCAA Academic Progress Rate (D1 only; 1000 is perfect).</li>
        </ul>
      </details>
    </div>
  );
}
