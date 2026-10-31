import { CLASS_YEARS, type PositionGroup, type RecruitingPipeline } from "@/lib/analytics";
import { formatHeight } from "@/lib/format";
import { positionLabel } from "@/lib/positions";

const th = "px-3 py-2 font-medium";
const td = "tabular px-3 py-2 text-right";

function posName(code: string) {
  return code === "?" ? "Position not listed" : positionLabel(code);
}

/** The roster by position and class (the spreadsheet's "OH Breakdown", for every position). */
export function RosterBreakdownTable({
  groups,
  rosterSeason,
  highlight,
}: {
  groups: PositionGroup[];
  rosterSeason: number;
  highlight?: string;
}) {
  const total = (pick: (g: PositionGroup) => number) => groups.reduce((n, g) => n + pick(g), 0);
  return (
    <div className="card relative overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-line text-xs text-ink-3">
          <tr>
            <th className={`${th} text-left`}>Position</th>
            {CLASS_YEARS.map((c) => (
              <th key={c} className={`${th} text-right`}>{c === "Grad" ? "Grad / 5th" : c}</th>
            ))}
            <th className={`${th} text-right`}>Total</th>
            <th className={`${th} text-right`} title="Players listed with a redshirt">Redshirt</th>
            <th className={`${th} text-right`} title="Seniors and grad students">Leaving after {rosterSeason}</th>
            <th className={`${th} text-right`} title="Listed at more than one position">Hybrids</th>
            <th className={`${th} text-right`}>Avg height</th>
            <th className={`${th} text-right`}>Shortest</th>
            <th className={`${th} text-right`}>Tallest</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.position} className={`border-b border-line last:border-0 ${g.position === highlight ? "bg-accent/10 font-medium" : ""}`}>
              <td className="px-3 py-2">
                {posName(g.position)}
                {g.alsoListed > 0 && <div className="text-xs font-normal text-ink-3">+{g.alsoListed} also listed here</div>}
              </td>
              {CLASS_YEARS.map((c) => (
                <td key={c} className={`${td} ${g.byClass[c] ? "" : "text-ink-3"}`}>{g.byClass[c]}</td>
              ))}
              <td className={`${td} font-semibold`}>{g.total}</td>
              <td className={td}>{g.redshirts}</td>
              <td className={td}>{g.leaving}</td>
              <td className={td}>{g.hybrids}</td>
              <td className={td}>{formatHeight(g.avgHeight)}</td>
              <td className={td} title={g.shortest?.name}>{formatHeight(g.shortest?.heightIn)}</td>
              <td className={td} title={g.tallest?.name}>{formatHeight(g.tallest?.heightIn)}</td>
            </tr>
          ))}
          <tr className="border-t border-line text-ink-2">
            <td className="px-3 py-2 font-medium">All players</td>
            {CLASS_YEARS.map((c) => (
              <td key={c} className={td}>{total((g) => g.byClass[c])}</td>
            ))}
            <td className={`${td} font-semibold`}>{total((g) => g.total)}</td>
            <td className={td}>{total((g) => g.redshirts)}</td>
            <td className={td}>{total((g) => g.leaving)}</td>
            <td className={td}>{total((g) => g.hybrids)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Commits by position and class (the spreadsheet's "Recruiting Pipeline", for every position). */
export function PipelineTable({ pipeline, highlight }: { pipeline: RecruitingPipeline; highlight?: string }) {
  return (
    <div className="card relative overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="border-b border-line text-xs text-ink-3">
          <tr>
            <th className={`${th} text-left`}>Position</th>
            {pipeline.classes.map((y) => (
              <th key={y} className={`${th} text-right`}>Class of {y}</th>
            ))}
            <th className={`${th} text-right`}>Total incoming</th>
            <th className={`${th} text-right`}>Avg height</th>
          </tr>
        </thead>
        <tbody>
          {pipeline.rows.map((r) => (
            <tr key={r.position} className={`border-b border-line last:border-0 ${r.position === highlight ? "bg-accent/10 font-medium" : ""}`}>
              <td className="px-3 py-2">{posName(r.position)}</td>
              {pipeline.classes.map((y) => (
                <td key={y} className={`${td} ${r.byClass[y] ? "" : "text-ink-3"}`}>
                  {r.byClass[y]}
                  {r.hybridByClass[y] > 0 && (
                    <span className="text-xs font-normal text-ink-3" title="Commits who also list this position"> +{r.hybridByClass[y]} hybrid</span>
                  )}
                </td>
              ))}
              <td className={`${td} font-semibold`}>{r.total}</td>
              <td className={td}>{formatHeight(r.avgHeight)}</td>
            </tr>
          ))}
          <tr className="border-t border-line text-ink-2">
            <td className="px-3 py-2 font-medium">All commits</td>
            {pipeline.classes.map((y) => (
              <td key={y} className={td}>{pipeline.totalByClass[y]}</td>
            ))}
            <td className={`${td} font-semibold`}>{pipeline.total}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
