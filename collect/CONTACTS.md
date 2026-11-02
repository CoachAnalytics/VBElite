# Coach contact research

Each school has `contacts/<ncaaOrgId>.json` in the private VBElite-data repo: the
volleyball staff a recruit can email. `collect/contacts.py` fills what it can from official
coaches pages; most athletics sites block automated requests, so research agents fill the
rest by following this file. `collect/build_seed.py` folds the files into the seed, and the
site shows them on each school page with an Email button.

## File format

```json
{
  "ncaaOrgId": 175,
  "school": "Dayton",
  "checkedAt": "2026-11-02",
  "method": "search",
  "sourceUrl": "https://daytonflyers.com/sports/womens-volleyball/coaches",
  "contacts": [
    { "name": null, "title": "Program recruiting email", "role": "program", "email": "teamvbrecruiting@school.edu", "phone": null },
    { "name": "First Last", "title": "Head Coach", "role": "head", "email": null, "phone": "(555) 555-5555" },
    { "name": "First Last", "title": "Assistant Coach/Recruiting Coordinator", "role": "recruiting", "email": "flast@school.edu", "phone": null }
  ],
  "recruitingQuestionnaire": "https://... or null",
  "notes": "For reviewers: what was blocked, what couldn't be confirmed."
}
```

- `method`: `script` (read from the coaches page) or `search` (from search results / other official pages).
- `role`: `program` (a shared team or recruiting inbox, `name` null), `head`, `recruiting`
  (recruiting coordinator, whatever else the title says), `assistant` (associate, assistant,
  volunteer, graduate assistant coaches), `operations` (director of volleyball operations).
- Order: program inbox first, then head coach, recruiting coordinator, assistants, operations.
- `email` null when a staff member has none listed. A coach whose listed address is the shared
  inbox gets `email: null` and the inbox appears once as the `program` entry.
- Only current staff for the 2026 season. Leave out trainers, sports information, academic,
  strength and conditioning, and other support staff.

## Rules

1. **Only real, published addresses.** Record an email only when a search result or page shows
   that exact address for that person or program. Never build an address from a pattern
   (first.last@, initials), never guess, never "complete" a partial address.
2. **Official sources only.** The address must be on the school's own domain (or a domain the
   school's athletics department uses, like the athletics site's domain). Third-party
   directories, data brokers and paywalled lists are out.
3. **Current staff.** Check names against the current coaching staff (the research file's head
   coach and the 2026 roster page's staff list as search results show it). Drop people who
   have left; 2013 pages and old press releases are not current.
4. **Respect blocks.** Don't fetch the school's athletics website at all: the collector already
   tried it, and most return a bot check. Never fetch any page that returned 403, a bot check or
   429, with any tool. Never use headless browsers, other user agents, caches/archives of a
   blocked page, or anything else that gets past a block. A university's own staff directory on
   its main site is fine to fetch if it loads normally.
5. **Searches** (WebSearch, mode "standard") are a shared budget: about 2 per school, at most 4.
   Good first query: `<school> volleyball coaches staff email`. A second one, if needed:
   `<school> volleyball recruiting coordinator email` or the head coach's name plus "email".
6. When unsure whether an address is current or belongs to the right person, leave it out and
   say why in `notes`.
