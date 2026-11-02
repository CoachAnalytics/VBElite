"""Merges every source into data/seed/schools.json, which `npm run db:seed` loads.

Sources (all in data/raw/):
  directory.json   every D1 program (NCAA directory + Wikipedia)        collect/directory.py
  tournament.json  NCAA tournament fields and results 2021-2025          collect/tournament.py
  scorecard.json   location, enrollment, tuition, academics              collect/scorecard.py
  research/*.json  coach, APR, records, roster, commits (with sources)   research agents, see RESEARCH.md
  spreadsheet.json the original hand-researched workbook (optional)      npm run import:xlsx, then move here

Precedence: tournament records > research > spreadsheet (validate_research.py lists conflicts). Commits from the
spreadsheet are kept alongside researched ones (deduplicated by name).

    python collect/build_seed.py
"""
import gzip
import json

from common import RAW, ROOT, SEASONS, norm, read_json, slugify

ALL_POSITIONS = ["S", "OH", "OPP", "MB", "LDS"]
ROSTER_SEASON = 2026
# Second-to-last words that belong to a two-word mascot ("Tar Heels", "Nittany Lions").
MASCOT_LEADS = {
    "golden", "blue", "red", "green", "fighting", "fightin", "lady", "nittany", "tar", "great", "rainbow",
    "ragin", "horned", "yellow", "mean", "black", "scarlet", "sun", "demon", "purple", "thundering",
    "crimson", "wolf", "big", "running", "screaming", "river", "sea",
}
# Directory team names that aren't "<place> <mascot>".
TEAM_NAME_FIXES = {"The Beach (or Long Beach State Beach)": "Long Beach State"}
# Spreadsheet short names that don't uniquely prefix a directory team.
SHEET_ALIASES = {
    "College of Charleston": "Charleston Cougars",
    "Georgia": "Georgia Bulldogs",
    "North Carolina": "North Carolina Tar Heels",
    "San Diego": "San Diego Toreros",
    "Tennessee": "Tennessee Volunteers",
    "USC": "USC Trojans",
    "Western Kentucky": "WKU Lady Toppers",
}


def short_name(d) -> str:
    """'Penn State Nittany Lions' -> 'Penn State' (until research supplies the common name)."""
    team = d["team"] or d["officialName"]
    if team in TEAM_NAME_FIXES:
        return TEAM_NAME_FIXES[team]
    words = team.split()
    drop = 2 if len(words) > 2 and norm(words[-2]) in MASCOT_LEADS else 1
    return " ".join(words[:-drop]) or team


def class_year(c: str | None):
    c = (c or "").replace("R-", "").strip().lower()
    if c.startswith("gr") or c.startswith("5"):
        return "Grad"
    return {"fr": "Fr", "so": "So", "jr": "Jr", "sr": "Sr"}.get(c[:2])


def same_recruit(a, b) -> bool:
    """Same class and last name, and first names that start alike ("Elly" / "Ellyson")."""
    if a.get("gradYear") != b.get("gradYear"):
        return False
    na, nb = norm(a["name"]).split(), norm(b["name"]).split()
    if not na or not nb or na[-1] != nb[-1]:
        return False
    return na[0][:3] == nb[0][:3]


def load_research():
    out = {}
    for p in sorted((RAW / "research").glob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"SKIP {p.name}: invalid JSON ({e})")
            continue
        out[str(r.get("ncaaOrgId") or p.stem)] = r
    return out


def match_sheet(sheet, directory):
    by_team = {norm(d["team"] or ""): d for d in directory}
    out = {}
    for s in sheet:
        team = SHEET_ALIASES.get(s["name"])
        if team:
            d = by_team.get(norm(team))
        else:
            hits = [d for t, d in by_team.items() if t.startswith(norm(s["name"]) + " ")]
            d = hits[0] if len(hits) == 1 else None
        if d:
            out[str(d["ncaaOrgId"])] = s
        else:
            print(f"spreadsheet school not matched: {s['name']}")
    return out


