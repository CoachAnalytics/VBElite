import Link from "next/link";
import { addRecommended, deleteRecruitingEvent, toggleSchool } from "../actions";
import { programLevels } from "@/lib/recommend";
import { EVENT_TYPES, eventInfo, schoolStatuses, similarSchools } from "@/lib/recruiting";
import { getRecommendationData, getRecruitingEvents, getSavedSchools, requireOnboarded, schoolNames } from "@/lib/queries";
import { TIERS, tierLabel } from "@/lib/tiers";
import { OpenFromHash } from "@/components/OpenFromHash";
import { RecruitingEventForm } from "@/components/RecruitingEventForm";
import { TierSelect } from "@/components/TierSelect";

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

const TIER_ORDER = new Map<string, number>(TIERS.map((t, i) => [t.code, i]));

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
  const similar = similarSchools(statuses, schools, programLevels(schools));
  const savedIds = new Set(saved.map((s) => s.schoolId));
  const infoOf = new Map(schools.map((s) => [s.id, s]));
  const statusOf = new Map(statuses.map((s) => [s.schoolId, s]));
  const tierOf = new Map(saved.map((s) => [s.schoolId, s.tier]));
  // One list: every school she saved, plus any she has logged since removing it.
  const list = [...new Set([...saved.map((s) => s.schoolId), ...statuses.map((s) => s.schoolId)])]
    .filter((id) => infoOf.has(id))
    .map((id) => ({
      school: infoOf.get(id)!,
      status: statusOf.get(id) ?? null,
      tier: tierOf.get(id) ?? null,
      events: events.filter((e) => e.schoolId === id),
    }))
    .sort(
      (a, b) =>
        (b.status ? (b.status.declined ? 0.5 : b.status.stage + 1) : 0) - (a.status ? (a.status.declined ? 0.5 : a.status.stage + 1) : 0) ||
        (b.status?.lastDate.getTime() ?? 0) - (a.status?.lastDate.getTime() ?? 0) ||
        (TIER_ORDER.get(a.tier ?? "") ?? 9) - (TIER_ORDER.get(b.tier ?? "") ?? 9) ||
        a.school.name.localeCompare(b.school.name),
    );
  const counts = EVENT_TYPES.filter((t) => t.value !== "declined").map((t) => ({
    ...t,
    n: statuses.filter((s) => !s.declined && s.stage >= t.stage).length,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{first}&apos;s schools</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every school on her list, and where each one stands. Tap a school to see its history and log the next step: an
          email she sent, a coach reply, a camp invite, a visit or an offer. Only your account can see this.
        </p>
      </div>
      <OpenFromHash />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-semibold">My list <span className="text-base font-normal text-ink-3">({list.length})</span></h2>
          {list.length > 1 && <Link href="/compare" className="text-sm text-accent-ink underline">Compare side by side</Link>}
        </div>
        {statuses.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-ink-2">
            {[1, 2, 3, 4, 6].map((stage) => {
              const c = counts.find((x) => x.stage === stage)!;
              return <span key={stage} className="rounded-full border border-line px-2.5 py-1">{c.short}{stage > 1 ? " or further" : ""}: <b>{c.n}</b></span>;
            })}
          </div>
        )}
        {list.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-2">
            Her list is empty. Add schools from <Link href="/recommendations" className="text-accent-ink underline">For you</Link> or{" "}
            <Link href="/schools" className="text-accent-ink underline">Schools</Link>, or log an update below.
          </div>
        ) : (
          <div className="card divide-y divide-line">
            {list.map(({ school, status, tier, events: log }) => (
              <details key={school.id} id={school.slug} className="group scroll-mt-20">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{school.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {[tier ? tierLabel(tier) : "Not on list", school.conference, status && day(status.lastDate)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${status ? STAGE_STYLE[status.stage] : "border border-line text-ink-3"}`}>
                    {status ? eventInfo(status.type).short : "No contact yet"}
                  </span>
                  <span aria-hidden className="shrink-0 text-ink-3 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-4 border-t border-line bg-surface-2/40 px-4 py-4">
                  {log.length === 0 ? (
                    <p className="text-sm text-ink-3">Nothing logged with {school.name} yet.</p>
                  ) : (
                    <ol className="relative space-y-3 border-l border-line pl-4">
                      {log.map((e) => (
                        <li key={e.id} className="relative text-sm">
                          <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{eventInfo(e.type).label}</div>
                              <div className="text-xs text-ink-3">
                                {day(e.date)}
                                {e.coachName && ` · ${e.coachName}`}
                              </div>
                              {e.note && <div className="mt-0.5 text-ink-2">{e.note}</div>}
                            </div>
                            <form action={deleteRecruitingEvent}>
                              <input type="hidden" name="id" value={e.id} />
                              <button className="text-xs text-ink-3 hover:text-bad" aria-label={`Delete this ${school.name} entry`}>Delete</button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  <RecruitingEventForm school={{ id: school.id, name: school.name }} title={`Log the next step with ${school.name}`} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
                    <Link href={`/schools/${school.slug}`} className="text-accent-ink underline">School details</Link>
                    {tier ? (
                      <>
                        <TierSelect schoolId={school.id} tier={tier} label={`List for ${school.name}`} />
                        <form action={toggleSchool}>
                          <input type="hidden" name="schoolId" value={school.id} />
                          <button className="text-ink-3 hover:text-bad">Remove from list</button>
                        </form>
                      </>
                    ) : (
                      <form action={toggleSchool}>
                        <input type="hidden" name="schoolId" value={school.id} />
                        <button className="text-accent-ink underline">+ Add back to my list</button>
                      </form>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <RecruitingEventForm schools={names} title="Log a school that isn't on the list" />

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
            Suggestions appear once a coach replies, invites her to camp, or more. Log those updates on her list above.
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

    </div>
  );
}
