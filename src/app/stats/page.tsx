import Link from "next/link";
import { deleteSeason } from "../actions";
import { getSeasons, requireOnboarded, seasonPeers } from "@/lib/queries";
import { latestSeason } from "@/lib/athleteData";
import { positionLabel } from "@/lib/positions";
import {
  fmtPct,
  fmtRate,
  gradeIn,
  hittingPct,
  KEY_RATES,
  PEER_MIN,
  peerRanks,
  perSet,
  RATE_LABELS,
  seasonLabel,
  TEAM_LEVELS,
  totalBlocks,
  type StatValues,
} from "@/lib/stats";
import { SeasonForm } from "@/components/SeasonForm";

const levelLabel = (l: string) => TEAM_LEVELS.find((x) => x.value === l)?.label ?? l;
const n = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v * 10) / 10));
const values = (s: Record<string, unknown>): StatValues =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "number")) as StatValues;

export default async function StatsPage() {
  const { athlete } = await requireOnboarded();
  const first = athlete.name.split(" ")[0];
  const seasons = await getSeasons(athlete.id);
  const latest = latestSeason(seasons);
  const now = new Date();
  const currentSeason = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const seasonChoices = Array.from({ length: 6 }, (_, i) => currentSeason - i).filter((s) => s >= athlete.gradYear - 7);

  // Compare her latest season with peers: same position, team level and grade.
  const peers = latest
    ? (await seasonPeers(athlete.position, latest.level, athlete.id))
        .filter((p) => gradeIn(p.season.season, p.gradYear) === gradeIn(latest.season, athlete.gradYear))
        .map((p) => values(p.season))
    : [];
  const ranks = latest ? peerRanks(values(latest), peers) : null;
  const keyRates = KEY_RATES[athlete.position] ?? KEY_RATES.OH;
  const pos = positionLabel(athlete.position).toLowerCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{first}&apos;s stats</h1>
        <p className="mt-1 text-sm text-ink-2">
          Season by season, with per-set numbers coaches look at. Her latest season goes into her coach emails automatically.
          {athlete.maxprepsUrl ? (
            <>
              {" "}
              Her <a href={athlete.maxprepsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">MaxPreps page ↗</a> is linked too.
            </>
          ) : (
            <>
              {" "}
              Add her MaxPreps page on her <Link href="/profile" className="text-accent-ink underline">profile</Link> so coaches can click through.
            </>
          )}
        </p>
      </div>

      {latest && ranks && (
        <section className="card space-y-3 p-4">
          <h2 className="font-medium">
            {seasonLabel(latest.season)} {levelLabel(latest.level).toLowerCase()} · {gradeIn(latest.season, athlete.gradYear)}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {keyRates.map((k) => (
              <div key={k} className="rounded-lg border border-line p-3">
                <div className="text-xs text-ink-3">{RATE_LABELS[k]} per set</div>
                <div className="tabular text-xl font-semibold">{ranks[k].value == null ? "—" : fmtRate(ranks[k].value!)}</div>
                <div className="text-xs text-ink-3">
                  {ranks[k].pct != null ? `${ranks[k].pct}th percentile` : ranks[k].value == null ? "not entered" : `${ranks[k].n} of ${PEER_MIN} peers so far`}
                </div>
              </div>
            ))}
          </div>
          {hittingPct(latest) != null && <p className="text-sm">Hitting: <b className="tabular">{fmtPct(hittingPct(latest)!)}</b></p>}
          <p className="text-xs text-ink-3">
            Percentiles compare her with other VB Elite {pos}s in the same grade and team level. They appear once {PEER_MIN} athletes
            have entered that season, and get more accurate as more families add stats.
          </p>
        </section>
      )}

      <SeasonForm seasons={seasonChoices} defaultSeason={currentSeason} maxprepsUrl={athlete.maxprepsUrl} />

      {seasons.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">All seasons</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="px-3 py-2 font-medium">Season</th>
                  <th className="px-3 py-2 text-right font-medium">Sets</th>
                  <th className="px-3 py-2 text-right font-medium">Kills</th>
                  <th className="px-3 py-2 text-right font-medium">Hit %</th>
                  <th className="px-3 py-2 text-right font-medium">Assists</th>
                  <th className="px-3 py-2 text-right font-medium">Aces</th>
                  <th className="px-3 py-2 text-right font-medium">Digs</th>
                  <th className="px-3 py-2 text-right font-medium">Blocks</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => {
                  const r = perSet(s);
                  const h = hittingPct(s);
                  const cell = (total: number | null | undefined, rate: number | null) => (
                    <td className="tabular px-3 py-2 text-right">
                      {n(total)}
                      {rate != null && <div className="text-xs text-ink-3">{fmtRate(rate)}/set</div>}
                    </td>
                  );
                  return (
                    <tr key={s.id} className="border-b border-line align-top last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{seasonLabel(s.season)}</div>
                        <div className="text-xs text-ink-3">{levelLabel(s.level)} · {gradeIn(s.season, athlete.gradYear)}</div>
                      </td>
                      <td className="tabular px-3 py-2 text-right">{n(s.sets)}</td>
                      {cell(s.kills, r.kills)}
                      <td className="tabular px-3 py-2 text-right">{h == null ? "—" : fmtPct(h)}</td>
                      {cell(s.assists, r.assists)}
                      {cell(s.aces, r.aces)}
                      {cell(s.digs, r.digs)}
                      {cell(totalBlocks(s), r.blocks)}
                      <td className="px-3 py-2 text-right">
                        <form action={deleteSeason}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-xs text-ink-3 hover:text-bad" aria-label={`Delete ${seasonLabel(s.season)} ${levelLabel(s.level)}`}>Delete</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3">Blocks = solo blocks + half of block assists. To change a season, save it again with the same season and team.</p>
        </section>
      )}
    </div>
  );
}
