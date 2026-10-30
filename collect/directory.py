"""Every NCAA Division I women's volleyball program.

Sources: the NCAA member directory API (official name, conference, state,
public/private, athletics website) joined with Wikipedia's list of D1 programs
(team nickname and the volleyball article title, which the tournament collector
uses to recognise teams).

    python collect/directory.py   ->  data/raw/directory.json
"""
import json

from bs4 import BeautifulSoup

from common import fetch, norm, wiki_title, write_json

NCAA_URL = "https://web3.ncaa.org/directory/api/directory/memberList?type=12&sportCode=WVB"
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_women%27s_volleyball_programs"

# NCAA official name -> Wikipedia official name, where word overlap can't tell them apart.
OVERRIDES = {
    "University of Miami (Florida)": "University of Miami",
    "St. John's University (New York)": "St. John's University",
    "University of Illinois Urbana-Champaign": "University of Illinois Urbana–Champaign (Illinois)",
    "College of Charleston (South Carolina)": "College of Charleston (Charleston)",
    "University of Wisconsin-Milwaukee": "University of Wisconsin–Milwaukee (Milwaukee)",
    "Columbia University-Barnard College": "Columbia University",
    "U.S. Air Force Academy": "United States Air Force Academy (Air Force)",
    "Fairleigh Dickinson University, Metropolitan Campus": "Fairleigh Dickinson University",
    "U.S. Military Academy": "United States Military Academy (Army)",
    "U.S. Naval Academy": "United States Naval Academy (Navy)",
    "University of South Carolina, Columbia": "University of South Carolina",
    "University of Tennessee, Knoxville": "University of Tennessee",
    "Texas A&M University, College Station": "Texas A&M University",
    "Tennessee Technological University": "Tennessee Tech University",
    "Bethune-Cookman University": "Bethune–Cookman University",
    "Southern University, Baton Rouge": "Southern University",
}


def similarity(a: str, b: str) -> float:
    wa, wb = set(norm(a).split()), set(norm(b).split())
    return len(wa & wb) / max(len(wa | wb), 1)


def wiki_programs():
    soup = BeautifulSoup(fetch(WIKI_URL, "wiki_d1_programs.html"), "lxml")
    table = soup.find("table", class_="wikitable")
    out = []
    for tr in table.find_all("tr")[1:]:
        tds = tr.find_all(["td", "th"])
        if len(tds) < 4:
            continue
        team_link = tds[1].find("a")
        out.append(
            {
                "official": tds[0].get_text(" ", strip=True),
                "team": tds[1].get_text(" ", strip=True),
                "article": wiki_title(team_link["href"]) if team_link else None,
                "arena": tds[2].get_text(" ", strip=True) or None,
            }
        )
    return out


def main():
    members = [m for m in json.loads(fetch(NCAA_URL, "ncaa_wvb_members.json")) if m.get("division") == 1]
    wiki = wiki_programs()

    # Match each NCAA school to exactly one Wikipedia row: exact names and
    # overrides first, then the most similar remaining pairs.
    wiki_by_official = {w["official"]: w for w in wiki}
    match, taken = {}, set()
    for m in members:
        name = m["nameOfficial"].strip()
        target = OVERRIDES.get(name) or next((w["official"] for w in wiki if norm(w["official"]) == norm(name)), None)
        if target and target in wiki_by_official and target not in taken:
            match[name] = wiki_by_official[target]
            taken.add(target)
    pairs = sorted(
        (
            (similarity(m["nameOfficial"], w["official"]), m["nameOfficial"].strip(), w["official"])
            for m in members
            if m["nameOfficial"].strip() not in match
            for w in wiki
            if w["official"] not in taken
        ),
        reverse=True,
    )
    for score, name, official in pairs:
        if score < 0.25 or name in match or official in taken:
            continue
        match[name] = wiki_by_official[official]
        taken.add(official)

    rows, unmatched = [], []
    for m in members:
        name = m["nameOfficial"].strip()
        w = match.get(name)
        if not w:
            unmatched.append(name)
        rows.append(
            {
                "ncaaOrgId": m["orgId"],
                "officialName": name,
                "team": w["team"] if w else None,
                "wikiArticle": w["article"] if w else None,
                "arena": w["arena"] if w else None,
                "conference": (m.get("conferenceName") or "").strip() or None,
                "state": (m.get("memberOrgAddress") or {}).get("state"),
                "control": "private" if m.get("privateFlag") == "Y" else "public",
                "website": m.get("webSiteUrl"),
                "athleticsWebsite": m.get("athleticWebUrl"),
                "hbcu": m.get("historicallyBlackFlag") == "Y",
            }
        )
    path = write_json("directory.json", sorted(rows, key=lambda r: r["officialName"]))
    print(f"{len(rows)} D1 programs -> {path}")
    print(f"unmatched to Wikipedia: {len(unmatched)} {unmatched[:20]}")


if __name__ == "__main__":
    main()
