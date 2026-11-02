import type { Metadata } from "next";
import { findCoachLink } from "@/lib/coachLinks";
import { formatHeight } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { CoachResponseForm } from "@/components/CoachResponseForm";

export const metadata: Metadata = { title: "Coach confirmation · VB Elite", robots: { index: false, follow: false } };

/** Public page a coach opens from an athlete's confirmation link; the link itself is the permission. */
export default async function CoachConfirmationPage({ params }: PageProps<"/coach/[token]">) {
  const { token } = await params;
  const found = await findCoachLink(token);

  if (found.problem) {
    const message = {
      missing: "This confirmation link isn't valid. Ask the athlete to send you a new one.",
      answered: "This link has already been answered. Thank you! If something changed, ask the athlete to send a new link.",
      expired: "This link has expired. Ask the athlete to send you a new one.",
    }[found.problem];
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-6 text-center text-ink-2">{message}</div>
      </div>
    );
  }

  const { athlete, link } = found;
  const first = athlete.name.split(" ")[0];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-ink-3">Coach confirmation</p>
        <h1 className="text-2xl font-semibold">{athlete.name}</h1>
        <p className="mt-1 text-ink-2">
          {positionLabel(athlete.position)} · Class of {athlete.gradYear}
          {athlete.heightIn ? ` · ${formatHeight(athlete.heightIn)}` : ""}
        </p>
        <p className="mt-3 text-sm text-ink-2">
          {first}&apos;s family is using VB Elite to build a realistic list of college volleyball programs, and asked for
          your view. It takes about two minutes. Only {first}&apos;s family sees your answers.
        </p>
      </div>
      <CoachResponseForm
        token={token}
        coachName={link.coachName}
        athleteFirst={first}
        listedHeight={athlete.heightIn ? formatHeight(athlete.heightIn) : null}
      />
    </div>
  );
}
