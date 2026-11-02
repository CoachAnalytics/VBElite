"use client";

import dynamic from "next/dynamic";
import type { Answers } from "@/lib/questionnaire";

// Browser-only, so answers in progress (kept in this tab) are restored on the first render.
const Questionnaire = dynamic(() => import("./Questionnaire").then((m) => m.Questionnaire), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-3">Loading…</p>,
});

export function QuestionnaireLoader({ initial, athleteId }: { initial: Answers | null; athleteId: number }) {
  return <Questionnaire initial={initial} athleteId={athleteId} />;
}
