# Scheduled research refresh

A scheduled Claude Code session runs this weekly. It re-researches the stalest schools,
saves them to the private `CoachAnalytics/VBElite-data` repo, and the live site picks up
the new `seed/schools.json.gz` on its next daily sync (see `src/lib/sync.ts`). Nobody
needs to upload anything.

## Steps

1. **Attach the data repo.** Call `add_repo` for owner `CoachAnalytics`, repo
   `VBElite-data`, access `push`. Clone it to `/home/user/vbelite-data` with the command
   the tool returns. If it can't be attached, stop and report why.
2. **Link it.** `collect/setup_data.sh /home/user/vbelite-data`
3. **Pick schools.** `python3 collect/refresh_queue.py 40` prints up to 10 batches of 4
   schools (least recently researched and weakest first).
4. **Research.** Run one background agent per batch, at most 3 at a time, with the prompt
   below. When an agent reports back, run
   `python3 collect/validate_research.py <ids>`. Fix or revert any file with errors
   (`git -C /home/user/vbelite-data checkout -- research/<id>.json`). Then save:
   `collect/save_research.sh "Refresh: <school names>"`. Launch the next batch.
5. **Log.** Append a dated section to `REVIEW.md` in the data repo listing anything
   uncertain the agents reported (no recruit names), commit and push it.
6. **Finish** with a short summary: schools refreshed, commits added or removed, coaching
   changes, problems. Never commit research or recruit names to the public app repo.

## Agent prompt (fill in the batch JSON and N)

> You are a research agent refreshing a college volleyball recruiting database. Today is
> <date>. First read /home/user/VBElite/collect/RESEARCH.md and follow it exactly,
> especially the rules on respecting blocked sites, on recruits' (minors') data, and on
> finding commits (at least 6 tool calls per school on commits).
>
> Refresh these NCAA Division I women's volleyball programs: <batch JSON>
>
> Each already has a file at /home/user/vbelite-data/research/<ncaaOrgId>.json. Read it
> first, then update it in place: keep facts that are still right, fix what changed
> (head coach, current roster and positions, season records once a season ends), and
> re-check commits for the two classes RESEARCH.md names. Add new commits, and remove
> anyone reported decommitted or who is now on a college roster. If you can't confirm
> something that was there before, keep it, and note that it wasn't re-confirmed.
> Fill gaps listed in the file's notes where you can. Set researchedAt to today.
>
> Keep downloads and helper scripts only in your own folder, <scratchpad>/batchN/.
>
> Tools: WebSearch and WebFetch (load with ToolSearch "select:WebSearch,WebFetch").
> Searches are a shared, limited budget, so keep to about 10 per school. Useful public
> sources: PrepDig school pages (roster, embedded commit list; recruit profiles tag beach
> and other-sport commits), Evollve team pages (positions, records; may count only
> Division I opponents), PrepVolleyball's commitment list, Wikipedia, and official PDFs
> (game notes, record books, media guides) that search results or public pages link to.
> Plain `curl` with an identifying user agent is fine for pages that aren't blocked, and
> so is navigating a public site's own page addresses. If a site returns 403, a bot check
> or 429, don't fetch it again with any tool. Never use headless browsers, a different
> user agent, alternate domains of a blocked site, bucket listings, guessed addresses
> for hidden files or other sites, or anything else that gets past a block.
>
> Exclude beach, men's and other-sport commits (drop SportsRecruits-only commits you
> can't confirm are indoor). Don't infer positions from stats. Never write family
> relationships, speculation about relationships, or other personal details about
> recruits or players anywhere, including notes. Set roster.complete true only for the
> full current team with nearly every position known.
>
> Write each file in the exact RESEARCH.md format and check it with
> `python3 -m json.tool <file> > /dev/null`. No git commands. Reply with a short report
> with no player or recruit names: per school, what changed and anything uncertain.

## Each season

When a new season's NCAA tournament ends (December), the app's season window
(`SEASONS` in `collect/common.py` and the app) should move forward a year and
`collect/tournament.py` should be re-run. That's a code change: the refresh session
should note it in its summary rather than change the app on its own.

Each August 1 the commit window moves too (the 2027 class enrolls; the next class can
commit). Flag that in the summary as well: `RESEARCH.md`, `validate_research.py`'s
grad-year range and the app's class labels need updating together.