def build_school(d, sc, tr, r, sh):
    name = (r or {}).get("shortName") or (sh or {}).get("name") or short_name(d)

    # Seasons: tournament-derived final record (structured, cross-checked) > research > spreadsheet.
    rec_research = {s["year"]: s for s in (r or {}).get("seasons", []) if s.get("wins") is not None}
    rec_sheet = {s["year"]: s for s in (sh or {}).get("seasons", [])}
    seasons = []
    for y in SEASONS:
        t = tr.get(str(y))
        wins = losses = None
        if t and t.get("finalWins") is not None:
            wins, losses = t["finalWins"], t["finalLosses"]
        elif y in rec_research:
            wins, losses = rec_research[y]["wins"], rec_research[y]["losses"]
        elif y in rec_sheet:
            wins, losses = rec_sheet[y]["wins"], rec_sheet[y]["losses"]
        seasons.append(
            {"year": y, "wins": wins, "losses": losses, "postseason": t["finish"] if t else "DNQ", "ncaaSeed": t.get("seed") if t else None}
        )

    roster, commits, covered, quality, sources = [], [], [], None, []
    rr = (r or {}).get("roster") or {}
    # The hand-researched spreadsheet lists every outside hitter for its schools; use it to
    # fill positions the research couldn't find.
    sheet_roster = {norm(p["name"]): p for p in (sh or {}).get("roster", [])}
    if rr.get("players"):
        for p in rr["players"]:
            cy = class_year(p.get("class"))
            if cy and p.get("name"):
                position = p.get("position") or (sheet_roster.get(norm(p["name"])) or {}).get("positionRaw")
                roster.append(
                    {
                        "name": p["name"],
                        "classYear": cy,
                        "redshirt": bool(p.get("redshirt")),
                        "positionRaw": position,
                        "heightIn": p.get("heightIn"),
                    }
                )
        # Only project playing time from rosters that are complete AND say who plays where;
        # otherwise every position would look empty.
        with_position = sum(1 for p in roster if p.get("positionRaw"))
        if rr.get("complete") and with_position >= 0.8 * len(rr["players"]):
            covered = ALL_POSITIONS
        elif sh and sh.get("positionsCovered"):
            covered = sh["positionsCovered"]  # the spreadsheet's position (outside hitter) is complete
        if rr.get("source"):
            sources.append(rr["source"])
    elif sh and sh.get("roster"):
        roster, covered = sh["roster"], sh.get("positionsCovered", ["OH"])

    rc = (r or {}).get("commits") or {}
    sheet_commits = {norm(c["name"]): c for c in (sh or {}).get("commits", [])}
    for c in rc.get("players") or []:
        if not c.get("name") or not c.get("gradYear"):
            continue
        commits.append(
            {
                "name": c["name"],
                "gradYear": c["gradYear"],
                "positionRaw": c.get("position"),
                # The spreadsheet's judgment of where a hybrid recruit will play, when it has one.
                "primaryPosition": (sheet_commits.get(norm(c["name"])) or {}).get("primaryPosition"),
                "heightIn": c.get("heightIn"),
                "highSchool": c.get("highSchool"),
                "hometown": c.get("hometown"),
                "club": c.get("club"),
                "note": c.get("note"),
                "source": c.get("source"),
            }
        )
    for c in (sh or {}).get("commits", []):
        match = next((x for x in commits if same_recruit(x, c)), None)
        if match:
            # Same recruit under a nickname: keep the research entry, fill its gaps from the spreadsheet.
            for k in ("heightIn", "club", "hometown", "primaryPosition"):
                match[k] = match.get(k) or c.get(k)
        else:
            commits.append({**c, "source": c.get("source") or "VB Elite research spreadsheet"})
    if r and rc:
        quality = {"good": "good", "partial": "partial", "none_found": "partial"}.get(rc.get("completeness"))
        sources += rc.get("sources") or []
    elif sh:
        quality = sh.get("commitDataQuality")

    coach = (r or {}).get("headCoach") or {}
    apr = (r or {}).get("apr") or {}
    if r:
        sources += [x for x in [coach.get("source"), apr.get("source")] if x]
        sources += [s.get("source") for s in r.get("seasons", []) if s.get("source")]

    # Research notes are working notes for reviewers (blocked sites, source conflicts); only the
    # spreadsheet's recruiting note is written for families.
    notes = [x for x in [(sh or {}).get("recruitingNote")] if x]
    return {
        "slug": slugify(name),
        "name": name,
        "ncaaOrgId": d["ncaaOrgId"],
        "scorecardUnitId": sc.get("unitId"),
        "officialName": d["officialName"],
        "team": d["team"],
        "website": d["website"],
        "athleticsWebsite": d["athleticsWebsite"],
        "city": sc.get("city") or (sh or {}).get("city"),
        "state": d["state"] or sc.get("state"),
        "latitude": sc.get("latitude"),
        "longitude": sc.get("longitude"),
        "division": "D1",
        "conference": d["conference"],
        "control": d["control"],
        "enrollment": sc.get("undergradEnrollment"),
        "enrollmentNote": "Undergraduates (College Scorecard)" if sc else None,
        "tuitionInState": sc.get("tuitionInState"),
        "tuitionOutState": sc.get("tuitionOutState"),
        "tuitionYear": "Latest published (College Scorecard)" if sc else None,
        "admissionRate": sc.get("admissionRate"),
        "satAvg": sc.get("satAvg"),
        "act25": sc.get("act25"),
        "act75": sc.get("act75"),
        "costOfAttendance": sc.get("costOfAttendance"),
        "avgNetPrice": sc.get("avgNetPricePublic") if d["control"] == "public" else sc.get("avgNetPricePrivate"),
        "graduationRate": sc.get("graduationRate"),
        "retentionRate": sc.get("retentionRate"),
        "medianEarnings": sc.get("medianEarnings10yr"),
        "studentFacultyRatio": sc.get("studentFacultyRatio"),
        "headCoach": coach.get("name") or (sh or {}).get("headCoach"),
        "coachSince": coach.get("since") or (sh or {}).get("coachSince"),
        # The APR and its note come from the same source; a research note explaining a missing
        # APR is for reviewers, not families.
        "apr": apr.get("value") if apr.get("value") is not None else (sh or {}).get("apr"),
        "aprNote": (apr.get("year") or apr.get("note")) if apr.get("value") is not None else (sh or {}).get("aprNote"),
        "rosterSize": len(roster) if rr.get("complete") else (sh or {}).get("rosterSize"),
        "rosterSeason": ROSTER_SEASON,
        "positionsCovered": covered,
        "commitDataQuality": quality,
        "recruitingNote": " ".join(notes) or None,
        "programNote": (sh or {}).get("programNote"),
        "researchedAt": (r or {}).get("researchedAt"),
        "sources": sorted(set(sources)),
        "seasons": seasons,
        "roster": roster,
        "commits": commits,
    }


