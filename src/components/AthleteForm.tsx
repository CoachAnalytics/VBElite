"use client";

import { useActionState } from "react";
import { saveAthlete } from "@/app/actions";
import type { Athlete } from "@/db/schema";
import { formatHeight } from "@/lib/format";
import { POSITIONS } from "@/lib/positions";

export function AthleteForm({ athlete }: { athlete: Athlete | null }) {
  const [state, action, pending] = useActionState(saveAthlete, undefined);
  const year = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => year + i);
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <label htmlFor="name" className="label">Athlete name</label>
        <input id="name" name="name" required defaultValue={athlete?.name} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gradYear" className="label">High school graduation year</label>
          <select id="gradYear" name="gradYear" required defaultValue={athlete?.gradYear ?? year + 3} className="input">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="position" className="label">Primary position</label>
          <select id="position" name="position" required defaultValue={athlete?.position ?? "OH"} className="input">
            {POSITIONS.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="height" className="label">Height</label>
          <input
            id="height"
            name="height"
            placeholder={`e.g. 6'0"`}
            defaultValue={athlete?.heightIn ? formatHeight(athlete.heightIn) : ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="homeZip" className="label">Home ZIP code</label>
          <input
            id="homeZip"
            name="homeZip"
            inputMode="numeric"
            pattern="\d{5}"
            required
            defaultValue={athlete?.homeZip}
            className="input"
          />
          {athlete?.homeCity && (
            <p className="mt-1 text-xs text-ink-3">{athlete.homeCity}, {athlete.homeState}</p>
          )}
        </div>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-good" role="status">Saved.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : athlete ? "Save changes" : "Save and choose schools"}
      </button>
    </form>
  );
}
