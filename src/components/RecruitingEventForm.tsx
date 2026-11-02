"use client";

import { useActionState, useState } from "react";
import { addRecruitingEvent } from "@/app/actions";
import { EVENT_TYPES } from "@/lib/recruiting";

type School = { id: number; name: string };

export function RecruitingEventForm({ schools }: { schools: School[] }) {
  const [state, action, pending] = useActionState(addRecruitingEvent, undefined);
  // Re-mount after each save so every field clears for the next entry.
  return <EventFields key={state?.at ?? 0} schools={schools} action={action} pending={pending} state={state} />;
}

function EventFields({
  schools,
  action,
  pending,
  state,
}: {
  schools: School[];
  action: (form: FormData) => void;
  pending: boolean;
  state: Awaited<ReturnType<typeof addRecruitingEvent>>;
}) {
  const [schoolText, setSchoolText] = useState("");
  const match = schools.find((s) => s.name.toLowerCase() === schoolText.trim().toLowerCase());
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="font-medium">Add an update</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="school" className="label">School</label>
          <input
            id="school"
            list="school-names"
            value={schoolText}
            onChange={(e) => setSchoolText(e.target.value)}
            placeholder="Start typing a school"
            autoComplete="off"
            required
            className="input"
          />
          <datalist id="school-names">
            {schools.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
          <input type="hidden" name="schoolId" value={match?.id ?? ""} />
          {schoolText && !match && <p className="mt-1 text-xs text-ink-3">Pick a D1 school from the list.</p>}
        </div>
        <div>
          <label htmlFor="type" className="label">What happened</label>
          <select id="type" name="type" required defaultValue="" className="input">
            <option value="" disabled>Choose…</option>
            {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="label">Date</label>
          <input id="date" name="date" type="date" defaultValue={today} max={today} required className="input" />
        </div>
        <div>
          <label htmlFor="coachName" className="label">Coach (optional)</label>
          <input id="coachName" name="coachName" placeholder="e.g. Coach Lee, assistant" className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="note" className="label">Note (optional)</label>
        <input id="note" name="note" maxLength={500} placeholder="e.g. Asked for her club schedule" className="input" />
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-good" role="status">Saved.</p>}
      <button className="btn-primary" disabled={pending || !match}>{pending ? "Saving…" : "Add to log"}</button>
    </form>
  );
}
