"use client";

import { useActionState, useState } from "react";
import { addRecruitingEvent } from "@/app/actions";
import { coachEmail, mailtoLink, ROLE_LABEL, type EmailAthlete } from "@/lib/coachEmail";

type Contact = { id: number; name: string | null; title: string | null; role: string; email: string | null; phone: string | null };

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
}: {
  contacts: Contact[];
  athlete: EmailAthlete;
  school: { id: number; name: string };
  questionnaire: string | null;
  checkedAt: string | null;
  source: string | null;
}) {
  const [opened, setOpened] = useState<Contact | null>(null);
  const inbox = contacts.find((c) => c.role === "program" && c.email);

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Contact the coaches</h2>
        <p className="text-sm text-ink-2">
          Tap Email to open a message with {athlete.name.split(" ")[0]}&apos;s intro already written. Fill in the [add] parts
          before sending.
        </p>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {contacts.map((c) => {
          // A coach without an address of their own is reached through the program inbox.
          const to = c.email ?? (c.role !== "program" ? inbox?.email : null);
          const { subject, body } = coachEmail(athlete, school.name, c.role === "program" ? null : c.name);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
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
      {opened && <LogEmail key={opened.id} schoolId={school.id} contact={opened} onDone={() => setOpened(null)} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        {questionnaire && (
          <a href={questionnaire} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-1.5 text-sm">
            Fill out the recruiting questionnaire ↗
          </a>
        )}
        <span>
          From the program&apos;s public staff listing{checkedAt && `, checked ${new Date(checkedAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`}.
          Staff change; if an email bounces, check{" "}
          {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="underline">the coaches page</a> : "the athletics site"}.
        </span>
      </div>
    </section>
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
