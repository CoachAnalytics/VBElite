"""Location, size, cost and academics for every D1 program from the U.S. Dept. of
Education College Scorecard (most recent institution-level file).

Downloads the file (about 24 MB) from https://collegescorecard.ed.gov/data/ unless a
path to an already-downloaded CSV is given.

    python collect/scorecard.py [Most-Recent-Cohorts-Institution.csv]  ->  data/raw/scorecard.json
"""
import csv
import io
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

from common import RAW, UA, norm, read_json, write_json

DATA_PAGE = "https://collegescorecard.ed.gov/data/"

FIELDS = {
    "name": "INSTNM",
    "city": "CITY",
    "state": "STABBR",
    "zip": "ZIP",
    "website": "INSTURL",
    "latitude": "LATITUDE",
    "longitude": "LONGITUDE",
    "undergradEnrollment": "UGDS",
    "admissionRate": "ADM_RATE",
    "satAvg": "SAT_AVG",
    "act25": "ACTCM25",
    "act75": "ACTCM75",
    "tuitionInState": "TUITIONFEE_IN",
    "tuitionOutState": "TUITIONFEE_OUT",
    "costOfAttendance": "COSTT4_A",
    "avgNetPricePublic": "NPT4_PUB",
    "avgNetPricePrivate": "NPT4_PRIV",
    "graduationRate": "C150_4",
    "retentionRate": "RET_FT4",
    "medianEarnings10yr": "MD_EARN_WNE_P10",
    "studentFacultyRatio": "STUFACR",
}
TEXT_FIELDS = {"name", "city", "state", "zip", "website"}

# NCAA official name -> Scorecard UNITID where websites and names don't line up.
OVERRIDES = {
    "College of Charleston (South Carolina)": "217819",
    "LSU New Orleans": "159939",  # formerly University of New Orleans
    "Rutgers, The State University of New Jersey, New Brunswick": "186380",
    "Texas State University": "228459",
    "University of Rhode Island": "217484",
}


def domain(url: str | None) -> str | None:
    if not url:
        return None
    d = re.sub(r"^https?://", "", url.strip().lower()).split("/")[0]
    return re.sub(r"^www\d?\.", "", d) or None


def num(v):
    if v in ("", "NULL", "NA", "PrivacySuppressed", None):
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return int(f) if f.is_integer() else f


def load_csv(arg: str | None) -> list[dict]:
    if arg:
        return list(csv.DictReader(open(arg, encoding="utf-8-sig")))
    dest = RAW / "scorecard"
    existing = next(dest.rglob("Most-Recent-Cohorts-Institution*.csv"), None) if dest.exists() else None
    if not existing:
        page = urllib.request.urlopen(urllib.request.Request(DATA_PAGE, headers={"User-Agent": UA}), timeout=60).read().decode()
        url = re.search(r"https?://[^\"']+Most-Recent-Cohorts-Institution[^\"']*\.zip", page).group(0)
        print(f"downloading {url}")
        data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=600).read()
        dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            name = next(n for n in z.namelist() if n.endswith(".csv") and "__MACOSX" not in n)
            existing = dest / Path(name).name
            existing.write_bytes(z.read(name))
    return list(csv.DictReader(open(existing, encoding="utf-8-sig")))


def main():
    rows = load_csv(sys.argv[1] if len(sys.argv) > 1 else None)
    by_unit = {r["UNITID"]: r for r in rows}
    by_domain, by_state = {}, {}
    for r in rows:
        if r.get("MAIN") != "1":  # main campuses only
            continue
        d = domain(r["INSTURL"])
        if d:
            by_domain.setdefault(d, r)
        by_state.setdefault(r["STABBR"], []).append(r)

    stop = {"university", "of", "the", "college", "at"}
    out, unmatched = {}, []
    for s in read_json("directory.json"):
        r = by_unit.get(OVERRIDES.get(s["officialName"], "")) or by_domain.get(domain(s["website"]) or "")
        if not r:
            # Same state, clearly best name overlap.
            words = set(norm(s["officialName"]).split()) - stop
            scored = sorted(
                ((len(words & (set(norm(c["INSTNM"]).split()) - stop)), c) for c in by_state.get(s["state"], [])),
                key=lambda x: -x[0],
            )
            if scored and scored[0][0] >= max(1, len(words) - 1) and (len(scored) == 1 or scored[0][0] > scored[1][0]):
                r = scored[0][1]
        if not r:
            unmatched.append(s["officialName"])
            continue
        rec = {k: (r[v] if k in TEXT_FIELDS else num(r[v])) for k, v in FIELDS.items()}
        rec["unitId"] = num(r["UNITID"])
        out[str(s["ncaaOrgId"])] = rec
    path = write_json("scorecard.json", out)
    print(f"{len(out)} of {len(read_json('directory.json'))} matched -> {path}")
    if unmatched:
        print(f"unmatched ({len(unmatched)}): {unmatched}")


if __name__ == "__main__":
    main()
