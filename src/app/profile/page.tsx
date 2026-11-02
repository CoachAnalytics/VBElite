import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAthlete } from "@/lib/queries";
import { AthleteForm } from "@/components/AthleteForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { CoachConfirmSection } from "@/components/CoachConfirmSection";
import { setResearchConsent } from "../actions";

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
      {athlete?.questionnaireAt && (
        <section className="card space-y-2 p-5">
          <h2 className="font-medium">My schools &amp; recruiting log</h2>
          <p className="text-sm text-ink-2">
            Her list of schools in one place. Open any school to log emails, coach replies, camp invites, visits and offers,
            see where it stands, and get suggestions for similar programs.
          </p>
          <Link href="/recruiting" className="btn-primary">Open my schools</Link>
        </section>
      )}
      {athlete?.questionnaireAt && <CoachConfirmSection athleteId={athlete.id} athleteName={athlete.name} />}
      {athlete && (
        <section id="data" className="card space-y-2 p-5 text-sm">
          <h2 className="font-medium">Anonymous statistics</h2>
          <p className="text-ink-2">
            {athlete.researchConsent
              ? `${athlete.name.split(" ")[0]}'s measurements and recruiting results (offers and commitments) are included in VB Elite's anonymous statistics, without her name, email or other contact details. They help build age-by-position norms and more accurate projections for every athlete.`
              : `${athlete.name.split(" ")[0]}'s data is not included in VB Elite's anonymous statistics. Her own comparisons and projections work the same either way.`}
          </p>
          <form action={setResearchConsent}>
            <input type="hidden" name="consent" value={athlete.researchConsent ? "no" : "yes"} />
            <button className="btn-secondary px-3 py-1.5 text-sm">{athlete.researchConsent ? "Opt out" : "Include her data again"}</button>
          </form>
        </section>
      )}
      <p className="text-sm text-ink-3">Signed in as {user.email}</p>
      <ChangePasswordForm />
    </div>
  );
}
