"use client";

import { useActionState, useState } from "react";
import { saveSeason } from "@/app/actions";
import { parseStatsPaste, seasonLabel, STAT_FIELDS, TEAM_LEVELS, type ParsedRow, type StatKey } from "@/lib/stats";
import { DataNotice } from "./DataNotice";

/** Season stats entry: paste from her MaxPreps page (we read the columns) or type them in. */
export function SeasonForm({ seasons, defaultSeason, maxprepsUrl }: { seasons: number[]; defaultSeason: number; maxprepsUrl: string | null }) {
  const [state, action, pending] = useActionState(saveSeason, undefined);
  return <Fields key={state?.at ?? 0} {...{ seasons, defaultSeason, maxprepsUrl, action, pending, state }} />;
}

function seasonFromLabel(label: string | null): number | null {
  const m = label?.match(/(?:^|\D)(20)?(\d{2})\s*[-–/]\s*\d{2}(?:\D|$)/) ?? label?.match(/(?:^|\D)(20)(\d{2})(?:\D|$)/);
  return m ? 2000 + Number(m[2]) : null;
}

function levelFromLabel(label: string | null): string | null {
  if (!label) return null;
  if (/\bjv\b|junior varsity/i.test(label)) return "jv";
  if (/fresh/i.test(label)) return "freshman";
  if (/club/i.test(label)) return "club";
  if (/varsity/i.test(label)) return "varsity";
  return null;
}

function Fields({
  seasons,
  defaultSeason,
  maxprepsUrl,
  action,
  pending,
  state,
}: {
  seasons: number[];
  defaultSeason: number;
  maxprepsUrl: string | null;
  action: (f: FormData) => void;
  pending: boolean;
  state: Awaited<ReturnType<typeof saveSeason>>;
}) {
  const [values, setValues] = useState<Partial<Record<StatKey, string>>>({});
  const [season, setSeason] = useState(String(defaultSeason));
  const [level, setLevel] = useState("varsity");
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [source, setSource] = useState<"typed" | "pasted">("typed");

  const applyRow = (row: ParsedRow) => {
    setValues(Object.fromEntries(Object.entries(row.values).map(([k, v]) => [k, String(v)])));
    const s = seasonFromLabel(row.label);
    if (s && seasons.includes(s)) setSeason(String(s));
    const l = levelFromLabel(row.label);
    if (l) setLevel(l);
    setSource("pasted");
  };
  const read = () => {
    const found = parseStatsPaste(paste).filter((r) => r.label !== "Career");
    setRows(found);
    if (found.length) applyRow(found[found.length - 1]);
  };

  return (
    <form action={action} className="card space-y-4 p-4">
      <h2 className="font-medium">Add a season</h2>

      <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
        <p className="text-ink-2">
          <b>Fastest:</b> open her stats on MaxPreps
          {maxprepsUrl && (
            <>
              {" "}
              (<a href={maxprepsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">her page ↗</a>)
            </>
          )}
          , select the season stats tables, copy, and paste them here. You can paste several tables at once.
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={4}
          placeholder="Paste stats here"
          className="input font-mono text-xs"
          aria-label="Paste stats"
        />
        <button type="button" onClick={read} disabled={!paste.trim()} className="btn-secondary px-3 py-1.5 text-sm">
          Read stats
        </button>
        {rows && rows.length === 0 && (
          <p className="text-bad" role="alert">We couldn&apos;t find stats in that text. Make sure the column headers (like K, D, SA) are included, or type the numbers below.</p>
        )}
        {rows && rows.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-3">Found {rows.length} rows. Use:</span>
            {rows.map((r, i) => (
              <button key={i} type="button" onClick={() => applyRow(r)} className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:bg-surface">
                {r.label ?? `Row ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {rows && rows.length > 0 && <p className="text-good">Filled in below. Check the numbers, then save.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Season</span>
          <select name="season" value={season} onChange={(e) => setSeason(e.target.value)} className="input">
            {seasons.map((s) => <option key={s} value={s}>{seasonLabel(s)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Team</span>
          <select name="level" value={level} onChange={(e) => setLevel(e.target.value)} className="input">
            {TEAM_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="label text-xs">{f.label} <span className="font-normal text-ink-3">({f.short})</span></span>
            <input
              name={f.key}
              inputMode="numeric"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d]/g, "") }))}
              className="input"
            />
          </label>
        ))}
      </div>
      <input type="hidden" name="source" value={source} />
      <p className="text-xs text-ink-3">Leave blank anything you don&apos;t have. Hitting % and per-set numbers are calculated for you.</p>
      <DataNotice what="Stats" />
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-good" role="status">Saved.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save season"}</button>
    </form>
  );
}
