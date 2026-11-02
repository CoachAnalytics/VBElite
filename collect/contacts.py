"""Collect volleyball staff contact emails from each school's official athletics site.

Reads the school list from the data repo's seed, fetches each program's public coaches page
(one request per site, robots.txt respected, no retries on a block), and writes
contacts/<ncaaOrgId>.json in the data repo. Schools the script can't read are listed for
research agents (see collect/CONTACTS.md).

    python3 collect/contacts.py /home/user/vbelite-data [--only 1234,5678] [--redo]
"""

from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import gzip
import html
import json
import re
import sys
import subprocess
import time
import urllib.robotparser
from pathlib import Path

UA = "VBEliteResearch/1.0 (college volleyball recruiting directory)"
PATHS = ["/sports/womens-volleyball/coaches", "/sports/wvball/coaches", "/sports/volleyball/coaches"]
BLOCKED = {401, 403, 429, 503}
EMAIL = re.compile(r"[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

# Titles of people a recruit should email. Support staff (trainers, communications,
# academics, strength) are left out.
SKIP = re.compile(
    r"trainer|communicat|media|sports info|academic|strength|conditioning|nutrition|equipment|"
    r"marketing|ticket|compliance|psycholog|athletic director|director of athletics|sid\b|video|"
    r"student manager|manager$|photograph|creative|development officer|fundrais",
    re.I,
)


def role_of(title: str) -> str | None:
    t = title.lower()
    if SKIP.search(t) and "coach" not in t:
        return None
    if "recruiting" in t:
        return "recruiting"
    if "head coach" in t and "associate head" not in t and "assistant head" not in t:
        return "head"
    if "coach" in t:
        return "assistant"
    if "operations" in t or "director of volleyball" in t or "coordinator" in t:
        return "operations"
    return None


def clean(s: str) -> str:
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return " ".join(html.unescape(s).split())


def fetch(url: str) -> tuple[int, str, str]:
    """GET with plain curl and an identifying user agent; returns (status, final URL, body)."""
    try:
        p = subprocess.run(
            ["curl", "-s", "-L", "--max-time", "25", "--max-filesize", "4000000", "-A", UA,
             "-H", "Accept: text/html", "-w", "\n%{http_code} %{url_effective}", url],
            capture_output=True, timeout=40,
        )
    except subprocess.TimeoutExpired:
        return 0, url, ""
    body, _, tail = p.stdout.decode("utf-8", "replace").rpartition("\n")
    code, _, final = tail.partition(" ")
    return int(code) if code.isdigit() else 0, final or url, body


def allowed(base: str, path: str) -> bool:
    rp = urllib.robotparser.RobotFileParser()
    status, _, text = fetch(base + "/robots.txt")
    if status in BLOCKED:
        return False
    if status != 200:
        return True
    rp.parse(text.splitlines())
    return rp.can_fetch(UA, base + path)


def parse(page: str) -> tuple[list[dict], str | None]:
    """Coach rows (name, title, email, phone) from a Sidearm-style coaches table."""
    people: list[dict] = []
    for row in re.findall(r"<tr\b.*?</tr>", page, re.S):
        if "@" not in row:
            continue
        cells = [clean(c) for c in re.findall(r"<t[dh]\b.*?</t[dh]>", row, re.S)]
        emails = sorted({m.group(0).rstrip(".").lower() for m in EMAIL.finditer(html.unescape(row))})
        cells = [c for c in cells if c]
        if len(cells) < 2 or not emails:
            continue
        name, title = cells[0], cells[1]
        if EMAIL.search(name) or len(name) > 60:
            continue
        phone = next((c for c in cells[2:] if re.search(r"\d{3}\D{0,2}\d{3}\D\d{4}", c)), None)
        if phone:
            phone = re.search(r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}", phone).group(0)
        people.append({"name": name, "title": title, "email": emails[0], "phone": phone})
    q = re.search(r'href="([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*[^<]*(?:Recruiting Questionnaire|Prospective Student-Athlete Questionnaire|Recruit Questionnaire)', page, re.I)
    questionnaire = html.unescape(q.group(1)) if q else None
    return people, questionnaire


def build(people: list[dict]) -> list[dict]:
    out: list[dict] = []
    seen_shared: set[str] = set()
    counts: dict[str, int] = {}
    for p in people:
        counts[p["email"]] = counts.get(p["email"], 0) + 1
    for p in people:
        role = role_of(p["title"])
        if not role:
            continue
        email = p["email"]
        local = email.split("@")[0]
        shared = counts[email] > 1 or bool(re.search(r"volleyball|vball|recruit|^vb|vb$", local))
        if shared:
            # A program inbox listed against several coaches: show it once, as the program's.
            if email not in seen_shared:
                seen_shared.add(email)
                out.append({"name": None, "title": "Program recruiting email", "role": "program", "email": email, "phone": None})
            out.append({**p, "role": role, "email": None})
        else:
            out.append({**p, "role": role})
    order = {"program": 0, "head": 1, "recruiting": 2, "assistant": 3, "operations": 4}
    out.sort(key=lambda c: order[c["role"]])
    return out


def collect(school: dict) -> dict:
    site = (school.get("athleticsWebsite") or "").strip().rstrip("/")
    result = {
        "ncaaOrgId": school["ncaaOrgId"],
        "school": school["name"],
        "checkedAt": dt.date.today().isoformat(),
        "method": "script",
        "sourceUrl": None,
        "contacts": [],
        "recruitingQuestionnaire": None,
        "notes": "",
    }
    if not site:
        result["notes"] = "No athletics website on file."
        return result
    base = site if site.startswith("http") else "https://" + site
    for path in PATHS:
        if not allowed(base, path):
            result["notes"] = f"robots.txt disallows {path} or the site blocked the request."
            return result
        status, final, page = fetch(base + path)
        if status in BLOCKED:
            result["notes"] = f"{base} returned {status}; not retried."
            return result
        if status == 200 and page:
            people, q = parse(page)
            if people:
                result["sourceUrl"] = final
                result["contacts"] = build(people)
                if q:
                    result["recruitingQuestionnaire"] = q if q.startswith("http") else base + ("" if q.startswith("/") else "/") + q
                if not result["contacts"]:
                    result["notes"] = "Coaches page has emails but none for coaching staff."
                return result
        time.sleep(1)
    result["notes"] = "No coaches table with emails found."
    return result


def main() -> None:
    data = Path(sys.argv[1])
    only = set()
    if "--only" in sys.argv:
        only = {int(x) for x in sys.argv[sys.argv.index("--only") + 1].split(",")}
    redo = "--redo" in sys.argv
    schools = json.load(gzip.open(data / "seed" / "schools.json.gz"))
    out_dir = data / "contacts"
    out_dir.mkdir(exist_ok=True)
    todo = [s for s in schools if (not only or s["ncaaOrgId"] in only) and (redo or not (out_dir / f"{s['ncaaOrgId']}.json").exists())]
    print(f"{len(todo)} schools to check", flush=True)
    found = 0
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        for r in pool.map(collect, todo):
            (out_dir / f"{r['ncaaOrgId']}.json").write_text(json.dumps(r, indent=2) + "\n")
            n = sum(1 for c in r["contacts"] if c["email"])
            found += n > 0
            print(f"{r['school']}: {n} emails{'' if n else ' - ' + r['notes']}", flush=True)
    print(f"done: {found}/{len(todo)} schools with emails")


if __name__ == "__main__":
    main()
