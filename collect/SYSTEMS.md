# Offensive system research (5-1 vs 6-2)

Each school gets `systems/<ncaaOrgId>.json` in the private VBElite-data repo: whether the
program ran a **5-1** (one setter in all six rotations) or a **6-2** (two setters, each setting
from the back row) in the most recent completed season (2025). `collect/build_seed.py` folds
it into the seed; the site shows it on school pages and in comparisons.

## How to decide

1. **Stats (primary).** Find the season's assists and sets played for each setter, from the
   school's season stats, game notes, conference stats or season recaps as search results show
   them.
   - **5-1:** one setter has the large majority of team assists (typically 8+ assists per set,
     80%+ of setter assists) and played nearly all sets.
   - **6-2:** two setters each averaged roughly 3.5-7 assists per set across most of the season.
   - **mixed:** the team switched during the season (e.g. 6-2 early, 5-1 after an injury or
     freshman's emergence), or used both regularly. Say what happened in `evidence`.
2. **Explicit statements.** A coach quote, preview or recap that says "we run a 6-2" counts,
   and overrides ambiguous numbers if it's about the 2025 season.
3. **Confidence:** `confirmed` when stated explicitly or the numbers are unambiguous over a
   full season; `likely` when based on partial-season numbers or one indirect source.
4. If nothing reliable turns up, set `system` and `confidence` to null and say what you tried.
   Never guess from roster size or from how many setters are listed.

## File format

```json
{
  "ncaaOrgId": 175,
  "school": "Dayton",
  "season": 2025,
  "system": "5-1",
  "confidence": "confirmed",
  "setters": [
    { "name": "First Last", "assists": 1050, "sets": 105, "assistsPerSet": 10.0 }
  ],
  "evidence": "One-line plain-English reason, e.g. 'Smith had 10.0 assists/set in 105 of 106 sets.'",
  "sourceUrl": "https://... (official stats page, game notes or recap)",
  "checkedAt": "2026-11-02",
  "notes": "For reviewers: what was blocked, conflicting, or unconfirmed."
}
```

- `system`: "5-1" | "6-2" | "mixed" | null. `confidence`: "confirmed" | "likely" | null.
- `setters`: players who recorded most of the team's assists, with whatever numbers were found
  (null when unknown). College players only; no recruits.
- `evidence` is shown to families on the site: keep it short and factual.

## Rules

- Searches (WebSearch, mode "standard") are a shared budget: 1 per school, a 2nd only when the
  first shows no setter assist numbers or system statement.
- Don't fetch athletics websites or stats.ncaa.org (they block automated requests). Never fetch
  any page that returned 403, a bot check or 429, with any tool, or try to get around a block.
- No personal details about players beyond name and stats.
