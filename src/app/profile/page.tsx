import { requireUser } from "@/lib/auth";
import { getAthlete } from "@/lib/queries";
import { AthleteForm } from "@/components/AthleteForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

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
      <p className="text-sm text-ink-3">Signed in as {user.email}</p>
      <ChangePasswordForm />
    </div>
  );
}
