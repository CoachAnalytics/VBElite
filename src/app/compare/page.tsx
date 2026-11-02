import Link from "next/link";
import { analyzeSchool } from "@/lib/analytics";
import { formatHeight } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { athleteInput, getRecruitingEvents, getSavedSchools, getSchoolBundles, requireOnboarded } from "@/lib/queries";
import { eventInfo, schoolStatuses } from "@/lib/recruiting";
import { parseAnswers } from "@/lib/questionnaire";
import { weightsFromAnswers } from "@/lib/recommend";
import { CompareDashboard } from "@/components/CompareDashboard";
import { CompareTables } from "@/components/CompareTables";

export default async function ComparePage() {
  const { athlete } = await requireOnboarded();
  const answers = parseAnswers(athlete.questionnaire);

  const [saved, events] = await Promise.all([getSavedSchools(athlete.id), getRecruitingEvents(athlete.id)]);
  const statusOf = new Map(schoolStatuses(events).map((s) => [s.schoolId, { label: eventInfo(s.type).short, stage: s.stage }]));
  const bundles = await getSchoolBundles(saved.map((s) => s.schoolId));
  const input = athleteInput(athlete);
  const now = new Date();
  const tierOf = new Map(saved.map((s) => [s.schoolId, s.tier]));
  const analyses = bundles.map((b) => ({ ...analyzeSchool(b, input, now), tier: tierOf.get(b.school.id) ?? "main", recruiting: statusOf.get(b.school.id) ?? null }));

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
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/recommendations" className="btn-primary">See recommended schools</Link>
            <Link href="/schools" className="btn-secondary">Browse all schools</Link>
          </div>
        </div>
      ) : (
        <>
          <CompareDashboard
            analyses={analyses}
            athleteName={athlete.name}
            position={athlete.position}
            gradYear={athlete.gradYear}
            defaultWeights={answers ? weightsFromAnswers(answers) : undefined}
          />
          <div>
            <h2 className="text-xl font-semibold">Side by side</h2>
            <p className="mt-1 text-sm text-ink-2">
              Your schools in spreadsheet form. Switch positions to see any spot on the court, and download any view to open it in Excel.
            </p>
          </div>
          <CompareTables analyses={analyses} defaultPosition={athlete.position} />
        </>
      )}
    </div>
  );
}