def load_contacts():
    """Coach and program emails per school (contacts/<ncaaOrgId>.json, see collect/CONTACTS.md)."""
    out = {}
    folder = RAW / "contacts"
    if not folder.exists():
        return out
    for p in sorted(folder.glob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"SKIP contacts/{p.name}: invalid JSON ({e})")
            continue
        out[str(r.get("ncaaOrgId") or p.stem)] = r
    return out


def load_systems():
    """5-1 / 6-2 research per school (systems/<ncaaOrgId>.json, see collect/SYSTEMS.md)."""
    out = {}
    folder = RAW / "systems"
    if not folder.exists():
        return out
    for p in sorted(folder.glob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"SKIP systems/{p.name}: invalid JSON ({e})")
            continue
        out[str(r.get("ncaaOrgId") or p.stem)] = r
    return out


def system_fields(r):
    if not r:
        return {}
    url = r.get("sourceUrl")
    return {
        "offense": {
            "system": r.get("system"),
            "confidence": r.get("confidence"),
            "season": r.get("season"),
            "evidence": r.get("evidence"),
            "source": url if isinstance(url, str) and url.startswith("http") else None,
        }
    }


def contact_fields(c):
    """Seed fields for one school's contacts; only real, emailable entries are kept."""
    if not c:
        return {}
    people = [
        {k: x.get(k) for k in ("name", "title", "role", "email", "phone")}
        for x in c.get("contacts") or []
        if x.get("email") or (x.get("name") and x.get("role") in ("head", "recruiting", "assistant"))
    ]
    return {
        "contacts": people,
        "recruitingQuestionnaire": c.get("recruitingQuestionnaire"),
        "contactsCheckedAt": c.get("checkedAt"),
        "contactsSource": c.get("sourceUrl"),
    }


def main():
    directory = read_json("directory.json")
    tournament = read_json("tournament.json")
    scorecard = read_json("scorecard.json")
    research = load_research() if (RAW / "research").exists() else {}
    contacts = load_contacts()
    systems = load_systems()
    sheet = match_sheet(read_json("spreadsheet.json"), directory) if (RAW / "spreadsheet.json").exists() else {}

    schools = []
    for d in directory:
        key = str(d["ncaaOrgId"])
        school = build_school(d, scorecard.get(key, {}), tournament.get(key, {}), research.get(key), sheet.get(key))
        school.update(contact_fields(contacts.get(key)))
        school.update(system_fields(systems.get(key)))
        schools.append(school)

    # Two schools with one display name (Miami FL/OH, Loyola IL/MD): add the state.
    counts = {}
    for s in schools:
        counts[s["name"]] = counts.get(s["name"], 0) + 1
    for s in schools:
        if counts[s["name"]] > 1:
            s["name"] = f"{s['name']} ({s['state']})"
            s["slug"] = slugify(s["name"])

    out = ROOT / "data" / "seed" / "schools.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(schools, key=lambda s: s["name"])
    out.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")
    # Compact copy for the live site's Admin upload (under the 4.5 MB request limit).
    gz = out.with_suffix(".json.gz")
    gz.write_bytes(gzip.compress(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")).encode()))
    full = sum(1 for s in schools if s["positionsCovered"] == ALL_POSITIONS)
    print(
        f"{len(schools)} schools -> {out} (+ {gz.name}, {gz.stat().st_size // 1024} KB for Admin upload)\n"
        f"  researched: {len(research)}, full rosters: {full}, "
        f"with records: {sum(1 for s in schools if any(x['wins'] is not None for x in s['seasons']))}, "
        f"spreadsheet schools: {len(sheet)}"
    )


if __name__ == "__main__":
    main()
