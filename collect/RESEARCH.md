# School research instructions

These are the instructions given to each research agent (a Claude session with web
search and fetch). Each agent researches a batch of NCAA Division I women's volleyball
programs and writes one JSON file per school to `research/<ncaaOrgId>.json` in the private
`CoachAnalytics/VBElite-data` repository (linked locally as `data/raw/research/`).
`collect/build_seed.py` merges those files with the automated sources.

Research files name recruits (mostly minors), so they are never committed to this
public repository. They are kept in the private `CoachAnalytics/VBElite-data` repository.

The automated collectors already cover the conference, location, enrollment, tuition,
academics and NCAA tournament results (2021–2025), so **don't research those**.

## Rules

1. **Public, official information only.** Prefer the school's official athletics website,
   then its conference's site, Wikipedia, the NCAA, and reputable news. For commits, use
   public commitment announcements: school signing-day releases, club announcements,
   PrepVolleyball/PrepDig, VolleyballMag, SportsRecruits or FieldLevel public profiles,
   local news.
2. **Respect access controls.** If a site refuses a request (403, bot check, captcha, login
   wall), don't retry it or work around it. Use another public source, or mark the data
   missing. Never use a headless browser, proxies, spoofed identities or cached-page tricks
   to get past a block.
3. **Recruits are mostly minors. Record only** name, graduating class, position(s) as
   listed, height, high school, hometown (city, state) and club team. Never record social
   media handles, photos, contact details, family details, GPAs or anything else personal.
4. **Never guess.** Leave a value `null` (or a list empty) when no source confirms it, and
   explain in `notes`. Wrong data is worse than missing data.
5. **Cite sources.** Give a URL for every block, and for each commit.
6. Work efficiently: about 15–20 tool calls per school, **at least 6 of them on commits**
   (the hardest and most valuable part). If a source isn't working, move on.
7. Public documents a search engine links to (for example a media-guide PDF on a public file
   host) are fine to read, even when the school's main site blocks automated visitors.

## What to collect

- **shortName**: the common name used in volleyball ("Louisville", "Texas A&M", "UNI").
- **Head coach** and the first season they were head coach there.
- **APR**: the most recent published volleyball Academic Progress Rate, if a school or
  conference release states it (the NCAA's APR database blocks automated access; don't use it).
- **Season records 2021–2025**: overall wins and losses for each fall season, including
  postseason. 2021 means fall 2021 (ignore the spring 2021 COVID season).
- **Current roster (fall 2026)**: every player, with class as listed (Fr/So/Jr/Sr/Gr, plus
  "R-" for redshirts), position as listed, and height.
- **Commits**: verbal commits and signees in the **classes of 2027 and 2028** (high school
  graduation years) at every position. 2029 recruits can't commit until Aug 1, 2027.
- **Finding commits** (try several): the school's signing-day / "signing class" releases
  (November) and "commitment" news; searches like `"committed to <school>" volleyball 2027`,
  `<school> volleyball 2028 commit`, `<school> volleyball recruiting class 2027`; PrepDig and
  PrepVolleyball commitment lists; VolleyballMag and local news; club "college commitments"
  pages. Cross-check: drop anyone later reported as decommitted, and note conflicts.
- **APR**: one search such as `<school> volleyball APR perfect score` is enough.
- **commits.completeness**: "good" if a dedicated, current commit list was found; "partial"
  if pieced together from scattered announcements; "none_found" if nothing public was found.

## Output format

Write exactly this shape (no comments) to `research/<ncaaOrgId>.json`:

```json
{
  "ncaaOrgId": 367,
  "officialName": "University of Louisville",
  "shortName": "Louisville",
  "researchedAt": "2026-10-30",
  "headCoach": { "name": "Coach Name", "since": 2025, "source": "https://..." },
  "apr": { "value": 1000, "year": "2024-25", "note": null, "source": "https://..." },
  "seasons": [
    { "year": 2021, "wins": 32, "losses": 1, "source": "https://..." }
  ],
  "roster": {
    "season": 2026,
    "source": "https://...",
    "complete": true,
    "players": [
      { "name": "Player Name", "class": "So", "redshirt": false, "position": "OH", "heightIn": 74 }
    ]
  },
  "commits": {
    "completeness": "partial",
    "sources": ["https://..."],
    "players": [
      {
        "name": "Recruit Name", "gradYear": 2027, "position": "OH/DS", "heightIn": 72,
        "highSchool": "Example HS", "hometown": "Columbus, OH", "club": "Example VBC",
        "source": "https://...", "note": null
      }
    ]
  },
  "notes": "Anything a reviewer should know: blocked sources, conflicting records, coaching changes."
}
```

- `class`: one of `Fr`, `So`, `Jr`, `Sr`, `Gr` (graduate/5th year). `redshirt`: true if listed with "R-".
- `heightIn`: total inches (6'2" → 74), or null.
- `apr.value`, `headCoach.since`, records and heights: null when not confirmed.
- `roster.complete`: false if you could only find part of the roster.
