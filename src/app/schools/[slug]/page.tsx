import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleSchool } from "../../actions";
import { analyzeSchool, pipelineClasses, positionTimeline, programSummary, recruitingPipeline, rosterBreakdown } from "@/lib/analytics";
import { formatHeight, formatMoney, formatPct } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { athleteInput, getRecruitingEvents, getSavedSchools, getSchoolBundleBySlug, getContactSubmissions, getSchoolContacts, getSeasons, requireOnboarded } from "@/lib/queries";
import { latestSeason } from "@/lib/athleteData";
import { statLine } from "@/lib/stats";
import { mergeContacts } from "@/lib/coachEmail";
import { parseAnswers } from "@/lib/questionnaire";
import { ContactCoaches } from "@/components/ContactCoaches";
import { eventInfo } from "@/lib/recruiting";
import { PositionTimelineChart, WinPctChart } from "@/components/SchoolCharts";
import { PipelineTable, RosterBreakdownTable } from "@/components/BreakdownTables";

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
  const { athlete } = await requireOnboarded();
  const bundle = await getSchoolBundleBySlug(slug);
  if (!bundle) notFound();
  const { school } = bundle;
  const input = athlete ? athleteInput(athlete) : null;
  const a = input ? analyzeSchool(bundle, input) : null;
  const program = programSummary(bundle.seasons);
  const saved = athlete ? (await getSavedSchools(athlete.id)).some((s) => s.schoolId === school.id) : false;
  const myEvents = athlete ? (await getRecruitingEvents(athlete.id)).filter((e) => e.schoolId === school.id) : [];
  const [official, added, seasons] = await Promise.all([
    getSchoolContacts(school.id),
    athlete ? getContactSubmissions(school.id, athlete.userId) : Promise.resolve([]),
    athlete ? getSeasons(athlete.id) : Promise.resolve([]),
  ]);
  const latest = latestSeason(seasons);
  const statsLine = athlete && latest ? statLine(latest, athlete.position, athlete.gradYear) : null;
  const contacts = mergeContacts(official, added);
  const athleticsUrl = school.athleticsWebsite
    ? /^https?:\/\//.test(school.athleticsWebsite) ? school.athleticsWebsite : `https://${school.athleticsWebsite}`
    : null;
  const pos = athlete?.position;
  // Only http(s) links from the research sources are shown.
  const sources: string[] = (() => {
    try {
      const list = JSON.parse(school.sources ?? "[]");
      return Array.isArray(list) ? list.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)) : [];
    } catch {
      return [];
    }
  })();
  const covered = pos ? school.positionsCovered.split(",").includes(pos) : false;
  const rosterSeason = school.rosterSeason ?? new Date().getUTCFullYear();
  const breakdown = rosterBreakdown(bundle.roster);
  const pipeline = recruitingPipeline(bundle.commits, pipelineClasses(rosterSeason));
  const unlisted = bundle.roster.filter((p) => !p.primaryPosition || p.primaryPosition === "?").length;
  // Whole roster and every commit: the athlete's position first, then by position and class.
  const POS_ORDER = ["S", "OH", "OPP", "MB", "LDS", "?"];
  const posRank = (p: string) => (p === pos ? -1 : POS_ORDER.indexOf(p));
  const roster = [...bundle.roster].sort(
    (x, y) =>
      posRank(x.primaryPosition) - posRank(y.primaryPosition) ||
      CLASS_ORDER.indexOf(x.classYear) - CLASS_ORDER.indexOf(y.classYear),
  );
  const commits = [...bundle.commits].sort(
    (x, y) => x.gradYear - y.gradYear || posRank(x.primaryPosition) - posRank(y.primaryPosition),
  );
  const isMine = (positions: string) => !!pos && positions.split("/").includes(pos);
  // A recruit 4+ years out arrives after everyone on today's roster has finished.
  const allGone = !!a && a.position.yearsUntilArrival >= 4 && a.position.returningAtArrival === 0;

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

      {athlete && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div>
            <span className="font-medium">Your recruiting with {school.name}: </span>
            {myEvents.length ? (
              <span className="text-ink-2">
                {myEvents.slice(0, 3).map((e) => `${eventInfo(e.type).short} (${e.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })})`).join(" · ")}
              </span>
            ) : (
              <span className="text-ink-3">nothing logged yet</span>
            )}
          </div>
          <Link href={`/recruiting#${school.slug}`} className="text-accent-ink underline">{myEvents.length ? "Open log" : "Log an update"}</Link>
        </section>
      )}

      {athlete && (
        <ContactCoaches
          contacts={contacts}
          athlete={{ ...athlete, video: parseAnswers(athlete.questionnaire)?.video ?? null, statsLine, maxprepsUrl: athlete.maxprepsUrl }}
          school={{ id: school.id, name: school.name }}
          questionnaire={school.recruitingQuestionnaire && /^https?:\/\//.test(school.recruitingQuestionnaire) ? school.recruitingQuestionnaire : null}
          checkedAt={school.contactsCheckedAt?.toISOString() ?? null}
          source={school.contactsSource && /^https?:\/\//.test(school.contactsSource) ? school.contactsSource : null}
          athleticsUrl={athleticsUrl}
        />
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label={`Win % (${program.recordSeasons} seasons)`}
          value={formatPct(program.winPct)}
          sub={program.recordSeasons ? `${program.wins}–${program.losses}` : "records not collected yet"}
        />
        <Stat label="NCAA tournament trips" value={`${program.postseasonApps}/${program.seasonsTracked}`} sub={program.bestFinish ? `Best: ${program.bestFinish}` : undefined} />
        <Stat
          label="Head coach"
          value={<span className="text-base">{school.headCoach ?? "—"}</span>}
          sub={school.coachSince ? `Since ${school.coachSince}${a?.coachTenure != null && a.coachTenure <= 2 ? " · new" : ""}` : undefined}
        />
        <Stat label="Volleyball APR" value={school.apr ?? "—"} sub={school.apr != null ? school.aprNote ?? undefined : "not published"} />
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
                <Stat label={`Still there in fall ${athlete.gradYear}`} value={a.position.returningAtArrival}
                  sub={allGone ? "today's roster will have graduated" : undefined} />
                <Stat label="Commits in classes ahead" value={a.position.commitsAhead}
                  sub={Object.entries(a.position.commitsAheadByClass).map(([y, n]) => `${y}: ${n}`).join(" · ") || undefined} />
                <Stat label={`Commits in the ${athlete.gradYear} class`} value={a.position.sameClassCommits}
                  sub={a.position.heightDelta != null ? `You're ${a.position.heightDelta >= 0 ? "+" : "−"}${Math.abs(a.position.heightDelta).toFixed(1)}" vs. ${pos} avg ${formatHeight(a.position.avgHeightAtPosition)}` : undefined} />
              </div>
              {allGone && (
                <p className="card p-4 text-sm text-ink-2">
                  Everyone at {pos} on today&apos;s roster will have finished by fall {athlete.gradYear}. The players{" "}
                  {athlete.name} would compete with are the commits in the classes ahead
                  {Object.keys(a.position.commitsAheadByClass).length > 0 && ` (${Object.keys(a.position.commitsAheadByClass).join(", ")})`},
                  her own class, and transfers. The recruiting pipeline below shows who has committed so far.
                </p>
              )}
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

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Academics &amp; cost</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Undergraduates" value={school.enrollment?.toLocaleString() ?? "—"} sub={school.control ?? undefined} />
          <Stat label="Admission rate" value={formatPct(school.admissionRate)} />
          <Stat
            label="Average SAT / ACT"
            value={school.satAvg ?? "—"}
            sub={school.act25 != null ? `ACT ${school.act25}–${school.act75}` : undefined}
          />
          <Stat label="Graduation rate" value={formatPct(school.graduationRate)} sub="6-year, all students" />
          <Stat label="Average net price" value={formatMoney(school.avgNetPrice)} sub="per year after aid, all students" />
          <Stat label="Median earnings" value={formatMoney(school.medianEarnings)} sub="10 years after entry" />
        </div>
        <p className="text-xs text-ink-3">
          Tuition: {formatMoney(school.tuitionInState)} in-state, {formatMoney(school.tuitionOutState)} out-of-state
          {school.costOfAttendance ? ` · Full cost of attendance ${formatMoney(school.costOfAttendance)}` : ""}. Source: U.S.
          Department of Education College Scorecard (latest published year). Athletic scholarships aren&apos;t included.
        </p>
      </section>

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
                <th className="px-4 py-2 font-medium">NCAA tournament</th>
              </tr>
            </thead>
            <tbody>
              {[...program.seasons].reverse().map((s) => (
                <tr key={s.year} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{s.year}</td>
                  <td className="tabular px-4 py-2 text-right">{s.wins != null ? `${s.wins}–${s.losses}` : "—"}</td>
                  <td className="px-4 py-2 text-ink-2">
                    {s.postseason === "DNQ" ? "Did not qualify" : (s.postseason ?? "—")}
                    {s.ncaaSeed != null && <span className="text-ink-3"> · {s.ncaaSeed} seed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Roster by position ({rosterSeason})</h2>
          <p className="text-sm text-ink-2">
            Every player on the current roster by main position and class.
            {pos && ` ${positionLabel(pos)}s are highlighted.`}
            {unlisted > 0 && ` No public source lists a position for ${unlisted} player${unlisted > 1 ? "s" : ""} yet.`}
          </p>
        </div>
        {bundle.roster.length ? (
          <RosterBreakdownTable groups={breakdown} rosterSeason={rosterSeason} highlight={pos} />
        ) : (
          <p className="card p-4 text-sm text-ink-3">The {rosterSeason} roster hasn&apos;t been collected yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Recruiting pipeline</h2>
          <p className="text-sm text-ink-2">
            Verbal commits and signees by main position for the next three classes to arrive. &quot;Hybrid&quot; counts recruits
            who list the position second (an OH/DS is counted as an outside hitter, plus a hybrid defensive specialist).
            {school.commitDataQuality === "partial" && " Public commit lists for this school look incomplete, so there may be more."}
          </p>
        </div>
        <PipelineTable pipeline={pipeline} highlight={pos} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card relative overflow-x-auto">
          <h2 className="px-4 pt-4 font-medium">Full roster ({rosterSeason}) · {bundle.roster.length} players</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">Player</th>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium">Position</th>
                <th className="px-4 py-2 text-right font-medium">Height</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id} className={`border-b border-line last:border-0 ${isMine(p.positions) ? "bg-accent/10" : ""}`}>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-ink-2">{p.redshirt ? `R-${p.classYear}` : p.classYear}</td>
                  <td className="px-4 py-2 text-ink-2">{p.positionRaw ?? "—"}</td>
                  <td className="tabular px-4 py-2 text-right">{formatHeight(p.heightIn)}</td>
                </tr>
              ))}
              {!roster.length && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-3">Roster not collected yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card relative overflow-x-auto">
          <h2 className="px-4 pt-4 font-medium">Commits · {commits.length}</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">Player</th>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium">Position</th>
                <th className="px-4 py-2 text-right font-medium">Height</th>
                <th className="px-4 py-2 font-medium">High school · club</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c) => (
                <tr key={c.id} className={`border-b border-line last:border-0 ${isMine(c.positions) ? "bg-accent/10" : ""}`}>
                  <td className="px-4 py-2">{c.name}{c.note && <div className="text-xs text-ink-3">{c.note}</div>}</td>
                  <td className="px-4 py-2 text-ink-2">{c.gradYear}</td>
                  <td className="px-4 py-2 text-ink-2">
                    {c.positionRaw ?? "—"}
                    {c.primaryPosition && c.positions.includes("/") && (
                      <div className="text-xs text-ink-3">projects as {c.primaryPosition === "LDS" ? "L/DS" : c.primaryPosition}</div>
                    )}
                  </td>
                  <td className="tabular px-4 py-2 text-right">{formatHeight(c.heightIn)}</td>
                  <td className="px-4 py-2 text-ink-2">
                    {[c.highSchool ?? c.hometown, c.club].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              {!commits.length && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-3">No commits found yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-1 text-sm text-ink-2">
        {school.programNote && <p>{school.programNote}</p>}
        <p className="text-xs text-ink-3">
          {school.researchedAt
            ? `Roster, commits and coach researched ${school.researchedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
            : "Roster and commit research for this school is still in progress."}{" "}
          NCAA tournament results: Wikipedia tournament records. Academics and cost: College Scorecard.
        </p>
        {sources.length > 0 && (
          <details className="text-xs text-ink-3">
            <summary className="cursor-pointer">Sources ({sources.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {sources.map((u) => (
                <li key={u} className="truncate">
                  <a href={u} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{u}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
