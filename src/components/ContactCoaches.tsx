"use client";

import { useActionState, useState } from "react";
import { addRecruitingEvent, submitContact } from "@/app/actions";
import { coachEmail, CONTACT_SOURCES, mailtoLink, ROLE_LABEL, type EmailAthlete, type ShownContact } from "@/lib/coachEmail";

type Contact = ShownContact;

/**
 * The program's coaches with one-tap Email buttons. Each opens her mail app with an intro
 * already written; afterwards she can log the email in her recruiting log with one tap.
 */
export function ContactCoaches({
  contacts,
  athlete,
  school,
  questionnaire,
  checkedAt,
  source,
  athleticsUrl,
}: {
  contacts: Contact[];
  athlete: EmailAthlete;
  school: { id: number; name: string };
  questionnaire: string | null;
  checkedAt: string | null;
  source: string | null;
  athleticsUrl: string | null;
}) {
  const [opened, setOpened] = useState<Contact | null>(null);
  const inbox = contacts.find((c) => c.role === "program" && c.email);
  const anyEmail = contacts.some((c) => c.email);

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Contact the coaches</h2>
        {anyEmail ? (
          <p className="text-sm text-ink-2">
            Tap Email to open a message with {athlete.name.split(" ")[0]}&apos;s intro already written. Fill in the [add] parts
            before sending.
          </p>
        ) : (
          <p className="text-sm text-ink-2">
            We don&apos;t have {school.name}&apos;s coach emails yet.{" "}
            {athleticsUrl && (
              <>
                Most programs list them on their{" "}
                <a href={athleticsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">official athletics site ↗</a>.
              </>
            )}
          </p>
        )}
      </div>
      {anyEmail && (
      <ul className="divide-y divide-line rounded-lg border border-line">
        {contacts.map((c) => {
          // A coach without an address of their own is reached through the program inbox.
          const to = c.email ?? (c.role !== "program" ? inbox?.email : null);
          const { subject, body } = coachEmail(athlete, school.name, c.role === "program" ? null : c.name);
          return (
            <li key={c.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.name ?? ROLE_LABEL[c.role]}</div>
                <div className="text-xs text-ink-3">
                  {c.name ? c.title ?? ROLE_LABEL[c.role] : "Shared recruiting inbox the staff reads"}
                  {c.email && <span className="break-all"> · {c.email}</span>}
                  {!c.email && to && c.role !== "program" && " · via the program inbox"}
                  {c.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline">{c.phone}</a>
                    </>
                  )}
                </div>
                {c.added === "mine" && <div className="text-xs text-ink-3">Added by you · only you see it until our team checks it</div>}
                {c.added === "approved" && <div className="text-xs text-ink-3">Added by a VB Elite family · checked by our team</div>}
              </div>
              {to && (
                <a href={mailtoLink(to, subject, body)} onClick={() => setOpened(c)} className="btn-primary shrink-0 px-3 py-1.5 text-sm">
                  Email
                </a>
              )}
            </li>
          );
        })}
      </ul>
      )}
      {opened && <LogEmail key={opened.key} schoolId={school.id} contact={opened} onDone={() => setOpened(null)} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        {questionnaire && (
          <a href={questionnaire} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-1.5 text-sm">
            Fill out the recruiting questionnaire ↗
          </a>
        )}
        {contacts.some((c) => c.email && !c.added) && (
        <span>
          From the program&apos;s public staff listing{checkedAt && `, checked ${new Date(checkedAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`}.
          Staff change; if an email bounces, check{" "}
          {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="underline">the coaches page</a> : "the athletics site"}.
        </span>
        )}
      </div>
      <AddContact schoolId={school.id} schoolName={school.name} startOpen={!anyEmail} />
    </section>
  );
}

/** A form for a coach email the family found (a reply from a coach, a camp, the website). */
function AddContact({ schoolId, schoolName, startOpen }: { schoolId: number; schoolName: string; startOpen: boolean }) {
  const [state, action, pending] = useActionState(submitContact, undefined);
  // Open state lives here so the thank-you stays visible when the list above changes.
  const [open, setOpen] = useState(startOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-lg border border-line">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">+ Add a coach email you have</summary>
      <form action={action} key={state?.at ?? 0} className="space-y-3 border-t border-line p-3 text-sm">
        <p className="text-xs text-ink-3">
          Got an email from a {schoolName} coach, or found one we&apos;re missing? Add it here. You can use it right away;
          other families see it once our team checks it.
        </p>
        <input type="hidden" name="schoolId" value={schoolId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Who is it for?</span>
            <select name="role" required defaultValue="" className="input">
              <option value="" disabled>Choose…</option>
              <option value="head">Head coach</option>
              <option value="recruiting">Recruiting coordinator</option>
              <option value="assistant">Assistant coach</option>
              <option value="operations">Director of operations</option>
              <option value="program">Team / recruiting inbox (not one person)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Email address</span>
            <input name="email" type="email" required inputMode="email" autoCapitalize="off" autoCorrect="off" placeholder="coach@school.edu" className="input" />
          </label>
          <label className="block">
            <span className="label">Coach&apos;s name</span>
            <input name="name" maxLength={80} placeholder="Leave blank for a team inbox" className="input" />
          </label>
          <label className="block">
            <span className="label">Title (optional)</span>
            <input name="title" maxLength={120} placeholder="e.g. Assistant Coach / Recruiting" className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Where did you get it?</span>
            <select name="source" required defaultValue="" className="input">
              <option value="" disabled>Choose…</option>
              {CONTACT_SOURCES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
        </div>
        {state?.error && <p className="text-bad" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-good" role="status">Thanks! It&apos;s on your list now, and we&apos;ll check it for everyone else.</p>}
        <button className="btn-secondary" disabled={pending}>{pending ? "Saving…" : "Add email"}</button>
      </form>
    </details>
  );
}

function LogEmail({ schoolId, contact, onDone }: { schoolId: number; contact: Contact; onDone: () => void }) {
  const [state, action, pending] = useActionState(addRecruitingEvent, undefined);
  const who = contact.name ?? "the program";
  if (state?.ok) {
    return (
      <p className="rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">
        Logged: emailed {who} today. <button onClick={onDone} className="underline">Dismiss</button>
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name="type" value="emailed" />
      <input type="hidden" name="date" value={new Date().toLocaleDateString("en-CA")} />
      <input type="hidden" name="coachName" value={contact.name ?? ""} />
      <span className="flex-1">Sent it? Add it to her recruiting log.</span>
      <button className="btn-secondary px-3 py-1 text-sm" disabled={pending}>{pending ? "Saving…" : `Log email to ${who}`}</button>
      <button type="button" onClick={onDone} className="text-xs text-ink-3">Not now</button>
      {state?.error && <span className="w-full text-bad">{state.error}</span>}
    </form>
  );
}
