import Link from "next/link";
import { toggleSchool } from "../actions";
import { requireUser } from "@/lib/auth";
import { programSummary, distanceFor } from "@/lib/analytics";
import { formatPct } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { athleteInput, filterOptions, getAthlete, getSavedSchools, listSchools } from "@/lib/queries";

const SORTS = {
  name: "Name",
  ncaa: "Most NCAA tournament trips",
  winpct: "Best win %",
  distance: "Closest to home",
} as const;
type SortKey = keyof typeof SORTS;

export default async function SchoolsPage({ searchParams }: PageProps<"/schools">) {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const filters = { q: one("q"), state: one("state"), conference: one("conference") };
  const ncaaOnly = one("ncaa") === "1";
  const sort: SortKey = (one("sort") as SortKey) in SORTS ? (one("sort") as SortKey) : "name";

  const [rows, options, saved] = await Promise.all([
    listSchools(filters),
    filterOptions(),
    athlete ? getSavedSchools(athlete.id) : Promise.resolve([]),
  ]);
  const savedIds = new Set(saved.map((s) => s.schoolId));
  const input = athlete ? athleteInput(athlete) : null;

  const enriched = rows
    .map(({ school, seasons }) => ({
      school,
      program: programSummary(seasons),
      miles: input ? distanceFor(school, input) : null,
    }))
    .filter((r) => !ncaaOnly || r.program.postseasonApps > 0);
  const val = (r: (typeof enriched)[number]): number | null =>
    sort === "ncaa" ? r.program.postseasonApps : sort === "winpct" ? r.program.winPct : sort === "distance" ? r.miles : null;
  if (sort !== "name") {
    enriched.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return sort === "distance" ? va - vb : vb - va;
    });
  }
  const filtered = Boolean(filters.q || filters.state || filters.conference || ncaaOnly);

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
          save schools and see distances.
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
        <select name="sort" defaultValue={sort} className="input w-auto" aria-label="Sort by">
          {Object.entries(SORTS)
            .filter(([k]) => k !== "distance" || input)
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
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-3">
            <tr>
              <th className="px-4 py-2 font-medium">School</th>
              <th className="px-4 py-2 font-medium">Conference</th>
              <th className="px-4 py-2 text-right font-medium">NCAA trips</th>
              <th className="px-4 py-2 text-right font-medium">Win % (5 yr)</th>
              {input && <th className="px-4 py-2 text-right font-medium">Miles</th>}
              {athlete && <th className="px-4 py-2 font-medium">Data for {athlete.position}s</th>}
              <th className="px-4 py-2"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(({ school, program: p, miles }) => {
              const isSaved = savedIds.has(school.id);
              const covered = athlete ? school.positionsCovered.split(",").includes(athlete.position) : false;
              return (
                <tr key={school.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/schools/${school.slug}`} className="font-medium hover:underline">{school.name}</Link>
                    <div className="text-xs text-ink-3">{[school.city, school.state].filter(Boolean).join(", ")}</div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{school.conference}</td>
                  <td className="tabular px-4 py-2.5 text-right">
                    {p.postseasonApps}/{p.seasonsTracked}
                    {p.bestFinish && <div className="text-xs text-ink-3">Best: {p.bestFinish}</div>}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">{formatPct(p.winPct)}</td>
                  {input && (
                    <td className="tabular px-4 py-2.5 text-right">{miles == null ? "—" : Math.round(miles).toLocaleString()}</td>
                  )}
                  {athlete && (
                    <td className="px-4 py-2.5 text-xs">
                      {covered ? (
                        <span className="text-good">✓ Roster &amp; commits</span>
                      ) : (
                        <span className="text-ink-3" title={`${positionLabel(athlete.position)} roster data not collected yet`}>
                          Program data only
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
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
                <td colSpan={7} className="px-4 py-8 text-center text-ink-3">No schools match those filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
