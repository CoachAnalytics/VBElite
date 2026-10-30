"""NCAA Division I women's volleyball tournament results, 2021-2025.

For every team in each 64-team field: seed, record at selection, tournament
wins/losses, final record, and how far it went. Source: the yearly Wikipedia
tournament articles (region field tables + the 63 match results).

    python collect/tournament.py   ->  data/raw/tournament.json   (needs directory.json)
"""
import re
from collections import defaultdict

from bs4 import BeautifulSoup

from common import SEASONS, fetch, norm, read_json, wiki_title, write_json

URL = "https://en.wikipedia.org/wiki/{year}_NCAA_Division_I_women%27s_volleyball_tournament"
# Tournament wins -> furthest round reached (64-team bracket).
FINISH = ["1st round", "2nd round", "Sweet 16", "Elite 8", "Final Four", "Runner-up"]
SCORE = re.compile(r"^\s*(\d)\s*[-–]\s*(\d)\s*$")
RECORD = re.compile(r"(\d+)\s*[-–]\s*(\d+)")

# Short names Wikipedia uses that don't uniquely prefix a directory team name.
ALIASES = {
    "north carolina": "North Carolina Tar Heels",
    "north carolina tarheels": "North Carolina Tar Heels",
    "western kentucky": "WKU Lady Toppers",
    "tennessee": "Tennessee Volunteers",
    "delaware": "Delaware Fightin' Blue Hens",
    "uni": "Northern Iowa Panthers",
    "saint thomas mn": "St. Thomas Tommies",
    "southern california": "USC Trojans",
    "usc": "USC Trojans",
    "hawaii": "Hawaii Rainbow Wahine",
    "hawai": "Hawaii Rainbow Wahine",
    "fgcu": "Florida Gulf Coast Eagles",
    "miami fl": "Miami Hurricanes",
    "texas a and m corpus christi": "Texas A&M-Corpus Christi Islanders",
}


def team_key(text: str) -> str:
    """'(1) Nebraska' -> 'nebraska'"""
    return norm(re.sub(r"^\(\d+\)\s*", "", text).replace("*", ""))


def directory_index():
    """Map Wikipedia link targets and team names to directory rows."""
    by_link, by_team = {}, {}
    for d in read_json("directory.json"):
        team = d["team"] or ""
        for key in {team, (d["wikiArticle"] or "").replace(" women's volleyball", "").replace(" volleyball", "")}:
            if key:
                by_link[norm(key)] = d
        by_team[norm(team)] = d
    return by_link, by_team


def resolve(link_title: str | None, text: str, by_link, by_team):
    alias = ALIASES.get(team_key(text))
    if alias and norm(alias) in by_team:
        return by_team[norm(alias)]
    if link_title:
        base = re.sub(r"#.*$", "", link_title).replace(" women's volleyball", "").replace(" volleyball", "")
        if norm(base) in by_link:
            return by_link[norm(base)]
    # Short names ("Nebraska") prefix their directory team name ("Nebraska Cornhuskers").
    key = team_key(text)
    hits = [d for t, d in by_team.items() if t == key or t.startswith(key + " ")]
    return hits[0] if len(hits) == 1 else None


def parse_year(year: int, by_link, by_team):
    soup = BeautifulSoup(fetch(URL.format(year=year), f"wiki_tournament_{year}.html"), "lxml")
    field, by_short = {}, {}
    for table in soup.find_all("table", class_="wikitable"):
        rows = table.find_all("tr")
        header = [c.get_text(" ", strip=True) for c in rows[0].find_all(["th", "td"])]
        if "School" not in header or "Record" not in header:
            continue
        i_school, i_rec = header.index("School"), header.index("Record")
        i_seed = header.index("Seed") if "Seed" in header else None
        for tr in rows[1:]:
            cells = tr.find_all(["td", "th"])
            if len(cells) <= max(i_school, i_rec):
                continue
            cell = cells[i_school]
            text = cell.get_text(" ", strip=True)
            link = cell.find("a")
            d = resolve(wiki_title(link["href"]) if link else None, text, by_link, by_team)
            if not d:
                print(f"  {year}: could not match '{text}'")
                continue
            rec = RECORD.search(cells[i_rec].get_text(" ", strip=True))
            seed_text = cells[i_seed].get_text(strip=True) if i_seed is not None else ""
            field[d["ncaaOrgId"]] = {
                "seed": int(seed_text) if seed_text.isdigit() else None,
                "selectionWins": int(rec.group(1)) if rec else None,
                "selectionLosses": int(rec.group(2)) if rec else None,
                "wins": 0,
                "losses": 0,
            }
            by_short[team_key(text)] = d["ncaaOrgId"]

    def lookup(raw: str):
        key = team_key(raw)
        if key in by_short:
            return by_short[key]
        d = resolve(None, raw, by_link, by_team)
        return d["ncaaOrgId"] if d and d["ncaaOrgId"] in field else None

    matches = 0
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue
        cells = rows[0].find_all(["td", "th"])
        if len(cells) != 5:
            continue
        m = SCORE.match(cells[2].get_text(strip=True))
        if not m:
            continue
        ida, idb = lookup(cells[1].get_text(" ", strip=True)), lookup(cells[3].get_text(" ", strip=True))
        if ida is None or idb is None:
            print(f"  {year}: unmatched match '{cells[1].get_text(strip=True)}' / '{cells[3].get_text(strip=True)}'")
            continue
        winner, loser = (ida, idb) if int(m.group(1)) > int(m.group(2)) else (idb, ida)
        field[winner]["wins"] += 1
        field[loser]["losses"] += 1
        matches += 1

    for v in field.values():
        v["finish"] = "Champion" if v["wins"] >= 6 else FINISH[v["wins"]]
        if v["selectionWins"] is not None:
            v["finalWins"] = v["selectionWins"] + v["wins"]
            v["finalLosses"] = v["selectionLosses"] + v["losses"]
    champions = sum(1 for v in field.values() if v["finish"] == "Champion")
    print(f"{year}: {len(field)} teams, {matches} matches, {champions} champion")
    return field


def main():
    by_link, by_team = directory_index()
    out = defaultdict(dict)
    for year in SEASONS:
        for org_id, v in parse_year(year, by_link, by_team).items():
            out[str(org_id)][str(year)] = v
    path = write_json("tournament.json", out)
    print(f"{len(out)} schools with at least one appearance -> {path}")


if __name__ == "__main__":
    main()
