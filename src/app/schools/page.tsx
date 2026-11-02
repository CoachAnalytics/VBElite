import Link from "next/link";
import { toggleSchool } from "../actions";
import { costFor, distanceFor, pipelineClasses, programSummary } from "@/lib/analytics";
import { formatMoney, formatPct } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { athleteInput, filterOptions, getSavedSchools, listSchools, positionCounts, requireOnboarded } from "@/lib/queries";

const SORTS = {
  name: "Name",
  ncaa: "Most NCAA tournament trips",
  winpct: "Best win %",
  distance: "Closest to home",
  room: "Fewest incoming at my position",
  cost: "Lowest tuition",
  grad: "Highest graduation rate",
  size: "Largest enrollment",
  smallest: "Smallest enrollment",
} as const;
type SortKey = keyof typeof SORTS;
// Sorts where a smaller number ranks first.
const ASCENDING: SortKey[] = ["distance", "room", "cost", "smallest"];

export default async function SchoolsPage({ searchParams }: PageProps<"/schools">) {
  const { athlete } = await requireOnboarded();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const filters = { q: one("q"), state: one("state"), conference: one("conference"), control: one("control") };
  const ncaaOnly = one("ncaa") === "1";
  const sort: SortKey = (one("sort") as SortKey) in SORTS ? (one("sort") as SortKey) : "name";
  const classes = pipelineClasses(2026);

  const [rows, options, saved, counts] = await Promise.all([
    listSchools(filters),
    filterOptions(),
    athlete ? getSavedSchools(athlete.id) : Promise.resolve([]),
    athlete ? positionCounts(athlete.position, classes[0], classes.at(-1)!) : Promise.resolve(null),
  ]);
  const savedIds = new Set(saved.map((s) => s.schoolId));
  const input = athlete ? athleteInput(athlete) : null;
  const pos = athlete?.position;

  const enriched = rows
    .map(({ school, seasons }) => {
      const covered = !!pos && school.positionsCovered.split(",").includes(pos);
      return {
        school,
        covered,
        program: programSummary(seasons),
        miles: input ? distanceFor(school, input) : null,
        tuition: input ? costFor(school, input).tuition : school.tuitionOutState,
        current: covered ? (counts?.roster.get(school.id) ?? 0) : null,
        incoming: covered ? (counts?.incoming.get(school.id) ?? 0) : null,
      };
    })
    .filter((r) => !ncaaOnly || r.program.postseasonApps > 0);
  const val = (r: (typeof enriched)[number]): number | null => {
    switch (sort) {
      case "ncaa": return r.program.postseasonApps;
      case "winpct": return r.program.winPct;
      case "distance": return r.miles;
      case "room": return r.incoming;
      case "cost": return r.tuition;
      case "grad": return r.school.graduationRate;
      case "size":
      case "smallest": return r.school.enrollment;
      default: return null;
    }
  };
  if (sort !== "name") {
    enriched.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return ASCENDING.includes(sort) ? va - vb : vb - va;
    });
  }
  const filtered = Boolean(filters.q || filters.state || filters.conference || filters.control || ncaaOnly);
  const th = "px-3 py-2 font-medium";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Division I schools</h1>
        <p className="mt-1 text-sm text-ink-2">
          Add any schools to your list, then open{" "}
          <Link href="/compare" className="text-accent-ink underline">Compare</Link> for your report.{" "}
          {savedIds.size} on your list.
        </p>
      </div>

      {!athlete && (
        <p className="card border-warn/40 p-4 text-sm">
          <Link href="/profile" className="font-medium text-accent-ink underline">Add your athlete profile</Link> to
          save schools and see distances, cost and your position&apos;s numbers.
        </p>
      )}

      <form className="flex flex-wrap items-center gap-2" role="search">
        <input name="q" placeholder="Search school or city" defaultValue={filters.q} className="input max-w-xs" />
        <select name="conference" defaultValue={filters.conference ?? ""} className="input w-auto" aria-label="Conference">
          <option value="">All conferences</option>
          {options.conferences.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="state" defaultValue={filters.state ?? ""} className="input w-auto" aria-label="State">
          <option value="">All states</option>
          {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="control" defaultValue={filters.control ?? ""} className="input w-auto" aria-label="Public or private">
          <option value="">Public &amp; private</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        <select name="sort" defaultValue={sort} className="input w-auto" aria-label="Sort by">
          {Object.entries(SORTS)
            .filter(([k]) => (k !== "distance" && k !== "room") || input)
            .map(([k, label]) => <option key={k} value={k}>Sort: {label}</option>)}
        </select>
        <label className="flex items-center gap-2 px-1 text-sm text-ink-2">
          <input type="checkbox" name="ncaa" value="1" defaultChecked={ncaaOnly} className="accent-[var(--accent)]" />
          NCAA tournament teams (2021–25)
        </label>
        <button className="btn-secondary">Apply</button>
        {filtered && <Link href="/schools" className="btn text-ink-3 hover:text-ink">Clear</Link>}
      </form>

      <p className="text-sm text-ink-3">{enriched.length} schools</p>

      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-3">
            <tr>
              <th className={th}>School</th>
              <th className={th}>Conference</th>
              <th className={`${th} text-right`}>NCAA trips</th>
              <th className={`${th} text-right`}>Win % (5 yr)</th>
              <th className={`${th} text-right`}>Undergrads</th>
              <th className={`${th} text-right`}>{input ? "Your tuition" : "Tuition"}</th>
              <th className={`${th} text-right`}>Grad rate</th>
              <th className={th}>Head coach</th>
              {input && <th className={`${th} text-right`}>Miles</th>}
              {pos && (
                <th className={`${th} text-right`} title={`Current ${positionLabel(pos).toLowerCase()}s · commits in classes ${classes[0]}–${classes.at(-1)}`}>
                  {pos}s now · incoming
                </th>
              )}
              <th className="px-3 py-2"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(({ school, program: p, miles, tuition, covered, current, incoming }) => {
              const isSaved = savedIds.has(school.id);
              const newCoach = school.coachSince != null && school.coachSince >= 2025;
              return (
                <tr key={school.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/schools/${school.slug}`} className="font-medium hover:underline">{school.name}</Link>
                    <div className="text-xs text-ink-3">
                      {[school.city, school.state].filter(Boolean).join(", ")}
                      {school.control && ` · ${school.control}`}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{school.conference}</td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {p.postseasonApps}/{p.seasonsTracked}
                    {p.bestFinish && <div className="text-xs text-ink-3">Best: {p.bestFinish}</div>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{formatPct(p.winPct)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{school.enrollment?.toLocaleString() ?? "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatMoney(tuition)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatPct(school.graduationRate)}</td>
                  <td className="px-3 py-2.5 text-ink-2">
                    {school.headCoach ?? "—"}
                    {school.coachSince && (
                      <div className={`text-xs ${newCoach ? "text-warn" : "text-ink-3"}`}>since {school.coachSince}{newCoach && " · new"}</div>
                    )}
                  </td>
                  {input && (
                    <td className="tabular px-3 py-2.5 text-right">{miles == null ? "—" : Math.round(miles).toLocaleString()}</td>
                  )}
                  {pos && (
                    <td className="tabular px-3 py-2.5 text-right">
                      {covered ? (
                        <>
                          {current} · <span className="font-medium">{incoming}</span>
                        </>
                      ) : (
                        <span className="text-xs text-ink-3" title={`${positionLabel(pos)} roster data not collected yet`}>no {pos} data yet</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right">
                    {athlete && (
                      <form action={toggleSchool}>
                        <input type="hidden" name="schoolId" value={school.id} />
                        <button className={isSaved ? "btn-secondary" : "btn-primary"} aria-pressed={isSaved}>
                          {isSaved ? "✓ On my list" : "+ Add"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!enriched.length && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-ink-3">No schools match those filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
