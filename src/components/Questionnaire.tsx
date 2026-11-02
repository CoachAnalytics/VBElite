"use client";

import { useActionState, useState } from "react";
import { saveQuestionnaire } from "@/app/actions";
import { formatHeight, parseHeight, REACH_RANGE } from "@/lib/format";
import { STEPS, type Answers, type Question } from "@/lib/questionnaire";

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

export function Questionnaire({ initial }: { initial: Answers | null }) {
  const [state, action, pending] = useActionState(saveQuestionnaire, undefined);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const set = (id: string, value: string | string[]) => {
    setDraft((d) => ({ ...d, [id]: value }));
    setError(null);
  };

  const next = () => {
    const check = toAnswers(draft, current.questions);
    if (check.error) return setError(check.error);
    setError(null);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const all = toAnswers(draft, STEPS.flatMap((s) => s.questions));

  return (
    <form action={action} className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{current.title}</span>
          <span className="text-ink-3">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-surface-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <p className="mt-3 text-sm text-ink-2">{current.intro}</p>
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
          <button type="button" className="btn-secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}>
            Back
          </button>
        )}
        {last ? (
          <button
            type="submit"
            className="btn-primary"
            disabled={pending}
            onClick={(e) => {
              if (all.error) {
                e.preventDefault();
                setError(all.error);
              }
            }}
          >
            {pending ? "Finding schools…" : "See my recommended schools"}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={next}>Next</button>
        )}
      </div>
    </form>
  );
}
