"use client";

import { useActionState, useEffect, useState } from "react";
import { saveQuestionnaire } from "@/app/actions";
import { formatHeight, parseHeight, REACH_RANGE } from "@/lib/format";
import { STEPS, stepsFor, type Answers, type Question } from "@/lib/questionnaire";
import { DataNotice } from "./DataNotice";

type Draft = Record<string, string | string[]>;

/** Answers in form-field form: heights as typed text, numbers as text, lists as arrays. */
function toDraft(a: Answers | null): Draft {
  const d: Draft = {};
  for (const q of STEPS.flatMap((s) => s.questions)) {
    const v = a?.[q.id as keyof Answers];
    if (q.kind === "multi") d[q.id] = (v as string[] | undefined) ?? [];
    else if (q.kind === "height") d[q.id] = typeof v === "number" ? formatHeight(v) : "";
    else d[q.id] = v == null ? "" : String(v);
  }
  return d;
}

/** Turns the draft into the shape the server checks, or the first problem found. */
function toAnswers(d: Draft, questions: Question[]): { answers?: Record<string, unknown>; error?: string } {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const v = d[q.id];
    if (q.kind === "multi") {
      out[q.id] = v;
      continue;
    }
    const text = String(v ?? "").trim();
    if (!text && !q.optional && q.kind !== "text") return { error: `Please answer "${q.label}".` };
    if (q.kind === "height") {
      const inches = text ? parseHeight(text, REACH_RANGE) : null;
      if (text && inches == null) return { error: `Couldn't read "${text}" for ${q.label.toLowerCase()}. Try 9'10" or 118 (inches).` };
      out[q.id] = inches;
    } else if (q.kind === "number") {
      const n = text ? Number(text) : null;
      if (text && (!Number.isInteger(n) || n! < 400 || n! > 1600)) return { error: "Enter an SAT score between 400 and 1600, or leave it blank." };
      out[q.id] = n;
    } else {
      out[q.id] = text;
    }
  }
  return { answers: out };
}

// Answers in progress are kept on this device so leaving the page (or the phone's back
// gesture) doesn't lose them; cleared when the questionnaire is submitted.
const draftKey = (athleteId: number) => `vbelite-questionnaire-draft-${athleteId}`;

function readSaved(key: string): { draft: Draft; step: number } | null {
  try {
    const raw = sessionStorage.getItem(key);
    const saved = raw ? JSON.parse(raw) : null;
    return saved && typeof saved.step === "number" && saved.draft ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string, draft: Draft, step: number) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ draft, step }));
  } catch {
    // Storage can be unavailable (private mode); the questionnaire still works.
  }
}

export function Questionnaire({ initial, athleteId, position }: { initial: Answers | null; athleteId: number; position: string }) {
  // Only the questions for her position (e.g. the 5-1 / 6-2 question is for setters).
  const steps = stepsFor(position);
  const key = draftKey(athleteId);
  const [state, action, pending] = useActionState(saveQuestionnaire, undefined);
  // Rendered only in the browser (see QuestionnaireLoader), so saved answers can be read here.
  const [saved] = useState(() => readSaved(key));
  const [step, setStepState] = useState(() => {
    if (!saved) return 0;
    const fromUrl = Number(new URLSearchParams(location.hash.slice(1)).get("step"));
    return Math.min(steps.length - 1, Math.max(0, Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl - 1 : saved.step));
  });
  const [draft, setDraft] = useState<Draft>(() => saved?.draft ?? toDraft(initial));
  const [error, setError] = useState<string | null>(null);

  // Let the browser's back/forward buttons move between steps.
  useEffect(() => {
    if (history.state?.questionnaireStep == null) {
      history.replaceState({ ...history.state, questionnaireStep: step + 1 }, "", `#step=${step + 1}`);
    }
    const onPop = (e: PopStateEvent) => {
      const n = e.state?.questionnaireStep;
      if (typeof n === "number") {
        setStepState(Math.min(steps.length - 1, Math.max(0, n - 1)));
        setError(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Runs once on mount; later steps are pushed by goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => writeSaved(key, draft, step), [key, draft, step]);

  const goTo = (n: number) => {
    setStepState(n);
    history.pushState({ ...history.state, questionnaireStep: n + 1 }, "", `#step=${n + 1}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const current = steps[step];
  const last = step === steps.length - 1;
  const set = (id: string, value: string | string[]) => {
    setDraft((d) => ({ ...d, [id]: value }));
    setError(null);
  };

  const next = () => {
    const check = toAnswers(draft, current.questions);
    if (check.error) return setError(check.error);
    setError(null);
    goTo(step + 1);
  };
  const back = () => {
    setError(null);
    // Use the browser's history so its back button and ours stay in step.
    if (history.state?.questionnaireStep === step + 1 && step > 0) history.back();
    else goTo(step - 1);
  };
  const all = toAnswers(draft, steps.flatMap((s) => s.questions));

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Only the last step submits. Enter in a text box on an earlier step moves to the next step.
        if (!last) {
          e.preventDefault();
          next();
        } else if (all.error) {
          e.preventDefault();
          setError(all.error);
        } else {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        }
      }}
      className="space-y-6"
    >
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{current.title}</span>
          <span className="text-ink-3">Step {step + 1} of {steps.length}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
          <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink-2">{current.intro}</p>
        {current.questions.some((q) => q.kind === "height") && <div className="mt-2"><DataNotice what="Reach and touch measurements" /></div>}
      </div>

      {current.questions.map((q) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="font-medium">
            {q.label}
            {q.optional && <span className="ml-1 text-sm font-normal text-ink-3">(optional)</span>}
          </legend>
          {q.help && <p className="text-sm text-ink-3">{q.help}</p>}
          {q.kind === "choice" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options!.map((o) => {
                const on = draft[q.id] === o.value;
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => set(q.id, o.value)}
                    aria-pressed={on}
                    className={`rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${on ? "border-accent bg-accent/10 font-medium" : "border-line hover:bg-surface-2"}`}
                  >
                    {o.label}
                    {o.hint && <span className="block text-xs font-normal text-ink-3">{o.hint}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {q.kind === "multi" && (
            <div className="flex flex-wrap gap-2">
              {q.options!.map((o) => {
                const list = draft[q.id] as string[];
                const on = list.includes(o.value);
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => set(q.id, on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent text-accent-contrast" : "border-line text-ink-2 hover:bg-surface-2"}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
          {(q.kind === "height" || q.kind === "text" || q.kind === "number") && (
            <input
              value={draft[q.id] as string}
              onChange={(e) => set(q.id, e.target.value)}
              placeholder={q.placeholder}
              inputMode={q.kind === "number" ? "numeric" : q.kind === "text" ? "url" : undefined}
              autoCorrect="off"
              autoCapitalize="off"
              className="input max-w-xs"
              aria-label={q.label}
            />
          )}
        </fieldset>
      ))}

      {(error || state?.error) && <p className="text-sm text-bad" role="alert">{error ?? state?.error}</p>}

      <input type="hidden" name="answers" value={JSON.stringify(all.answers ?? {})} />
      <div className="flex gap-3">
        {step > 0 && (
          <button key="back" type="button" className="btn-secondary" onClick={back}>
            Back
          </button>
        )}
        {/* Distinct keys: the tap on "Next" must never land on the submit button that replaces it. */}
        {last ? (
          <button key="submit" type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Finding schools…" : "See my recommended schools"}
          </button>
        ) : (
          <button key="next" type="button" className="btn-primary" onClick={next}>Next</button>
        )}
      </div>
    </form>
  );
}
