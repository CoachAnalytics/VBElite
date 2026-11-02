"use client";

import { useActionState } from "react";
import { saveAthlete } from "@/app/actions";
import type { Athlete } from "@/db/schema";
import { formatHeight } from "@/lib/format";
import { POSITIONS } from "@/lib/positions";
import { DataNotice } from "./DataNotice";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AthleteForm({ athlete }: { athlete: Athlete | null }) {
  const [state, action, pending] = useActionState(saveAthlete, undefined);
  const year = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => year + i);
  // After an error, refill the fields with what was typed (the form resets on submit).
  const v = state?.values;
  return (
    <form action={action} key={state?.at ?? 0} className="card space-y-4 p-5">
      <div>
        <label htmlFor="name" className="label">Athlete name</label>
        <input id="name" name="name" required defaultValue={v?.name ?? athlete?.name} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gradYear" className="label">High school graduation year</label>
          <select id="gradYear" name="gradYear" required defaultValue={v?.gradYear ?? athlete?.gradYear ?? year + 3} className="input">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="position" className="label">Primary position</label>
          <select id="position" name="position" required defaultValue={v?.position ?? athlete?.position ?? "OH"} className="input">
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
            placeholder={`e.g. 5'10"`}
            autoCorrect="off"
            autoCapitalize="off"
            defaultValue={v?.height ?? (athlete?.heightIn ? formatHeight(athlete.heightIn) : "")}
            className="input"
          />
        </div>
        <div>
          <span className="label">Birth month and year <span className="font-normal text-ink-3">(optional)</span></span>
          <div className="flex gap-2">
            <select name="birthMonth" aria-label="Birth month" defaultValue={v?.birthMonth ?? athlete?.birthMonth ?? ""} className="input">
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select name="birthYear" aria-label="Birth year" defaultValue={v?.birthYear ?? athlete?.birthYear ?? ""} className="input">
              <option value="">Year</option>
              {Array.from({ length: 10 }, (_, i) => year - 19 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-ink-3">Lets us compare her to elite players her exact age. Only the month and year are kept.</p>
        </div>
        <div>
          <label htmlFor="homeZip" className="label">Home ZIP code</label>
          <input
            id="homeZip"
            name="homeZip"
            inputMode="numeric"
            pattern="\d{5}"
            required
            defaultValue={v?.homeZip ?? athlete?.homeZip}
            className="input"
          />
          {athlete?.homeCity && (
            <p className="mt-1 text-xs text-ink-3">{athlete.homeCity}, {athlete.homeState}</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="maxprepsUrl" className="label">MaxPreps page <span className="font-normal text-ink-3">(optional)</span></label>
        <input
          id="maxprepsUrl"
          name="maxprepsUrl"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="https://www.maxpreps.com/…/athletes/…"
          defaultValue={v?.maxprepsUrl ?? athlete?.maxprepsUrl ?? ""}
          className="input"
        />
        <p className="mt-1 text-xs text-ink-3">Coaches can click through to her stats from your emails.</p>
      </div>
      <DataNotice what="Height, age and position" />
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-good" role="status">Saved.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : athlete ? "Save changes" : "Save and choose schools"}
      </button>
    </form>
  );
}
