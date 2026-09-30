import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { analyzeSchool } from "@/lib/analytics";
import { formatHeight } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { athleteInput, getAthlete, getSavedSchools, getSchoolBundles } from "@/lib/queries";
import { CompareDashboard } from "@/components/CompareDashboard";

export default async function ComparePage() {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  if (!athlete) redirect("/profile");

  const saved = await getSavedSchools(athlete.id);
  const bundles = await getSchoolBundles(saved.map((s) => s.schoolId));
  const input = athleteInput(athlete);
  const now = new Date();
  const tierOf = new Map(saved.map((s) => [s.schoolId, s.tier]));
  const analyses = bundles.map((b) => ({ ...analyzeSchool(b, input, now), tier: tierOf.get(b.school.id) ?? "main" }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compare schools</h1>
        <p className="mt-1 text-sm text-ink-2">
          {athlete.name} · {positionLabel(athlete.position)} · Class of {athlete.gradYear}
          {athlete.heightIn ? ` · ${formatHeight(athlete.heightIn)}` : ""} · {athlete.homeCity}, {athlete.homeState}
          {" · "}
          <Link href="/profile" className="text-accent-ink underline">Edit</Link>
        </p>
      </div>
      {analyses.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink-2">Your list is empty.</p>
          <Link href="/schools" className="btn-primary mt-4">Choose schools</Link>
        </div>
      ) : (
        <CompareDashboard analyses={analyses} athleteName={athlete.name} position={athlete.position} gradYear={athlete.gradYear} />
      )}
    </div>
  );
}
