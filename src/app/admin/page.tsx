import Link from "next/link";
import { count, desc, eq, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ImportForm } from "@/components/ImportForm";
import { AddAdminForm } from "@/components/AddAdminForm";
import { removeAdmin } from "./actions";

export default async function AdminPage() {
  const me = await requireAdmin();

  const [[users], [athletes], divisions, recent, admins] = await Promise.all([
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
    db
      .select({ id: schema.users.id, email: schema.users.email, createdAt: schema.users.createdAt })
      .from(schema.users)
      .where(eq(schema.users.role, "admin"))
      .orderBy(schema.users.createdAt),
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
        <h2 className="text-lg font-medium">Admins</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          Admins can upload school data and add or remove other admins.
        </p>
        <div className="card divide-y divide-line">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                {a.email}
                {a.id === me.id && <span className="ml-2 text-xs text-ink-3">(you)</span>}
              </span>
              {a.id !== me.id && (
                <form action={removeAdmin}>
                  <input type="hidden" name="userId" value={a.id} />
                  <button className="text-xs text-ink-3 hover:text-bad" aria-label={`Remove admin access for ${a.email}`}>
                    Remove admin
                  </button>
                </form>
              )}
            </div>
          ))}
          {admins.length === 0 && (
            <p className="px-4 py-2.5 text-sm text-ink-3">You&apos;re an admin through the ADMIN_EMAILS setting.</p>
          )}
          <div className="px-4 py-4">
            <AddAdminForm />
          </div>
        </div>
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
