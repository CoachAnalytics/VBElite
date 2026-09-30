import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleSchool } from "../../actions";
import { requireUser } from "@/lib/auth";
import { analyzeSchool, positionTimeline, programSummary } from "@/lib/analytics";
import { formatHeight, formatMoney, formatPct } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { athleteInput, getAthlete, getSavedSchools, getSchoolBundleBySlug } from "@/lib/queries";
import { PositionTimelineChart, WinPctChart } from "@/components/SchoolCharts";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

const CLASS_ORDER = ["Fr", "So", "Jr", "Sr", "Grad"];

export default async function SchoolPage({ params }: PageProps<"/schools/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const [bundle, athlete] = await Promise.all([getSchoolBundleBySlug(slug), getAthlete(user.id)]);
  if (!bundle) notFound();
  const { school } = bundle;
  const input = athlete ? athleteInput(athlete) : null;
  const a = input ? analyzeSchool(bundle, input) : null;
  const program = programSummary(bundle.seasons);
  const saved = athlete ? (await getSavedSchools(athlete.id)).some((s) => s.schoolId === school.id) : false;
  const pos = athlete?.position;
  const covered = pos ? school.positionsCovered.split(",").includes(pos) : false;
  const roster = pos
    ? bundle.roster
        .filter((p) => p.positions.split("/").includes(pos))
        .sort((x, y) => CLASS_ORDER.indexOf(x.classYear) - CLASS_ORDER.indexOf(y.classYear))
    : [];
  const commits = pos
    ? bundle.commits.filter((c) => c.positions.split("/").includes(pos)).sort((x, y) => x.gradYear - y.gradYear)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/compare" className="text-sm text-ink-3 hover:text-ink">← Compare</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{school.name}</h1>
          <p className="mt-1 text-ink-2">
            {school.city}, {school.state} · {school.division} · {school.conference}
            {school.control && ` · ${school.control}`}
            {school.enrollment && ` · ${school.enrollment.toLocaleString()} students`}
          </p>
        </div>
        {athlete && (
          <form action={toggleSchool}>
            <input type="hidden" name="schoolId" value={school.id} />
            <button className={saved ? "btn-secondary" : "btn-primary"}>{saved ? "✓ On my list" : "+ Add to my list"}</button>
          </form>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label={`Win % (${program.seasonsTracked} seasons)`} value={formatPct(program.winPct)} sub={`${program.wins}–${program.losses}`} />
        <Stat label="Postseason trips" value={`${program.postseasonApps}/${program.seasonsTracked}`} sub={program.bestFinish ? `Best: ${program.bestFinish}` : undefined} />
        <Stat
          label="Head coach"
          value={<span className="text-base">{school.headCoach ?? "—"}</span>}
          sub={school.coachSince ? `Since ${school.coachSince}${a?.coachTenure != null && a.coachTenure <= 2 ? " · new" : ""}` : undefined}
        />
        <Stat label="APR" value={school.apr ?? "—"} sub={school.aprNote ?? undefined} />
        <Stat
          label="Tuition & fees"
          value={formatMoney(a?.cost.tuition ?? school.tuitionOutState ?? school.tuitionInState)}
          sub={a ? (school.control === "private" ? "private" : a.cost.inState ? (a.cost.estimated ? "in-state rate not loaded; out-of-state shown" : "in-state") : "out-of-state") : undefined}
        />
        <Stat label="Distance from home" value={a?.distanceMiles != null ? `${Math.round(a.distanceMiles).toLocaleString()} mi` : "—"} sub="straight line" />
      </section>

      {a && pos && athlete && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{positionLabel(pos)} outlook for the class of {athlete.gradYear}</h2>
          {!covered ? (
            <p className="card p-4 text-sm text-ink-2">
              We haven&apos;t collected {positionLabel(pos).toLowerCase()} roster and commit data for {school.name} yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label={`${pos}s on the ${a.position.rosterSeason} roster`} value={a.position.currentAtPosition}
                  sub={CLASS_ORDER.map((c) => `${c} ${a.position.currentByClass[c] ?? 0}`).join(" · ")} />
                <Stat label={`Still there in fall ${athlete.gradYear}`} value={a.position.returningAtArrival} />
                <Stat label="Commits in classes ahead" value={a.position.commitsAhead}
                  sub={Object.entries(a.position.commitsAheadByClass).map(([y, n]) => `${y}: ${n}`).join(" · ") || undefined} />
                <Stat label={`Commits in the ${athlete.gradYear} class`} value={a.position.sameClassCommits}
                  sub={a.position.heightDelta != null ? `You're ${a.position.heightDelta >= 0 ? "+" : "−"}${Math.abs(a.position.heightDelta).toFixed(1)}" vs. ${pos} avg ${formatHeight(a.position.avgHeightAtPosition)}` : undefined} />
              </div>
              {(school.commitDataQuality === "partial" || a.position.classesNotYetRecruited.length > 0 || school.recruitingNote) && (
                <div className="card space-y-1 border-warn/40 p-4 text-sm text-ink-2">
                  {school.commitDataQuality === "partial" && <p>⚠ Public commit lists for {school.name} look incomplete. Confirm with the coaching staff.</p>}
                  {a.position.classesNotYetRecruited.length > 0 && (
                    <p>Class of {a.position.classesNotYetRecruited.join(", ")} can&apos;t commit yet, so more players will be added ahead of you.</p>
                  )}
                  {school.recruitingNote && <p>Note: {school.recruitingNote}</p>}
                </div>
              )}
              <div className="card p-4">
                <h3 className="font-medium">{pos}s on the roster during each of your four seasons</h3>
                <p className="mb-3 text-sm text-ink-2">Known players only; future recruiting classes and transfers will add to these.</p>
                <PositionTimelineChart data={positionTimeline(bundle, input!)} />
              </div>
            </>
          )}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-medium">Win % by season</h2>
          <WinPctChart data={program.seasons} />
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">Season</th>
                <th className="px-4 py-2 text-right font-medium">Record</th>
                <th className="px-4 py-2 font-medium">Postseason</th>
              </tr>
            </thead>
            <tbody>
              {[...program.seasons].reverse().map((s) => (
                <tr key={s.year} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{s.year}</td>
                  <td className="tabular px-4 py-2 text-right">{s.wins}–{s.losses}</td>
                  <td className="px-4 py-2 text-ink-2">{s.postseason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pos && covered && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="card overflow-x-auto">
            <h2 className="px-4 pt-4 font-medium">Current {pos}s ({school.rosterSeason})</h2>
            <table className="mt-2 w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-ink-3">
                <tr>
                  <th className="px-4 py-2 font-medium">Player</th>
                  <th className="px-4 py-2 font-medium">Class</th>
                  <th className="px-4 py-2 font-medium">Pos</th>
                  <th className="px-4 py-2 text-right font-medium">Height</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-ink-2">{p.redshirt ? `R-${p.classYear}` : p.classYear}</td>
                    <td className="px-4 py-2 text-ink-2">{p.positionRaw}</td>
                    <td className="tabular px-4 py-2 text-right">{formatHeight(p.heightIn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card overflow-x-auto">
            <h2 className="px-4 pt-4 font-medium">Committed {pos}s</h2>
            <table className="mt-2 w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-ink-3">
                <tr>
                  <th className="px-4 py-2 font-medium">Player</th>
                  <th className="px-4 py-2 font-medium">Class</th>
                  <th className="px-4 py-2 font-medium">Pos</th>
                  <th className="px-4 py-2 text-right font-medium">Height</th>
                  <th className="px-4 py-2 font-medium">Club</th>
                </tr>
              </thead>
              <tbody>
                {commits.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{c.name}{c.note && <div className="text-xs text-ink-3">{c.note}</div>}</td>
                    <td className="px-4 py-2 text-ink-2">{c.gradYear}</td>
                    <td className="px-4 py-2 text-ink-2">{c.positionRaw}</td>
                    <td className="tabular px-4 py-2 text-right">{formatHeight(c.heightIn)}</td>
                    <td className="px-4 py-2 text-ink-2">{c.club ?? "—"}</td>
                  </tr>
                ))}
                {!commits.length && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-3">No {pos} commits found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(school.programNote || school.enrollmentNote) && (
        <section className="text-sm text-ink-2">
          {school.programNote && <p>{school.programNote}</p>}
          <p className="mt-1 text-xs text-ink-3">
            Last updated {school.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {school.enrollmentNote && ` · Enrollment: ${school.enrollmentNote}`}
          </p>
        </section>
      )}
    </div>
  );
}
