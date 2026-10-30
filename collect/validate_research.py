"""Checks research files before they're merged.

    python collect/validate_research.py [ncaaOrgId ...]

Errors (file is unusable or breaks a rule) and warnings (worth a human look) are
printed per school. Exit code 1 if any file has errors.
"""
import json
import re
import sys

from common import RAW, SEASONS, read_json

CLASSES = {"Fr", "So", "Jr", "Sr", "Gr"}
COMMIT_FIELDS = {"name", "gradYear", "position", "heightIn", "highSchool", "hometown", "club", "source", "note"}
PLAYER_FIELDS = {"name", "class", "redshirt", "position", "heightIn"}
URL = re.compile(r"^https?://\S+$")


def check(path, tournament):
    errors, warnings = [], []
    try:
        r = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"invalid JSON: {e}"], []
    oid = str(r.get("ncaaOrgId"))
    if oid != path.stem:
        errors.append(f"ncaaOrgId {oid} doesn't match file name")
    for key in ["shortName", "headCoach", "seasons", "roster", "commits"]:
        if key not in r:
            errors.append(f"missing {key}")
    if errors:
        return errors, warnings

    for s in r["seasons"]:
        if s.get("year") not in SEASONS:
            errors.append(f"season year {s.get('year')} out of range")
            continue
        w, l = s.get("wins"), s.get("losses")
        if w is None:
            continue
        if not (0 <= w <= 40 and 0 <= (l or 0) <= 40):
            errors.append(f"{s['year']} record {w}-{l} implausible")
        t = tournament.get(oid, {}).get(str(s["year"]))
        if t and t.get("finalWins") is not None and (t["finalWins"], t["finalLosses"]) != (w, l):
            warnings.append(f"{s['year']} record {w}-{l} differs from tournament-derived {t['finalWins']}-{t['finalLosses']}")
    if not any(s.get("wins") is not None for s in r["seasons"]):
        warnings.append("no season records")

    players = r["roster"].get("players") or []
    for p in players:
        extra = set(p) - PLAYER_FIELDS
        if extra:
            errors.append(f"roster player has disallowed fields {sorted(extra)}")
        if p.get("class") not in CLASSES:
            errors.append(f"roster class {p.get('class')!r} not one of {sorted(CLASSES)}")
        h = p.get("heightIn")
        if h is not None and not (60 <= h <= 82):
            warnings.append(f"roster height {h} in looks wrong")
    if r["roster"].get("complete") and not (10 <= len(players) <= 30):
        warnings.append(f"roster marked complete with {len(players)} players")
    if not players:
        warnings.append("no roster")

    for c in r["commits"].get("players") or []:
        extra = set(c) - COMMIT_FIELDS
        if extra:
            errors.append(f"commit has disallowed fields {sorted(extra)}")
        if c.get("gradYear") not in (2027, 2028, 2029):
            errors.append(f"commit class {c.get('gradYear')} outside 2027-2029")
        if not URL.match(str(c.get("source") or "")):
            warnings.append("commit without a source URL")
    if r["commits"].get("completeness") not in ("good", "partial", "none_found"):
        errors.append(f"commits.completeness {r['commits'].get('completeness')!r} invalid")

    if not (r["headCoach"] or {}).get("name"):
        warnings.append("no head coach")
    return errors, warnings


def main():
    tournament = read_json("tournament.json")
    ids = set(sys.argv[1:])
    files = sorted(p for p in (RAW / "research").glob("*.json") if not ids or p.stem in ids)
    bad = 0
    for p in files:
        errors, warnings = check(p, tournament)
        if errors or warnings:
            print(f"{p.stem}:")
            for e in errors:
                print(f"  ERROR {e}")
            for w in warnings:
                print(f"  warn  {w}")
        bad += bool(errors)
    print(f"{len(files)} files checked, {bad} with errors")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
