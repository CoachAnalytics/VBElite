import Link from "next/link";
import { addRecommended } from "../actions";
import { formatHeight } from "@/lib/format";
import { positionLabel } from "@/lib/positions";
import { parseAnswers } from "@/lib/questionnaire";
import { estimateLevel, heightBenchmarks, levelPhrase, programLevels, recommend, type Tier } from "@/lib/recommend";
import { commitHeights, getRecommendationData, getRecruitingEvents, getSavedSchools, lastMeasuredAt, requireOnboarded } from "@/lib/queries";
import { ageAdjusted, ageYears, collegeMeasurables, monthsSince, shareBelow } from "@/lib/development";
import { currentMeasurables } from "@/lib/athleteData";
import { MeasurablesCard, type CollegeBand } from "@/components/MeasurablesCard";
import { interestLevel, schoolStatuses } from "@/lib/recruiting";
import { latestConfirmation } from "@/lib/coachLinks";
import { CoachConfirmSection } from "@/components/CoachConfirmSection";

const TIER_INFO: Record<Tier, { title: string; blurb: string }> = {
  reach: { title: "Reach", blurb: "Stronger programs than her estimated level. Worth contacting, but expect a tougher path to a roster spot." },
  target: { title: "Target", blurb: "Programs at her estimated level: the best place to focus." },
  likely: { title: "Likely", blurb: "Programs where she'd be among the stronger recruits, with a good chance of playing early." },
};

