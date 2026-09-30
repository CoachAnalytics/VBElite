import Link from "next/link";
import { toggleSchool } from "../actions";
import { requireUser } from "@/lib/auth";
import { programSummary, distanceFor } from "@/lib/analytics";
import { formatPct } from "@/lib/format";
import { DIVISIONS } from "@/lib/positions";
import { athleteInput, filterOptions, getAthlete, getSavedSchools, listSchools } from "@/lib/queries";

export default async function SchoolsPage({ searchParams }: PageProps<"/schools">) {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const filters = { q: one("q"), division: one("division"), state: one("state"), conference: one("conference") };

  const [rows, options, saved] = await Promise.all([
    listSchools(filters),
    filterOptions(),
    athlete ? getSavedSchools(athlete.id) : Promise.resolve([]),
  ]);
  const savedIds = new Set(saved.map((s) => s.schoolId));
  const input = athlete ? athleteInput(athlete) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Schools</h1>
          <p className="mt-1 text-sm text-ink-2">
            Add schools to your list, then open <Link href="/compare" className="text-accent-ink underline">Compare</Link>.
            {" "}{savedIds.size} on your list.
          </p>
        </div>
      </div>

      {!athlete && (
        <p className="card border-warn/40 p-4 text-sm">
          <Link href="/profile" className="font-medium text-accent-ink underline">Add your athlete profile</Link> to
          save schools and see distances.
        </p>
      )}

      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" placeholder="Search school or city" defaultValue={filters.q} className="input max-w-xs" />
        <select name="division" defaultValue={filters.division ?? ""} className="input w-auto">
          <option value="">All divisions</option>
          {DIVISIONS.map((d) => (
            <option key={d} value={d} disabled={!options.divisions.includes(d)}>
              {d}{options.divisions.includes(d) ? "" : " (coming soon)"}
            </option>
          ))}
        </select>
        <select name="conference" defaultValue={filters.conference ?? ""} className="input w-auto">
          <option value="">All conferences</option>
          {options.conferences.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="state" defaultValue={filters.state ?? ""} className="input w-auto">
          <option value="">All states</option>
          {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
        {(filters.q || filters.division || filters.state || filters.conference) && (
          <Link href="/schools" className="btn text-ink-3 hover:text-ink">Clear</Link>
        )}
      </form>

      <div className="card relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-3">
            <tr>
              <th className="px-4 py-2 font-medium">School</th>
              <th className="px-4 py-2 font-medium">Division · Conference</th>
              <th className="px-4 py-2 text-right font-medium">Win % (5 yr)</th>
              <th className="px-4 py-2 font-medium">Last postseason</th>
              {input && <th className="px-4 py-2 text-right font-medium">Miles away</th>}
              <th className="px-4 py-2"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ school, seasons }) => {
              const p = programSummary(seasons);
              const last = p.seasons.at(-1);
              const miles = input ? distanceFor(school, input) : null;
              const isSaved = savedIds.has(school.id);
              return (
                <tr key={school.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/schools/${school.slug}`} className="font-medium hover:underline">{school.name}</Link>
                    <div className="text-xs text-ink-3">{school.city}, {school.state}</div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{school.division} · {school.conference}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatPct(p.winPct)}</td>
                  <td className="px-4 py-2.5 text-ink-2">{last ? `${last.postseason ?? "—"} (${last.year})` : "—"}</td>
                  {input && (
                    <td className="tabular px-4 py-2.5 text-right">{miles == null ? "—" : Math.round(miles).toLocaleString()}</td>
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
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">No schools match those filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
