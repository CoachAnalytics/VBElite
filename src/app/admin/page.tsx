import Link from "next/link";
import { count, desc, eq, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ImportForm } from "@/components/ImportForm";

export default async function AdminPage() {
  await requireAdmin();

  const [[users], [athletes], divisions, recent] = await Promise.all([
    db.select({ n: count() }).from(schema.users),
    db.select({ n: count() }).from(schema.athletes),
    db
      .select({ division: schema.schools.division, n: count(), updated: max(schema.schools.updatedAt) })
      .from(schema.schools)
      .groupBy(schema.schools.division)
      .orderBy(schema.schools.division),
    db
      .select({
        id: schema.schools.id,
        slug: schema.schools.slug,
        name: schema.schools.name,
        division: schema.schools.division,
        updatedAt: schema.schools.updatedAt,
        commits: count(schema.commits.id),
      })
      .from(schema.schools)
      .leftJoin(schema.commits, eq(schema.commits.schoolId, schema.schools.id))
      .groupBy(schema.schools.id)
      .orderBy(desc(schema.schools.updatedAt), schema.schools.name)
      .limit(50),
  ]);
  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-ink-2">
          {users.n} accounts · {athletes.n} athlete profiles
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Update school data</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          Upload a workbook in the Volleyball Recruiting Comparison format. Schools are matched by name: existing ones
          are updated (their records, roster and commits are replaced) and new ones are added. Schools not in the
          workbook are left alone.
        </p>
        <ImportForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Schools by division</h2>
        <div className="flex flex-wrap gap-3">
          {divisions.length === 0 && <p className="text-sm text-ink-3">No schools yet. Upload a workbook above.</p>}
          {divisions.map((d) => (
            <div key={d.division} className="card px-4 py-3">
              <div className="text-xs text-ink-3">{d.division}</div>
              <div className="tabular text-xl font-semibold">{d.n}</div>
              <div className="text-xs text-ink-3">updated {fmt(d.updated)}</div>
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="card relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3">
              <tr>
                <th className="px-4 py-2 font-medium">School</th>
                <th className="px-4 py-2 font-medium">Division</th>
                <th className="px-4 py-2 text-right font-medium">Commits</th>
                <th className="px-4 py-2 text-right font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/schools/${s.slug}`} className="hover:underline">{s.name}</Link>
                  </td>
                  <td className="px-4 py-2 text-ink-2">{s.division}</td>
                  <td className="tabular px-4 py-2 text-right">{s.commits}</td>
                  <td className="tabular px-4 py-2 text-right text-ink-2">{fmt(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
