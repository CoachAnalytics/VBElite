import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAthlete } from "@/lib/queries";
import { parseAnswers, questionCount } from "@/lib/questionnaire";
import { QuestionnaireLoader } from "@/components/QuestionnaireLoader";

export default async function QuestionnairePage() {
  const user = await requireUser();
  const athlete = await getAthlete(user.id);
  if (!athlete) redirect("/profile");
  const retake = !!athlete.questionnaireAt;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{retake ? "Update your starting point" : `Let's find ${athlete.name}'s schools`}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {questionCount(athlete.position)} quick questions, about 5 minutes. Your answers are used to estimate the level of
          program that fits and to recommend a starting list of schools. No one else sees them; only her measurements count,
          anonymously, in VB Elite&apos;s statistics.
          {retake && " Change anything that's changed; your recommendations update when you finish."}
        </p>
      </div>
      <QuestionnaireLoader initial={parseAnswers(athlete.questionnaire)} athleteId={athlete.id} position={athlete.position} />
    </div>
  );
}
