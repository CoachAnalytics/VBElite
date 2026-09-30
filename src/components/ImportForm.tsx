"use client";

import { useActionState } from "react";
import { importWorkbook } from "@/app/admin/actions";
import { DIVISIONS } from "@/lib/positions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importWorkbook, undefined);
  const year = new Date().getFullYear();
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <label htmlFor="file" className="label">Workbook (.xlsx)</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="division" className="label">Division</label>
          <select id="division" name="division" defaultValue="D1" className="input">
            {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="homeState" className="label">Tuition priced for</label>
          <input id="homeState" name="homeState" defaultValue="OH" maxLength={2} className="input uppercase" aria-describedby="homeState-help" />
          <p id="homeState-help" className="mt-1 text-xs text-ink-3">State of the student the tuition column assumes</p>
        </div>
        <div>
          <label htmlFor="rosterSeason" className="label">Roster season</label>
          <input id="rosterSeason" name="rosterSeason" type="number" defaultValue={year} className="input" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.summary && (
        <p className="text-sm text-good" role="status">
          Imported {state.fileName}: {state.summary.schools} schools, {state.summary.seasons} seasons,{" "}
          {state.summary.roster} roster players, {state.summary.commits} commits.
          {state.summary.missingGeo.length > 0 && (
            <span className="block text-warn">No map location found for: {state.summary.missingGeo.join(", ")}</span>
          )}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Importing…" : "Upload and import"}
      </button>
    </form>
  );
}
