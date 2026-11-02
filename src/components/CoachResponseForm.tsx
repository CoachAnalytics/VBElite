"use client";

import { useActionState, useState } from "react";
import { submitCoachResponse } from "@/app/actions";
import { LEVELS, ROLES } from "@/lib/coach";

function Choice({ name, options, required }: { name: string; options: readonly { value: string; label: string }[]; required?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
          <input type="radio" name={name} value={o.value} required={required} className="accent-[var(--accent)]" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function CoachResponseForm({
  token,
  coachName,
  athleteFirst,
  listedHeight,
}: {
  token: string;
  coachName: string;
  athleteFirst: string;
  listedHeight: string | null;
}) {
  const [state, action, pending] = useActionState(submitCoachResponse, undefined);
  const [heightRight, setHeightRight] = useState("yes");

  if (state?.done) {
    return (
      <div className="card space-y-2 p-6 text-center">
        <p className="text-lg font-medium">Thank you, coach.</p>
        <p className="text-sm text-ink-2">Your answers have been sent to {athleteFirst}&apos;s VB Elite profile. You can close this page.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      <fieldset className="space-y-2">
        <legend className="font-medium">What level of college volleyball do you think {athleteFirst} can play?</legend>
        <p className="text-sm text-ink-3">Your honest view helps her family focus on programs where she&apos;ll fit and play.</p>
        <Choice name="level" options={LEVELS} required />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-medium">Her role on your team this season</legend>
        <Choice name="role" options={ROLES} required />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="font-medium">Is her listed height right?{listedHeight && <span className="font-normal text-ink-2"> ({listedHeight})</span>}</legend>
        <div className="flex gap-2">
          {[["yes", "Yes"], ["no", "No"]].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="radio" name="heightRight" value={v} checked={heightRight === v} onChange={() => setHeightRight(v)} className="accent-[var(--accent)]" />
              {l}
            </label>
          ))}
        </div>
        {heightRight === "no" && (
          <input name="height" placeholder={`Her height, e.g. 5'10"`} autoCorrect="off" className="input max-w-xs" aria-label="Her actual height" />
        )}
      </fieldset>
      <div>
        <label htmlFor="note" className="label">A note for her family (optional)</label>
        <textarea id="note" name="note" rows={3} maxLength={600} className="input" placeholder="Strengths, what to work on, programs you'd suggest…" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="coachName" className="label">Your name</label>
          <input id="coachName" name="coachName" required defaultValue={coachName} className="input" />
        </div>
        <div>
          <label htmlFor="club" className="label">Club or school (optional)</label>
          <input id="club" name="club" className="input" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send to her family"}</button>
    </form>
  );
}
