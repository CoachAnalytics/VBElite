"use client";

import Link from "next/link";
import { useState } from "react";
import { CLASS_YEARS, type SchoolAnalysis } from "@/lib/analytics";
import { formatHeight, formatMoney, formatPct } from "@/lib/format";
import { POSITIONS, positionLabel } from "@/lib/positions";

type View = "breakdown" | "pipeline" | "grid";
type Cell = string | number | null;
type Column = { label: string; title?: string; value: (a: SchoolAnalysis) => Cell; show?: (a: SchoolAnalysis) => React.ReactNode; left?: boolean };

const VIEWS: { key: View; label: string }[] = [
  { key: "breakdown", label: "Roster by position" },
  { key: "pipeline", label: "Recruiting pipeline" },
  { key: "grid", label: "Full comparison" },
];

function downloadCsv(name: string, columns: Column[], rows: SchoolAnalysis[]) {
  const esc = (v: Cell) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)), ...rows.map((r) => columns.map((c) => esc(c.value(r))))];
  const blob = new Blob([lines.map((l) => l.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const record = (w: number | null, l: number | null) => (w == null ? null : `${w}-${l}`);

/** Spreadsheet-style views across the saved schools, for any position. */
export function CompareTables({ analyses, defaultPosition }: { analyses: SchoolAnalysis[]; defaultPosition: string }) {
  const [view, setView] = useState<View>("breakdown");
  const [pos, setPos] = useState(defaultPosition);
  const rows = [...analyses].sort((a, b) => a.name.localeCompare(b.name));
  const classes = rows[0]?.pipeline.classes ?? [];
  const years = [...new Set(rows.flatMap((a) => a.program.seasons.map((s) => s.year)))].sort();
  const posCovered = (a: SchoolAnalysis) => a.coveredPositions.includes(pos);
  const group = (a: SchoolAnalysis) => a.breakdown.find((g) => g.position === pos);
  const pipe = (a: SchoolAnalysis) => a.pipeline.rows.find((r) => r.position === pos);
  const incoming = (a: SchoolAnalysis) => pipe(a)?.total ?? 0;
  const incomingRange = rows.filter(posCovered).map(incoming);
  const lo = Math.min(...incomingRange);
  const hi = Math.max(...incomingRange);
  // Fewer incoming players at the position = more room (green); the most = red.
  const roomClass = (a: SchoolAnalysis) => {
    if (!posCovered(a) || hi === lo) return "";
    const n = incoming(a);
    return n === lo ? "text-good font-semibold" : n === hi ? "text-bad font-semibold" : "";
  };
  const noData = (a: SchoolAnalysis) => (posCovered(a) ? null : "no data");

  const school: Column = {
    label: "School",
    left: true,
    value: (a) => a.name,
    show: (a) => (
      <>
        <Link href={`/schools/${a.slug}`} className="font-medium hover:underline">{a.name}</Link>
        <div className="text-xs text-ink-3">{a.conference}</div>
      </>
    ),
  };

  const columns: Record<View, Column[]> = {
    breakdown: [
      school,
      ...CLASS_YEARS.map((c): Column => ({ label: c === "Grad" ? "Grad / 5th" : c, value: (a) => noData(a) ?? group(a)?.byClass[c] ?? 0 })),
      { label: `Total ${pos}`, value: (a) => noData(a) ?? group(a)?.total ?? 0 },
      { label: "Redshirt", value: (a) => noData(a) ?? group(a)?.redshirts ?? 0 },
      { label: `Leaving after ${rows[0]?.rosterSeason ?? ""}`, value: (a) => noData(a) ?? group(a)?.leaving ?? 0 },
      { label: "Hybrids", title: "Listed at more than one position", value: (a) => noData(a) ?? group(a)?.hybrids ?? 0 },
      { label: `Avg ${pos} height`, value: (a) => (posCovered(a) ? formatHeight(group(a)?.avgHeight) : null) },
      { label: `Shortest ${pos}`, value: (a) => (posCovered(a) ? formatHeight(group(a)?.shortest?.heightIn) : null) },
      { label: "Roster size", value: (a) => a.rosterCount || null },
    ],
    pipeline: [
      school,
      ...classes.map((y): Column => ({ label: `${y} ${pos}`, value: (a) => noData(a) ?? pipe(a)?.byClass[y] ?? 0 })),
      {
        label: `Incoming ${pos} (${classes[0]}–${String(classes.at(-1)).slice(2)})`,
        value: (a) => noData(a) ?? incoming(a),
        show: (a) => <span className={roomClass(a)}>{posCovered(a) ? incoming(a) : "no data"}</span>,
      },
      {
        label: "+ hybrids",
        title: `Commits who list ${pos} as a second position`,
        value: (a) => noData(a) ?? classes.reduce((n, y) => n + (pipe(a)?.hybridByClass[y] ?? 0), 0),
      },
      { label: `Avg incoming ${pos} height`, value: (a) => (posCovered(a) ? formatHeight(pipe(a)?.avgHeight) : null) },
      ...classes.slice(0, 2).map((y): Column => ({
        label: `Other-position commits ${y}`,
        value: (a) => a.pipeline.totalByClass[y] - (pipe(a)?.byClass[y] ?? 0),
      })),
      { label: "Total commits found", value: (a) => a.pipeline.total },
      { label: `Current ${pos} on roster`, value: (a) => noData(a) ?? group(a)?.total ?? 0 },
      {
        label: "Data completeness",
        value: (a) => (a.commitDataQuality === "good" ? "Good" : "Partial"),
        show: (a) => (a.commitDataQuality === "good" ? "Good" : <span className="text-warn">Partial</span>),
      },
    ],
    grid: [
      school,
      { label: "City", left: true, value: (a) => a.city },
      { label: "State", left: true, value: (a) => a.state },
      { label: "Conference", left: true, value: (a) => a.conference },
      { label: "Undergrads", value: (a) => a.enrollment, show: (a) => a.enrollment?.toLocaleString() ?? "—" },
      { label: "Miles from home", value: (a) => (a.distanceMiles == null ? null : Math.round(a.distanceMiles)) },
      ...years.map((y): Column => ({
        label: `${y} record`,
        value: (a) => {
          const s = a.program.seasons.find((x) => x.year === y);
          return s ? record(s.wins, s.losses) : null;
        },
      })),
      { label: "5-yr W", value: (a) => a.program.wins },
      { label: "5-yr L", value: (a) => a.program.losses },
      { label: "5-yr win %", value: (a) => (a.program.winPct == null ? null : Math.round(a.program.winPct * 1000) / 10), show: (a) => formatPct(a.program.winPct, 1) },
      ...years.map((y): Column => ({
        label: `${y} NCAA`,
        left: true,
        value: (a) => a.program.seasons.find((x) => x.year === y)?.postseason ?? null,
      })),
      { label: "NCAA apps", value: (a) => a.program.postseasonApps },
      { label: "Volleyball APR", value: (a) => a.apr, show: (a) => <span title={a.aprNote ?? undefined}>{a.apr ?? "—"}</span> },
      { label: "Head coach", left: true, value: (a) => a.headCoach },
      {
        label: "Coach since",
        value: (a) => a.coachSince,
        show: (a) => <span className={a.coachTenure != null && a.coachTenure <= 2 ? "text-warn font-medium" : ""}>{a.coachSince ?? "—"}</span>,
      },
      { label: "Tuition in-state", value: (a) => a.tuitionInState, show: (a) => formatMoney(a.tuitionInState) },
      { label: "Tuition out-of-state", value: (a) => a.tuitionOutState, show: (a) => formatMoney(a.tuitionOutState) },
      { label: "Your tuition", value: (a) => a.cost.tuition, show: (a) => formatMoney(a.cost.tuition) },
      { label: "Avg net price", value: (a) => a.avgNetPrice, show: (a) => formatMoney(a.avgNetPrice) },
      { label: "Cost of attendance", value: (a) => a.costOfAttendance, show: (a) => formatMoney(a.costOfAttendance) },
      { label: "Admission rate", value: (a) => a.admissionRate, show: (a) => formatPct(a.admissionRate) },
      { label: "Avg SAT", value: (a) => a.satAvg },
      { label: "ACT range", value: (a) => (a.act25 != null ? `${a.act25}-${a.act75}` : null) },
      { label: "Grad rate", value: (a) => a.graduationRate, show: (a) => formatPct(a.graduationRate) },
      { label: "Retention", value: (a) => a.retentionRate, show: (a) => formatPct(a.retentionRate) },
      { label: "Median earnings", value: (a) => a.medianEarnings, show: (a) => formatMoney(a.medianEarnings) },
    ],
  };

  const cols = columns[view];
  const posPicker = view !== "grid";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line p-0.5 text-sm" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={`rounded px-3 py-1.5 ${view === v.key ? "bg-accent text-accent-contrast" : "text-ink-2 hover:bg-surface-2"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {posPicker && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Position
            <select value={pos} onChange={(e) => setPos(e.target.value)} className="input w-auto py-1.5">
              {POSITIONS.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </label>
        )}
        <button
          className="btn-secondary ml-auto"
          onClick={() => downloadCsv(`vbelite-${view}${posPicker ? `-${pos}` : ""}.csv`, cols, rows)}
        >
          Download for Excel
        </button>
      </div>
      {view === "pipeline" && (
        <p className="text-sm text-ink-2">
          {positionLabel(pos)} commits in the next three classes. Green marks the school with the fewest incoming
          {" "}{pos}s (most room), red the most. Hybrids (e.g. OH/DS) are counted separately. &quot;Partial&quot; means
          public commit lists for that school look incomplete.
        </p>
      )}
      {view === "breakdown" && (
        <p className="text-sm text-ink-2">
          {positionLabel(pos)}s on each current roster by class. Schools marked &quot;no data&quot; don&apos;t have position
          data yet.
        </p>
      )}
      <div className="card relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              {cols.map((c, i) => (
                <th
                  key={c.label}
                  title={c.title}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${c.left ? "text-left" : "text-right"} ${i === 0 ? "sticky left-0 z-10 bg-surface" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                {cols.map((c, i) => {
                  const v = c.value(a);
                  return (
                    <td
                      key={c.label}
                      className={`whitespace-nowrap px-3 py-2 ${c.left ? "text-left" : "tabular text-right"} ${i === 0 ? "sticky left-0 z-10 bg-surface" : ""} ${v === "no data" ? "text-xs text-ink-3" : ""}`}
                    >
                      {c.show ? c.show(a) : v ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
