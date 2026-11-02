import { coachLinks } from "@/lib/coachLinks";
import { levelText, parseResponse, roleText } from "@/lib/coach";
import { CoachLinkForm } from "./CoachLinkForm";

const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "Confirm with her coach": links sent, their answers, and a form to send a new one. */
export async function CoachConfirmSection({ athleteId, athleteName }: { athleteId: number; athleteName: string }) {
  const links = await coachLinks(athleteId);
  const now = new Date();
  const first = athleteName.split(" ")[0];
  return (
    <section className="card space-y-4 p-5" id="coach">
      <div>
        <h2 className="font-medium">Confirm with {first}&apos;s coach</h2>
        <p className="mt-1 text-sm text-ink-2">
          Her coach&apos;s honest view of her level is the most reliable input we have. Send them a link: they answer four
          quick questions, no account needed, and her estimate and recommendations update.
        </p>
      </div>
      {links.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {links.map((l) => {
            const r = parseResponse(l.response);
            const status = l.respondedAt
              ? `Answered ${date(l.respondedAt)}`
              : l.expiresAt < now
                ? "Expired"
                : `Waiting · sent ${date(l.createdAt)}`;
            return (
              <li key={l.id} className="space-y-1 px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{r?.coachName ?? l.coachName} <span className="font-normal text-ink-3">· {roleText(l.coachRole)}{r?.club ? `, ${r.club}` : ""}</span></span>
                  <span className={`text-xs ${l.respondedAt ? "text-good" : "text-ink-3"}`}>{status}</span>
                </div>
                {r && (
                  <div className="text-ink-2">
                    Level: <b>{levelText(r.level)}</b>
                    {r.note && <p className="mt-1 whitespace-pre-line text-ink-2">&ldquo;{r.note}&rdquo;</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <CoachLinkForm athleteName={athleteName} />
    </section>
  );
}
