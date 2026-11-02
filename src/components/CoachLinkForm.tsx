"use client";

import { useActionState, useState } from "react";
import { createCoachConfirmation } from "@/app/actions";
import { COACH_ROLES } from "@/lib/coach";

/** Creates a coach confirmation link and helps the athlete send it from her own phone. */
export function CoachLinkForm({ athleteName }: { athleteName: string }) {
  const [state, action, pending] = useActionState(createCoachConfirmation, undefined);
  const [copied, setCopied] = useState(false);
  const first = athleteName.split(" ")[0];
  const message = state?.url
    ? `Hi ${state.coachName}, could you take two minutes to confirm what level of college volleyball you think ${first} can play? ` +
      `It helps us build a realistic list of schools. No account needed: ${state.url}`
    : "";

  if (state?.url) {
    const share = async () => {
      try {
        if (navigator.share) return await navigator.share({ text: message });
      } catch {
        return;
      }
      copy();
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
      } catch {}
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-good" role="status">Link created for {state.coachName}. Send it to them by text or email:</p>
        <textarea readOnly value={message} rows={4} className="input text-sm" aria-label="Message to send your coach" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={share}>Share…</button>
          <button type="button" className="btn-secondary" onClick={copy}>{copied ? "Copied ✓" : "Copy message"}</button>
          <a
            className="btn-secondary"
            href={`sms:?&body=${encodeURIComponent(message)}`}
          >
            Text it
          </a>
          <a
            className="btn-secondary"
            href={`mailto:?subject=${encodeURIComponent(`${first}'s college volleyball level`)}&body=${encodeURIComponent(message)}`}
          >
            Email it
          </a>
        </div>
        <p className="text-xs text-ink-3">The link works once and expires in 30 days. Their answer updates {first}&apos;s estimate automatically.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="coachName" className="label">Coach&apos;s name</label>
          <input id="coachName" name="coachName" required placeholder="e.g. Coach Smith" className="input" />
        </div>
        <div>
          <label htmlFor="coachRole" className="label">Their role</label>
          <select id="coachRole" name="coachRole" className="input" defaultValue="club">
            {COACH_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create confirmation link"}</button>
    </form>
  );
}
