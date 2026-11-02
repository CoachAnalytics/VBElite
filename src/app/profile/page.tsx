import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAthlete } from "@/lib/queries";
import { AthleteForm } from "@/components/AthleteForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { CoachConfirmSection } from "@/components/CoachConfirmSection";

export default async function ProfilePage() {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{athlete ? "Athlete profile" : "Tell us about your athlete"}</h1>
        <p className="mt-1 text-sm text-ink-2">
          Position and graduation year drive the roster analysis. Your ZIP code sets distance and in-state tuition.
        </p>
      </div>
      <AthleteForm athlete={athlete} />
      {athlete?.questionnaireAt && (
        <section className="card space-y-2 p-5">
          <h2 className="font-medium">Starting-point questionnaire</h2>
          <p className="text-sm text-ink-2">
            Last updated{" "}
            {athlete.questionnaireAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Retake it
            whenever something changes (a new club team, a growth spurt, a coach&apos;s feedback) to refresh her recommendations.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/questionnaire" className="btn-primary">Retake questionnaire</Link>
            <Link href="/recommendations" className="btn-secondary">See recommendations</Link>
          </div>
        </section>
      )}
      {athlete?.questionnaireAt && <CoachConfirmSection athleteId={athlete.id} athleteName={athlete.name} />}
      <p className="text-sm text-ink-3">Signed in as {user.email}</p>
      <ChangePasswordForm />
    </div>
  );
}