export default async function RecommendationsPage() {
  const { athlete } = await requireOnboarded();
  const answers = parseAnswers(athlete.questionnaire);
  const [{ schools, players }, saved, confirmation, events, commits, measuredAt] = await Promise.all([
    getRecommendationData(athlete.position, athlete.gradYear),
    getSavedSchools(athlete.id),
    latestConfirmation(athlete.id),
    getRecruitingEvents(athlete.id),
    commitHeights(athlete.position),
    lastMeasuredAt(athlete.id),
  ]);
  const savedIds = new Set(saved.map((s) => s.schoolId));
  const levels = programLevels(schools);
  const benchmarks = heightBenchmarks(players, levels);
  const basics = {
    position: athlete.position,
    heightIn: athlete.heightIn,
    homeState: athlete.homeState,
    latitude: athlete.latitude,
    longitude: athlete.longitude,
  };
  const strongest = interestLevel(schoolStatuses(events), levels);
  const interest = strongest
    ? { ...strongest, schoolName: schools.find((x) => x.id === strongest.schoolId)?.name ?? "a school" }
    : null;
  // Age-adjusted measurables: compared with elite peers her age, projected to 18.
  const now = new Date();
  const birth = athlete.birthYear && athlete.birthMonth ? { year: athlete.birthYear, month: athlete.birthMonth } : null;
  const age = ageYears(now, athlete.gradYear, birth);
  const measurables = { ...currentMeasurables(athlete), heightIn: confirmation?.heightIn ?? athlete.heightIn };
  const views = ageAdjusted(measurables, age, athlete.position);
  const projectedOf = (k: string) => views.find((v) => v.key === k)?.projectedIn.mid ?? null;
  const bandHeights = [
    { label: "Lower-conference", h: benchmarks.low },
    { label: "Mid-level", h: benchmarks.mid },
    { label: "Top D1", h: benchmarks.high },
  ];
  const college: CollegeBand[] = bandHeights
    .filter((b): b is { label: string; h: number } => b.h != null)
    .map((b) => ({ label: b.label, values: collegeMeasurables(b.h, athlete.position) }));
  const touchBench = (k: "approach") => {
    const v = bandHeights.map((b) => (b.h != null ? collegeMeasurables(b.h, athlete.position)[k] : null));
    return { low: v[0], mid: v[1], high: v[2] };
  };
  const projectedHeight = projectedOf("height");
  const projection =
    projectedHeight != null ? { heightIn: projectedHeight, approachIn: projectedOf("approach"), approachBenchmarks: touchBench("approach") } : null;
  const estimate = answers ? estimateLevel(answers, basics, benchmarks, confirmation, interest, projection) : null;
  const picks = answers && estimate ? recommend(schools, levels, estimate, answers, basics) : [];
  const first = athlete.name.split(" ")[0];
  const notSaved = picks.filter((p) => !savedIds.has(p.school.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recommended for {first}</h1>
          <p className="mt-1 text-sm text-ink-2">
            A starting list from her questionnaire, {positionLabel(athlete.position).toLowerCase()}, class of {athlete.gradYear}.
            Add the ones that interest you, then compare them side by side.
          </p>
        </div>
        <Link href="/questionnaire" className="btn-secondary">Retake questionnaire</Link>
      </div>

      {estimate && (
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-ink-3">Estimated level</div>
            {estimate.confirmedBy ? (
              <span className="rounded-full bg-good/10 px-2.5 py-0.5 text-xs font-medium text-good">✓ Coach confirmed</span>
            ) : (
              <a href="#coach" className="text-xs text-accent-ink underline">Get it confirmed by her coach</a>
            )}
          </div>
          <div className="text-2xl font-semibold">{estimate.label}</div>
          <p className="text-sm text-ink-2">
            Range:{" "}
            {levelPhrase(estimate.low) === levelPhrase(estimate.high)
              ? levelPhrase(estimate.low)
              : `${levelPhrase(estimate.low)} to ${levelPhrase(estimate.high)}`}
            .
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {estimate.drivers.map((d) => <li key={d}>{d}</li>)}
          </ul>
          {benchmarks.mid != null && (
            <p className="text-xs text-ink-3">
              Average {athlete.position} height on current D1 rosters: lower conferences {formatHeight(benchmarks.low)}, mid-level{" "}
              {formatHeight(benchmarks.mid)}, top programs {formatHeight(benchmarks.high)}.
              {athlete.heightIn ? ` ${first} is ${formatHeight(athlete.heightIn)}.` : ""}
            </p>
          )}
          {estimate.belowD1 && (
            <p className="rounded-md border border-warn/40 p-3 text-sm">
              Her answers point mostly to D2, D3 or NAIA programs. VB Elite covers Division I schools today (other divisions
              are coming), so the schools below are D1 reaches. Her club coach is the best guide to programs at those levels.
            </p>
          )}
          <p className="text-xs text-ink-3">
            This is an estimate from self-reported answers, not a rating. Skill, how she plays on film and how coaches see her
            matter most, so use it as a starting point and talk it through with her club coach.
          </p>
        </section>
      )}

      <MeasurablesCard
        first={first}
        position={athlete.position}
        age={age}
        ageExact={!!birth}
        views={views}
        college={college}
        commitPct={projectedHeight != null ? shareBelow(projectedHeight, commits) : null}
        monthsSinceMeasured={measuredAt ? monthsSince(measuredAt, now) : athlete.heightUpdatedAt ? monthsSince(athlete.heightUpdatedAt, now) : null}
        consent={athlete.researchConsent}
      />

      {notSaved.length > 0 && (
        <form action={addRecommended} className="flex flex-wrap items-center gap-3">
          {notSaved.map((p) => <input key={p.school.id} type="hidden" name="pick" value={`${p.school.id}:${p.tier}`} />)}
          <button className="btn-primary">Add all {notSaved.length} to my list</button>
          <span className="text-sm text-ink-3">Reaches go on your Reach list, targets on your Main list, likely schools on Exploring.</span>
        </form>
      )}

      {(["reach", "target", "likely"] as Tier[]).map((tier) => {
        const list = picks.filter((p) => p.tier === tier);
        return (
          <section key={tier} className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">{TIER_INFO[tier].title} <span className="text-base font-normal text-ink-3">· {list.length}</span></h2>
              <p className="text-sm text-ink-2">{TIER_INFO[tier].blurb}</p>
            </div>
            {list.length === 0 ? (
              <p className="card p-4 text-sm text-ink-3">
                No schools fit here with your current distance and preferences. Widen the distance on the questionnaire to see more.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((p) => {
                  const isSaved = savedIds.has(p.school.id);
                  return (
                    <div key={p.school.id} className="card flex flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/schools/${p.school.slug}`} className="font-medium hover:underline">{p.school.name}</Link>
                          <div className="text-xs text-ink-3">
                            {[p.school.city, p.school.state].filter(Boolean).join(", ")} · {p.school.conference}
                          </div>
                        </div>
                        {isSaved ? (
                          <span className="shrink-0 text-xs text-good">✓ On my list</span>
                        ) : (
                          <form action={addRecommended}>
                            <input type="hidden" name="pick" value={`${p.school.id}:${p.tier}`} />
                            <button className="btn-secondary shrink-0 px-2.5 py-1 text-xs">+ Add</button>
                          </form>
                        )}
                      </div>
                      <ul className="mt-2 space-y-0.5 text-sm text-ink-2">
                        {p.reasons.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <CoachConfirmSection athleteId={athlete.id} athleteName={athlete.name} />

      <p className="text-sm text-ink-2">
        Want to look further? <Link href="/schools" className="text-accent-ink underline">Browse all 348 D1 schools</Link> or{" "}
        <Link href="/compare" className="text-accent-ink underline">compare your list</Link>.
      </p>
    </div>
  );
}
