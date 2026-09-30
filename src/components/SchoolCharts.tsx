"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "./ChartLegend";

const tooltipBox = "rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm";

type SeasonDatum = { year: number; winPct: number; wins: number; losses: number; postseason: string | null };

export function WinPctChart({ data }: { data: SeasonDatum[] }) {
  return (
    <div className="h-56 text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="year" tick={{ fill: "var(--text-muted)" }} stroke="var(--grid)" />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fill: "var(--text-muted)" }}
            stroke="var(--grid)"
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              const d = active && (payload?.[0]?.payload as SeasonDatum | undefined);
              if (!d) return null;
              return (
                <div className={tooltipBox}>
                  <div className="font-medium text-ink">{d.year}</div>
                  <div className="text-ink-2">
                    {d.wins}–{d.losses} ({Math.round(d.winPct * 100)}%)
                  </div>
                  <div className="text-ink-2">Postseason: {d.postseason ?? "—"}</div>
                </div>
              );
            }}
          />
          <Bar dataKey="winPct" fill="var(--series-1)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="winPct"
              position="top"
              formatter={(v) => `${Math.round(Number(v) * 100)}%`}
              fill="var(--text-secondary)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const TIMELINE = [
  { key: "currentRoster", label: "From today's roster", color: "var(--series-1)" },
  { key: "olderCommits", label: "Older commits", color: "var(--series-2)" },
  { key: "sameClass", label: "Same-class commits", color: "var(--series-3)" },
  { key: "youngerCommits", label: "Younger commits", color: "var(--series-4)" },
] as const;

type TimelineDatum = {
  season: number;
  label: string;
  currentRoster: number;
  olderCommits: number;
  sameClass: number;
  youngerCommits: number;
};

export function PositionTimelineChart({ data }: { data: TimelineDatum[] }) {
  const rows = data.map((d) => ({ ...d, x: `${d.label} · ${d.season}` }));
  return (
    <div>
      <ChartLegend items={TIMELINE} />
      <div className="h-64 text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="x" tick={{ fill: "var(--text-muted)" }} stroke="var(--grid)" />
            <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)" }} stroke="var(--grid)" />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={({ active, payload }) => {
                const d = active && (payload?.[0]?.payload as TimelineDatum | undefined);
                if (!d) return null;
                return (
                  <div className={tooltipBox}>
                    <div className="mb-1 font-medium text-ink">
                      {d.label} season (fall {d.season})
                    </div>
                    {TIMELINE.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-ink-2">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                        <span className="flex-1">{s.label}</span>
                        <span className="tabular text-ink">{d[s.key]}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {TIMELINE.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="a"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
                maxBarSize={48}
                radius={i === TIMELINE.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
