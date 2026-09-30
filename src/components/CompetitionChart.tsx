"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "./ChartLegend";
import type { SchoolAnalysis } from "@/lib/analytics";

export const SERIES = [
  { key: "returning", label: "Returning players", color: "var(--series-1)" },
  { key: "ahead", label: "Commits in classes ahead", color: "var(--series-2)" },
  { key: "same", label: "Commits in the same class", color: "var(--series-3)" },
] as const;

type Datum = { name: string; returning: number; ahead: number; same: number };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((n, p) => n + p.value, 0);
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {SERIES.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <div key={s.key} className="flex items-center gap-2 text-ink-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="tabular text-ink">{p?.value ?? 0}</span>
          </div>
        );
      })}
      <div className="mt-1 flex justify-between border-t border-line pt-1 text-ink">
        <span>Total</span>
        <span className="tabular font-medium">{total}</span>
      </div>
    </div>
  );
}

export function CompetitionChart({ rows }: { rows: SchoolAnalysis[] }) {
  if (!rows.length) return <p className="mt-4 text-sm text-ink-3">No roster data for this position yet.</p>;
  const data: Datum[] = rows.map((a) => ({
    name: a.name,
    returning: a.position.returningAtArrival,
    ahead: a.position.commitsAhead,
    same: a.position.sameClassCommits,
  }));
  const height = Math.max(160, data.length * 30 + 60);
  return (
    <div className="mt-4">
      <ChartLegend items={SERIES} />
      <div className="text-xs" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)" }} stroke="var(--grid)" />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fill: "var(--text-secondary)" }}
              stroke="var(--grid)"
              interval={0}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="a"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={24}
                radius={i === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
