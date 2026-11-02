import Link from "next/link";
import { addRecommended, deleteRecruitingEvent } from "../actions";
import { programLevels } from "@/lib/recommend";
import { EVENT_TYPES, eventInfo, schoolStatuses, similarSchools } from "@/lib/recruiting";
import { getRecommendationData, getRecruitingEvents, getSavedSchools, requireOnboarded, schoolNames } from "@/lib/queries";
import { RecruitingEventForm } from "@/components/RecruitingEventForm";

// Dates are stored as calendar days (midnight UTC), so show them in UTC.
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const STAGE_STYLE: Record<number, string> = {
  0: "bg-surface-2 text-ink-3",
  1: "bg-surface-2 text-ink-2",
  2: "bg-accent/10 text-accent-ink",
  3: "bg-accent/15 text-accent-ink",
  4: "bg-good/10 text-good",
  5: "bg-good/15 text-good",
  6: "bg-good/25 text-good font-semibold",
  7: "bg-good/25 text-good font-semibold",
};

export default async function RecruitingPage() {
  const { athlete } = await requireOnboarded();
  const [events, names, { schools }, saved] = await Promise.all([
    getRecruitingEvents(athlete.id),
    schoolNames(),
    getRecommendationData(athlete.position, athlete.gradYear),
    getSavedSchools(athlete.id),
  ]);
  const first = athlete.name.split(" ")[0];
  const statuses = schoolStatuses(events);
  const nameOf = new Map(events.map((e) => [e.schoolId, { name: e.schoolName, slug: e.schoolSlug }]));
  const similar = similarSchools(statuses, schools, programLevels(schools));
  const savedIds = new Set(saved.map((s) => s.schoolId));
  const counts = EVENT_TYPES.filter((t) => t.value !== "declined").map((t) => ({
    ...t,
    n: statuses.filter((s) => !s.declined && s.stage >= t.stage).length,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{first}&apos;s recruiting</h1>
        <p className="mt-1 text-sm text-ink-2">
          Log every step: emails she sends, coach replies, camp invites, visits and offers. You&apos;ll see where each school
          stands, and we&apos;ll suggest similar programs to reach out to. Only your account can see this.
        </p>
      </div>

      <RecruitingEventForm schools={names} />

      {statuses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Where each school stands</h2>
          <div className="flex flex-wrap gap-2 text-xs text-ink-2">
            {[1, 2, 3, 4, 6].map((stage) => {
              const c = counts.find((x) => x.stage === stage)!;
              return <span key={stage} className="rounded-full border border-line px-2.5 py-1">{c.short}{stage > 1 ? " or further" : ""}: <b>{c.n}</b></span>;
            })}
          </div>
          <div className="card divide-y divide-line">
            {statuses.map((s) => {
              const info = eventInfo(s.type);
              const school = nameOf.get(s.schoolId)!;
              return (
                <div key={s.schoolId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <Link href={`/schools/${school.slug}`} className="font-medium hover:underline">{school.name}</Link>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-ink-3">{day(s.lastDate)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${STAGE_STYLE[s.stage]}`}>{info.short}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Similar schools to target</h2>
          <p className="text-sm text-ink-2">
            Programs like the ones showing {first} real interest (a coach reply or more): similar level, same conference or
            region, similar size and academics.
          </p>
        </div>
        {similar.length === 0 ? (
          <p className="card p-4 text-sm text-ink-3">
            Suggestions appear once a coach replies, invites her to camp, or more. Log those updates above.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {similar.map((r) => (
              <div key={r.school.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/schools/${r.school.slug}`} className="font-medium hover:underline">{r.school.name}</Link>
                    <div className="text-xs text-ink-3">{[r.school.city, r.school.state].filter(Boolean).join(", ")} · {r.school.conference}</div>
                  </div>
                  {savedIds.has(r.school.id) ? (
                    <span className="shrink-0 text-xs text-good">✓ On my list</span>
                  ) : (
                    <form action={addRecommended}>
                      <input type="hidden" name="pick" value={`${r.school.id}:target`} />
                      <button className="btn-secondary shrink-0 px-2.5 py-1 text-xs">+ Add</button>
                    </form>
                  )}
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-ink-2">
                  {r.reasons.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {events.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Full log</h2>
          <ol className="card divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <div>
                    <span className="font-medium">{e.schoolName}</span> · {eventInfo(e.type).label}
                    {e.coachName && <span className="text-ink-2"> · {e.coachName}</span>}
                  </div>
                  <div className="text-xs text-ink-3">{day(e.date)}{e.note && ` · ${e.note}`}</div>
                </div>
                <form action={deleteRecruitingEvent}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-xs text-ink-3 hover:text-bad" aria-label={`Delete this ${e.schoolName} entry`}>Delete</button>
                </form>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
