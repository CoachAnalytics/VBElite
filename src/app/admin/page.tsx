import Link from "next/link";
import { count, desc, eq, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ImportForm } from "@/components/ImportForm";
import { AddAdminForm } from "@/components/AddAdminForm";
import { SyncButton } from "@/components/SyncButton";
import { dataRepo, syncConfigured } from "@/lib/sync";
import { removeAdmin, reviewContact, syncNow } from "./actions";
import { pendingContactSubmissions } from "@/lib/queries";
import { CONTACT_SOURCES, onSchoolDomain, ROLE_LABEL } from "@/lib/coachEmail";

// Uploads and "Sync now" load every school, which can take a minute or two.
export const maxDuration = 300;

export default async function AdminPage() {
  const me = await requireAdmin();

  const [[users], [athletes], divisions, recent, admins, syncs] = await Promise.all([
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
    db.select().from(schema.dataSyncs).orderBy(desc(schema.dataSyncs.ranAt)).limit(5),
  ]);
  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const fmtTime = (d: Date) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const configured = syncConfigured();
  const submissions = await pendingContactSubmissions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-ink-2">
          {users.n} accounts · {athletes.n} athlete profiles
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Coach emails from families {submissions.length > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-contrast">{submissions.length} to review</span>}</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          Families can add coach emails on school pages. They see their own right away; approve one to show it to everyone.
          An address off the school&apos;s own domain (like Gmail) deserves a closer look.
        </p>
        {submissions.length === 0 ? (
          <p className="text-sm text-ink-3">Nothing waiting.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {submissions.map((x) => {
              const official = onSchoolDomain(x.email, [x.website, x.athleticsWebsite]);
              return (
                <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div>
                      <Link href={`/schools/${x.schoolSlug}`} className="font-medium hover:underline">{x.schoolName}</Link>
                      {" · "}{x.name ?? "Team inbox"} ({x.title || ROLE_LABEL[x.role]})
                    </div>
                    <div className="break-all">
                      {x.email}{" "}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${official ? "bg-good/15 text-good" : "bg-bad/10 text-bad"}`}>
                        {official ? "school domain" : "not a school domain"}
                      </span>
                    </div>
                    <div className="text-xs text-ink-3">
                      {CONTACT_SOURCES.find((s) => s.value === x.source)?.label} · from {x.submittedBy} · {fmt(x.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={reviewContact}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="status" value="approved" />
                      <button className="btn-primary px-3 py-1 text-sm">Approve</button>
                    </form>
                    <form action={reviewContact}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button className="btn-secondary px-3 py-1 text-sm">Reject</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Automatic updates</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          {configured ? (
            <>
              Every morning the site checks the private <b>{dataRepo()}</b> repo for a new <b>schools.json.gz</b> and
              loads it if it changed. Use Sync now to check right away.
            </>
          ) : (
            <>
              Not set up yet. Add a <b>DATA_REPO_TOKEN</b> setting in Vercel (a read-only GitHub token for{" "}
              <b>{dataRepo()}</b>) and the site will load new school data by itself every morning.
            </>
          )}
        </p>
        <div className="card divide-y divide-line">
          {syncs.map((s) => (
            <div key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="tabular text-ink-3">{fmtTime(s.ranAt)} ET</span>
              <span className={s.status === "error" ? "font-medium text-bad" : s.status === "imported" ? "font-medium" : "text-ink-2"}>
                {s.status === "imported" ? "Updated" : s.status === "unchanged" ? "No changes" : "Failed"}
              </span>
              <span className="text-ink-2">{s.message}</span>
              <span className="text-xs text-ink-3">{s.trigger === "manual" ? "Sync now" : "automatic"}</span>
            </div>
          ))}
          {syncs.length === 0 && <p className="px-4 py-2.5 text-sm text-ink-3">No updates have run yet.</p>}
          <form action={syncNow} className="px-4 py-3">
            <SyncButton disabled={!configured} />
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Upload school data</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          Upload the generated <b>schools.json.gz</b> (every D1 school, from the private VBElite-data repo) or a workbook
          in the Volleyball Recruiting Comparison format. Schools in the file are updated (their records, roster and
          commits are replaced) and new ones are added; schools not in the file are left alone. The division, tuition
          and season settings below apply to workbooks only.
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
